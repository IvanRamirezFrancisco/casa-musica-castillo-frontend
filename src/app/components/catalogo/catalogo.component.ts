import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, skip, takeUntil } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { PublicApiService } from '../../services/public-api.service';
import { WishlistService } from '../../services/wishlist.service';
import { User } from '../../models/user.model';
import { PublicProduct, PublicCategory, SpringPage } from '../../models/product.model';
import { ConnectivityService } from '../../services/connectivity.service';

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
  searchQuery = '';
  cartItemCount = 0;

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

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private publicApiService: PublicApiService,
    private cartService: CartService,
    private wishlistService: WishlistService,
    private connectivityService: ConnectivityService
  ) {}

  get isOnline(): boolean {
    return this.connectivityService.isOnline;
  }

  ngOnInit(): void {
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

    // Leer filtro de categoría y búsqueda desde query params
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const catId = params['categoryId'] ? +params['categoryId'] : (params['category'] ? +params['category'] : null);
      if (catId) {
        this.categoriaSeleccionada = [catId];
      }
      const busqueda = params['busqueda'];
      if (busqueda !== undefined) {
        this.searchQuery = busqueda;
      }
      this.loadProducts();
    });

    // Búsqueda con debounce de 400ms para no saturar el backend
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.paginaActual = 0;
      this.loadProducts();
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

    if (this.connectivityService.isOnline) {
      this.wakingTimer = setTimeout(() => {
        if (this.loading && this.connectivityService.isOnline) {
          this.serverWaking = true;
        }
      }, 3200);
    }

    this.loadProductsSub = this.publicApiService.getCatalog({
      keyword:    this.searchQuery.trim() || undefined,
      categoryId: this.categoriaSeleccionada.length === 1 ? this.categoriaSeleccionada[0] : undefined,
      brandId:    this.marcaSeleccionada.length === 1 ? this.marcaSeleccionada[0] : undefined,
      sortBy:     this.sortBy,
      page:       this.paginaActual,
      size:       this.tamanioPagina
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (page: SpringPage<PublicProduct>) => {
        this.clearWakingTimer();
        this.productos = page.content;
        this.totalProductos = page.totalElements;
        this.totalPaginas = page.totalPages;

        // Extraer marcas únicas de los resultados para el sidebar
        const marcasMap = new Map<number, string>();
        page.content.forEach(p => {
          if (p.brand) {
            marcasMap.set(p.brand.id, p.brand.name);
          }
        });
        this.marcasDisponibles = Array.from(marcasMap.entries()).map(([id, name]) => ({ id, name }));

        this.loading = false;
      },
      error: (err) => {
        this.clearWakingTimer();
        if (!this.connectivityService.isOnline || err?.status === 0 || err?.error?.offline) {
          this.error = 'No hay información guardada para esta consulta. Conéctate a Internet para actualizar el catálogo.';
        } else {
          this.error = 'El servidor está tardando en responder. Inténtalo de nuevo en unos segundos.';
        }
        this.loading = false;
      }
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

  /** Aplica filtros relanzando la llamada al backend (nunca en memoria). */
  aplicarFiltros(): void {
    this.paginaActual = 0;
    this.loadProducts();
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

  limpiarFiltros(): void {
    this.categoriaSeleccionada = [];
    this.marcaSeleccionada = [];
    this.precioMin = 0;
    this.precioMax = 100000;
    this.searchQuery = '';
    this.aplicarFiltros();
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
