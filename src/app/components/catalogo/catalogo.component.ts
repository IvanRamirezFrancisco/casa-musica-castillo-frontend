import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, map, skip, switchMap, takeUntil } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { PublicApiService } from '../../services/public-api.service';
import { WishlistService } from '../../services/wishlist.service';
import { User } from '../../models/user.model';
import { PublicProduct, PublicCategory, SpringPage } from '../../models/product.model';
import { ConnectivityService } from '../../services/connectivity.service';
import { SearchService } from '../../services/search.service';
import { VoiceSearchService, VoiceSearchEvent } from '../../services/voice-search.service';
import { CatalogSearchNavService } from '../../services/catalog-search-nav.service';

@Component({
  selector: 'app-catalogo',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './catalogo.component.html',
  styleUrl: './catalogo.component.css',
  host: {
    '(document:click)': 'onDocumentClick($event)'
  }
})
export class CatalogoComponent implements OnInit, OnDestroy {
  readonly voiceSourceId = 'catalogo-search';
  searchQuery = '';
  suggestedSearchTerm: string | null = null;
  cartItemCount = 0;

  // Búsqueda por voz en catálogo
  voiceSupported = false;
  voiceState: VoiceSearchEvent = {
    status: 'IDLE',
    transcript: '',
    isFinal: false
  };

  // Usuario logueado
  isLoggedIn = false;
  currentUser: User | null = null;
  showUserMenu = false;

  // Filtros activos
  categoriaSeleccionada: number[] = [];   // IDs numéricos del backend
  marcaSeleccionada: number[] = [];       // IDs numéricos del backend
  precioMin = 0;
  precioMax = 100000;

  // Datos reales del backend
  categorias: PublicCategory[] = [];
  marcasDisponibles: { id: number; name: string }[] = [];

  // Productos paginados
  paginaActual = 0;
  tamanioPagina = 12;
  totalProductos = 0;
  totalPaginas = 0;

  productos: PublicProduct[] = [];
  loading = true;
  serverWaking = false;
  error: string | null = null;

  // Control de filtros móvil
  mostrarFiltros = false;

  // Control de visibilidad del sidebar de filtros (desktop)
  filtrosVisibles = true;

  // Ordenación
  sortBy: 'featured' | 'price_asc' | 'price_desc' | 'name_asc' = 'featured';
  sortOptions = [
    { value: 'featured',   label: 'Destacados'            },
    { value: 'price_asc',  label: 'Precio: menor a mayor' },
    { value: 'price_desc', label: 'Precio: mayor a menor' },
    { value: 'name_asc',   label: 'Nombre: A → Z'         },
  ];

  // Para búsqueda con debounce y control de peticiones en vuelo
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();
  private loadProductsSub?: Subscription;
  private wakingTimer: ReturnType<typeof setTimeout> | null = null;
  /** Última combinación search|categoría|marca ya cargada (evita peticiones duplicadas). */
  private lastStateKey: string | null = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private publicApiService: PublicApiService,
    private cartService: CartService,
    private wishlistService: WishlistService,
    private connectivityService: ConnectivityService,
    private searchService: SearchService,
    private voiceSearchService: VoiceSearchService,
    private catalogNav: CatalogSearchNavService
  ) {}

  get isOnline(): boolean {
    return this.connectivityService.isOnline;
  }

  get isVoiceListening(): boolean {
    return (
      (this.voiceState.status === 'LISTENING' ||
        this.voiceState.status === 'PROCESSING') &&
      this.voiceState.sourceId === this.voiceSourceId
    );
  }

  get catalogVoiceAriaLabel(): string {
    if (!this.voiceSupported) {
      return 'Tu navegador no admite búsqueda por voz. Puedes escribir tu búsqueda.';
    }
    return this.isVoiceListening ? 'Detener búsqueda por voz' : 'Buscar por voz';
  }

  toggleCatalogVoiceSearch(): void {
    if (!this.voiceSupported) {
      return;
    }
    this.voiceSearchService.toggleListening(this.voiceSourceId);
  }

  stopCatalogVoiceSearch(): void {
    this.voiceSearchService.stopListening(this.voiceSourceId);
  }

  /**
   * X del buscador del catálogo / chip "Búsqueda": limpia ÚNICAMENTE el término
   * (conserva categoría, marca y demás filtros). Misma operación que la X del header.
   */
  clearCatalogSearch(): void {
    this.cancelPendingTypedSearch();
    this.searchQuery = '';
    this.suggestedSearchTerm = null;
    this.paginaActual = 0;
    if (this.catalogNav.hasSearchInUrl()) {
      this.catalogNav.clearSearch();
    } else {
      this.lastStateKey = this.stateKey();
      this.loadProducts();
    }
  }

  /** Enter / voz final: aplica la búsqueda de inmediato (sin esperar el debounce). */
  submitCatalogSearch(): void {
    this.searchSubject.next('');
    const clean = this.searchService.sanitizeSearchQuery(this.searchQuery);
    if (clean.length === 0) {
      this.clearCatalogSearch();
    } else if (clean.length >= 2) {
      this.catalogNav.search(clean, { keepFilters: true });
    }
  }

  ngOnInit(): void {
    this.voiceSupported = this.voiceSearchService.isSupported();

    this.voiceSearchService.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe((state) => {
        if (!state.sourceId || state.sourceId === this.voiceSourceId) {
          this.voiceState = state;
        } else if (this.voiceState.status !== 'IDLE') {
          this.voiceState = { status: 'IDLE', transcript: '', isFinal: false };
        }
      });

    this.voiceSearchService.transcript$
      .pipe(
        filter((evt) => evt.sourceId === this.voiceSourceId),
        takeUntil(this.destroy$)
      )
      .subscribe((evt) => {
        const clean = this.searchService.sanitizeSearchQuery(evt.transcript);
        this.searchQuery = clean;
        if (evt.isFinal) {
          this.submitCatalogSearch();
        }
      });

    // Verificar autenticación
    this.authService.getCurrentUser().pipe(takeUntil(this.destroy$)).subscribe((user: User | null) => {
      this.currentUser = user;
      this.isLoggedIn = !!user;
    });

    // Cargar categorías con productos activos para el sidebar (deduplicadas y cacheadas en memoria)
    this.publicApiService.getActiveCategories(true).pipe(takeUntil(this.destroy$)).subscribe({
      next: (cats) => this.categorias = cats,
      error: () => {}
    });

    // La URL (/catalogo?search=&categoryId=&brandId=) es la fuente de verdad del estado
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const parseIds = (raw: unknown): number[] =>
        String(raw ?? '')
          .split(',')
          .map(v => +v)
          .filter(v => Number.isFinite(v) && v > 0);

      this.categoriaSeleccionada = parseIds(params['categoryId'] ?? params['category']);
      this.marcaSeleccionada = parseIds(params['brandId']);

      const rawSearch = params['search'] ?? params['busqueda'] ?? '';
      const urlSearch = this.searchService.sanitizeSearchQuery(typeof rawSearch === 'string' ? rawSearch : '');
      // No pisar lo que el usuario sigue escribiendo si ya equivale a lo que dice la URL
      if (this.searchService.sanitizeSearchQuery(this.searchQuery) !== urlSearch) {
        this.searchQuery = urlSearch;
      }

      const key = [urlSearch, this.categoriaSeleccionada.join(','), this.marcaSeleccionada.join(',')].join('|');
      if (key === this.lastStateKey) {
        return; // misma consulta ya aplicada: evita petición duplicada
      }
      this.lastStateKey = key;
      this.paginaActual = 0;
      this.loadProducts();
    });

    // Búsqueda escrita con debounce de 300ms; el resultado se aplica vía URL
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(term => {
      const clean = this.searchService.sanitizeSearchQuery(term);
      if (clean.length === 0) {
        this.catalogNav.clearSearch();
      } else if (clean.length >= 2) {
        this.applyTypedSearch(clean);
      }
    });

    // Actualizar contador de carrito
    this.cartService.cartCount$.pipe(takeUntil(this.destroy$)).subscribe(count => {
      this.cartItemCount = count;
    });

    // Al restablecer la conexión (skip(1) evita disparo duplicado en la emisión inicial del BehaviorSubject)
    this.connectivityService.isOnline$.pipe(
      distinctUntilChanged(),
      skip(1),
      takeUntil(this.destroy$)
    ).subscribe(online => {
      if (online) {
        if (this.error || this.productos.length === 0) {
          this.loadProducts();
        }
        if (this.categorias.length === 0) {
          this.publicApiService.getActiveCategories(true).pipe(takeUntil(this.destroy$)).subscribe({
            next: (cats) => this.categorias = cats,
            error: () => {}
          });
        }
      }
    });
  }

  private clearWakingTimer(): void {
    if (this.wakingTimer) {
      clearTimeout(this.wakingTimer);
      this.wakingTimer = null;
    }
    this.serverWaking = false;
  }

  loadProducts(): void {
    this.loadProductsSub?.unsubscribe();
    this.clearWakingTimer();

    this.loading = true;
    this.error = null;

    const rawKeyword = this.searchQuery.trim();
    const analyzed = rawKeyword
      ? this.searchService.analyzeQuery(rawKeyword)
      : null;

    this.suggestedSearchTerm =
      analyzed && analyzed.typoCorrected ? analyzed.canonical : null;

    const effectiveKeyword =
      analyzed && analyzed.canonical
        ? analyzed.canonical
        : rawKeyword || undefined;

    if (this.connectivityService.isOnline) {
      this.wakingTimer = setTimeout(() => {
        if (this.loading && this.connectivityService.isOnline) {
          this.serverWaking = true;
        }
      }, 3200);
    }

    const catParam =
      this.categoriaSeleccionada.length === 1
        ? this.categoriaSeleccionada[0]
        : undefined;
    const brandParam =
      this.marcaSeleccionada.length === 1
        ? this.marcaSeleccionada[0]
        : undefined;

    this.loadProductsSub = this.publicApiService
      .getCatalog({
        keyword: effectiveKeyword,
        categoryId: catParam,
        brandId: brandParam,
        sortBy: this.sortBy,
        page: this.paginaActual,
        size: this.tamanioPagina,
      })
      .pipe(
        switchMap((page: SpringPage<PublicProduct>) => {
          // El backend (ranking de relevancia) es la fuente principal. Solo si respondió
          // correctamente con 0 resultados en una consulta multi-palabra (p. ej. backend
          // desplegado sin búsqueda multi-token) se hace UN fallback acotado a 20 productos.
          if (
            page.content.length === 0 &&
            this.paginaActual === 0 &&
            analyzed &&
            analyzed.tokens.length >= 2 &&
            analyzed.tokens[0]
          ) {
            return this.publicApiService
              .getCatalog({
                keyword: analyzed.tokens[0],
                categoryId: catParam,
                brandId: brandParam,
                sortBy: this.sortBy,
                page: 0,
                size: 20,
              })
              .pipe(
                map((fallbackPage) => {
                  const filtered = this.searchService.filterByAllTokens(
                    fallbackPage.content || [],
                    analyzed.tokens
                  );
                  const ranked = this.searchService.rankProducts(
                    filtered,
                    analyzed.normalizedOriginal,
                    analyzed.canonical,
                    analyzed.tokens
                  );
                  return {
                    ...fallbackPage,
                    content: ranked,
                    totalElements: ranked.length,
                    totalPages: Math.max(
                      1,
                      Math.ceil(ranked.length / this.tamanioPagina)
                    ),
                  } as SpringPage<PublicProduct>;
                })
              );
          }
          return of(page);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (page: SpringPage<PublicProduct>) => {
          this.clearWakingTimer();
          this.productos = page.content;
          this.totalProductos = page.totalElements;
          this.totalPaginas = page.totalPages;

          // Extraer marcas únicas de los resultados para el sidebar
          const marcasMap = new Map<number, string>();
          page.content.forEach((p) => {
            if (p.brand) {
              marcasMap.set(p.brand.id, p.brand.name);
            }
          });
          this.marcasDisponibles = Array.from(marcasMap.entries()).map(
            ([id, name]) => ({ id, name })
          );

          this.loading = false;
        },
        error: (err) => {
          this.clearWakingTimer();
          if (
            !this.connectivityService.isOnline ||
            err?.status === 0 ||
            err?.error?.offline
          ) {
            this.error =
              'No hay información guardada para esta consulta. Conéctate a Internet para actualizar el catálogo.';
          } else {
            this.error =
              'El servidor está tardando en responder. Inténtalo de nuevo en unos segundos.';
          }
          this.loading = false;
        },
      });
  }

  readonly fallbackImageUrl =
    "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23FAF8F5'/%3E%3Ccircle cx='200' cy='180' r='54' fill='%23722F37' fill-opacity='0.08'/%3E%3Cpath d='M212 145v58.5a19.5 19.5 0 1 1-11-17.55V132h29v13h-18z' fill='%23722F37' fill-opacity='0.45'/%3E%3Ctext x='200' y='272' text-anchor='middle' font-family='sans-serif' font-size='14' font-weight='600' fill='%2364748B'%3ECasa de M%C3%BAsica Castillo%3C/text%3E%3C/svg%3E";

  onProductImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img && img.src !== this.fallbackImageUrl) {
      img.src = this.fallbackImageUrl;
    }
  }

  // Alias para compatibilidad con el template existente
  get productosFiltrados(): PublicProduct[] {
    return this.productos;
  }

  // Alias de marcas para compatibilidad con el template
  get marcas(): string[] {
    return this.marcasDisponibles.map(m => m.name);
  }

  /** Aplica filtros: sincroniza la URL y relanza la llamada al backend (nunca en memoria). */
  aplicarFiltros(): void {
    this.paginaActual = 0;
    this.syncUrlFromState();
    this.loadProducts();
  }

  /** Clave canónica del estado de filtros/búsqueda (para evitar recargas duplicadas). */
  private stateKey(): string {
    const q = this.searchService.sanitizeSearchQuery(this.searchQuery);
    return [
      q.length >= 2 ? q : '',
      this.categoriaSeleccionada.join(','),
      this.marcaSeleccionada.join(','),
    ].join('|');
  }

  /** Escribe el estado actual en la URL sin generar una segunda carga. */
  private syncUrlFromState(): void {
    this.lastStateKey = this.stateKey();
    const q = this.searchService.sanitizeSearchQuery(this.searchQuery);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        search: q.length >= 2 ? q : null,
        busqueda: null,
        categoryId: this.categoriaSeleccionada.length ? this.categoriaSeleccionada.join(',') : null,
        category: null,
        brandId: this.marcaSeleccionada.length ? this.marcaSeleccionada.join(',') : null,
        page: null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Búsqueda escrita en el catálogo: conserva los demás filtros. */
  private applyTypedSearch(term: string): void {
    this.catalogNav.search(term, { keepFilters: true, replaceUrl: true });
  }

  private cancelPendingTypedSearch(): void {
    this.searchSubject.next('');
    this.loadProductsSub?.unsubscribe();
  }

  cambiarPagina(pagina: number): void {
    if (pagina < 0 || pagina >= this.totalPaginas) return;
    this.paginaActual = pagina;
    this.loadProducts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  get paginas(): number[] {
    return Array.from({ length: this.totalPaginas }, (_, i) => i);
  }

  // Ver detalle del producto
  verDetalle(producto: PublicProduct): void {
    this.router.navigate(['/producto', producto.id]);
  }

  // ── Favoritos ──────────────────────────────────────────────────────────────
  togglingFavs = new Set<number>();

  isFavorite(productId: number): boolean {
    return this.wishlistService.isInWishlist(productId);
  }

  toggleFavorite(productId: number, event: Event): void {
    event.stopPropagation();

    if (!this.connectivityService.isOnline) {
      this.connectivityService.notifyOfflineAction('Esta acción requiere conexión a Internet.');
      return;
    }
    
    if (!this.isLoggedIn) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    this.togglingFavs.add(productId);
    this.wishlistService.toggle(productId).subscribe({
      next: () => {
        this.togglingFavs.delete(productId);
      },
      error: () => {
        this.togglingFavs.delete(productId);
      }
    });
  }

  // Agregar producto al carrito
  agregarAlCarrito(producto: PublicProduct, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    if (!this.connectivityService.isOnline) {
      this.connectivityService.notifyOfflineAction('Agregar al carrito requiere conexión a Internet.');
      return;
    }
    if (!this.isLoggedIn) {
      this.router.navigate(['/login'], {
        queryParams: { returnUrl: this.router.url }
      });
      return;
    }
    const buttonElement = event?.currentTarget as HTMLElement;
    const rect = buttonElement?.getBoundingClientRect();
    // Adaptador de PublicProduct al contrato de CartService
    const cartProduct = {
      id: String(producto.id),
      name: producto.name,
      price: producto.price,
      imageUrl: producto.imageUrl,
      stock: producto.stock
    } as any;
    this.cartService.addToCart(cartProduct, 1, undefined, {
      x: rect ? rect.left + rect.width / 2 : window.innerWidth / 2,
      y: rect ? rect.top + rect.height / 2 : window.innerHeight / 2
    });
  }

  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const userMenuContainer = target.closest('.user-menu-container');
    if (!userMenuContainer && this.showUserMenu) {
      this.showUserMenu = false;
    }
  }

  toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
  }

  closeUserMenu(): void {
    this.showUserMenu = false;
  }

  navigateToProfile(): void {
    this.closeUserMenu();
    this.router.navigate(['/dashboard/seguridad']);
  }

  logout(): void {
    this.closeUserMenu();
    this.authService.logout();
    this.isLoggedIn = false;
    this.currentUser = null;
    this.router.navigate(['/home']);
  }

  toggleFiltroCategoria(categoriaId: number): void {
    const index = this.categoriaSeleccionada.indexOf(categoriaId);
    if (index > -1) {
      this.categoriaSeleccionada.splice(index, 1);
    } else {
      this.categoriaSeleccionada.push(categoriaId);
    }
    this.aplicarFiltros();
  }

  toggleFiltroMarca(marcaId: number): void {
    const index = this.marcaSeleccionada.indexOf(marcaId);
    if (index > -1) {
      this.marcaSeleccionada.splice(index, 1);
    } else {
      this.marcaSeleccionada.push(marcaId);
    }
    this.aplicarFiltros();
  }

  /** "Limpiar todo": búsqueda + categorías + marcas + precio + orden + página → catálogo inicial. */
  limpiarFiltros(): void {
    this.cancelPendingTypedSearch();
    const hadUrlState = this.router.url.split('?').length > 1;
    this.categoriaSeleccionada = [];
    this.marcaSeleccionada = [];
    this.precioMin = 0;
    this.precioMax = 100000;
    this.searchQuery = '';
    this.suggestedSearchTerm = null;
    this.sortBy = 'featured';
    this.paginaActual = 0;
    this.lastStateKey = this.stateKey();
    if (hadUrlState) {
      this.catalogNav.clearAll();
    }
    this.loadProducts();
  }

  // Filtros móvil
  toggleFiltros(): void {
    this.mostrarFiltros = !this.mostrarFiltros;
    document.body.style.overflow = this.mostrarFiltros ? 'hidden' : '';
  }

  cerrarFiltros(): void {
    this.mostrarFiltros = false;
    document.body.style.overflow = '';
  }

  // Sidebar filtros desktop (ocultar / mostrar)
  toggleFiltrosVisibles(): void {
    this.filtrosVisibles = !this.filtrosVisibles;
  }

  // Cambio de ordenación
  onSortChange(): void {
    this.paginaActual = 0;
    this.loadProducts();
  }

  onSortSelect(value: string): void {
    this.sortBy = value as 'featured' | 'price_asc' | 'price_desc' | 'name_asc';
    this.onSortChange();
  }

  contadorFiltrosActivos(): number {
    return this.categoriaSeleccionada.length + this.marcaSeleccionada.length;
  }

  getNombreCategoria(id: number): string {
    return this.categorias.find(c => c.id === id)?.name ?? '';
  }

  getNombreMarca(id: number): string {
    return this.marcasDisponibles.find(m => m.id === id)?.name ?? '';
  }

  aplicarFiltrosYCerrar(): void {
    this.aplicarFiltros();
    this.cerrarFiltros();
  }

  performSearch(): void {
    this.searchSubject.next(this.searchQuery);
  }

  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }

  navigateToCart(): void {
    this.router.navigate(['/carrito']);
  }

  navigateToHome(): void {
    this.router.navigate(['/home']);
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
    this.voiceSearchService.stopListening(this.voiceSourceId);
    this.clearWakingTimer();
    this.loadProductsSub?.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Precio efectivo: discountPrice si existe, si no price. */
  getEffectivePrice(p: PublicProduct): number {
    return p.discountPrice ?? p.price;
  }

  /** Porcentaje de descuento redondeado. */
  getDiscountPercent(p: PublicProduct): number {
    if (!p.discountPrice || p.discountPrice >= p.price) return 0;
    return Math.round((1 - p.discountPrice / p.price) * 100);
  }
}
