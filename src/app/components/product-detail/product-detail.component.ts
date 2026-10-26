import { Component, OnInit, OnDestroy, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subject, Subscription } from 'rxjs';
import { distinctUntilChanged, skip, takeUntil } from 'rxjs/operators';
import { PublicApiService } from '../../services/public-api.service';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { PublicProduct, PublicProductAttribute, ProductRecommendation, ProductTrendStatus } from '../../models/product.model';
import { ProductRecommendationCardComponent } from './product-recommendation-card/product-recommendation-card.component';
import { ProductReviewsComponent } from '../product-reviews/product-reviews.component';
import { A11yModule } from '@angular/cdk/a11y';
import { ConnectivityService } from '../../services/connectivity.service';

export interface TechnicalSpecItem {
  label: string;
  value: string;
  icon: string;
  isCode?: boolean;
  isStatus?: boolean;
  inStock?: boolean;
}

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ProductRecommendationCardComponent, ProductReviewsComponent, A11yModule],
  templateUrl: './product-detail.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./product-detail.component.css']
})
export class ProductDetailComponent implements OnInit, OnDestroy {
  product: PublicProduct | null = null;

  loading = true;
  serverWaking = false;
  error: string | null = null;

  // Galería de imágenes
  selectedImageIndex = 0;
  showGalleryModal = false;
  
  // Pan and Zoom (UX Pro Max)
  zoomSteps = [1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
  zoomScale = 1;
  panX = 0;
  panY = 0;
  isPanning = false;
  hasDragged = false;
  
  // Loading & Error states for Lightbox
  isLightboxImageLoading = false;
  lightboxImageError = false;

  private startX = 0;
  private startY = 0;
  private lastPanX = 0;
  private lastPanY = 0;
  
  // Geometría Cacheada
  private maxPanX = 0;
  private maxPanY = 0;
  private rafId: number | null = null;
  private pendingPanX = 0;
  private pendingPanY = 0;

  // Selector de cantidad
  quantity = 1;

  // Estado de autenticación
  isLoggedIn = false;

  // Añadiendo al carrito
  addingToCart = false;

  // Recomendaciones y Tendencia (Prioridad 2 - Carga Secundaria No Bloqueante)
  recommendations: ProductRecommendation[] = [];
  loadingRecommendations = false;
  trendStatus: ProductTrendStatus | null = null;
  loadingTrend = false;
  addingToCartMap: { [key: number]: boolean } = {};

  // Scroll Lock Backup
  private previousHtmlOverflow = '';
  private previousBodyOverflow = '';
  private previousBodyPaddingRight = '';

  private destroy$ = new Subject<void>();
  private productSub?: Subscription;
  private recommendationsSub?: Subscription;
  private trendSub?: Subscription;
  private wakingTimer: ReturnType<typeof setTimeout> | null = null;
  private secondaryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private publicApiService: PublicApiService,
    private cartService: CartService,
    private authService: AuthService,
    private sanitizer: DomSanitizer,
    private connectivityService: ConnectivityService
  ) {}

  get isOnline(): boolean {
    return this.connectivityService.isOnline;
  }

  currentProductId: number | null = null;

  ngOnInit(): void {
    this.authService.getCurrentUser().pipe(takeUntil(this.destroy$)).subscribe(user => {
      this.isLoggedIn = !!user;
    });

    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const productId = +params['id'];
      if (productId && !isNaN(productId)) {
        this.currentProductId = productId;
        this.loadProduct(productId);
      } else {
        this.error = 'Producto no encontrado';
        this.loading = false;
      }
    });

    this.connectivityService.isOnline$.pipe(
      distinctUntilChanged(),
      skip(1),
      takeUntil(this.destroy$)
    ).subscribe(online => {
      if (online && this.error && this.currentProductId) {
        this.loadProduct(this.currentProductId);
      }
    });
  }

  retryLoadProduct(): void {
    if (this.currentProductId) {
      this.loadProduct(this.currentProductId);
    }
  }

  private clearTimers(): void {
    if (this.wakingTimer) {
      clearTimeout(this.wakingTimer);
      this.wakingTimer = null;
    }
    if (this.secondaryTimer) {
      clearTimeout(this.secondaryTimer);
      this.secondaryTimer = null;
    }
    this.serverWaking = false;
  }

  ngOnDestroy(): void {
    if (this.showGalleryModal) {
      this.restoreScroll();
    }
    this.clearTimers();
    this.productSub?.unsubscribe();
    this.recommendationsSub?.unsubscribe();
    this.trendSub?.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadProduct(id: number): void {
    // Cancelar peticiones anteriores si el usuario cambió de producto rápidamente
    this.productSub?.unsubscribe();
    this.recommendationsSub?.unsubscribe();
    this.trendSub?.unsubscribe();
    this.clearTimers();

    this.error = null;
    this.selectedImageIndex = 0;
    this.quantity = 1;
    this.trendStatus = null;
    this.recommendations = [];
    this.loadingRecommendations = false;
    this.loadingTrend = false;

    // 1. Hidratación instantánea si el producto ya fue cargado en /catalogo o /home
    const cachedSnapshot = this.publicApiService.getCachedProductSnapshot(id);
    if (cachedSnapshot) {
      this.product = cachedSnapshot;
      this.loading = false;
      this.scheduleSecondaryLoads(id);

      // Revalidar en segundo plano para actualizar Cache Storage del Service Worker (Offline + F5)
      this.productSub = this.publicApiService.getProductById(id).pipe(takeUntil(this.destroy$)).subscribe({
        next: (freshProduct) => {
          this.product = freshProduct;
        },
        error: () => {
          // Conservamos el snapshot ya renderizado en pantalla
        }
      });
      return;
    }

    // 2. Carga directa (URL directa o F5): mostrar skeleton estructurado y gestionar cold start
    this.product = null;
    this.loading = true;

    if (this.connectivityService.isOnline) {
      this.wakingTimer = setTimeout(() => {
        if (this.loading && this.connectivityService.isOnline) {
          this.serverWaking = true;
        }
      }, 3200);
    }

    this.productSub = this.publicApiService.getProductById(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (product) => {
        this.clearTimers();
        this.product = product;
        this.loading = false;
        // Prioridad 2: iniciar cargas secundarias DESPUÉS de que el producto principal ya está listo
        this.scheduleSecondaryLoads(product.id);
      },
      error: (err) => {
        this.clearTimers();
        if (!this.connectivityService.isOnline || err?.status === 0 || err?.error?.offline) {
          this.error = 'No hay información guardada para este producto. Conéctate a Internet para consultarlo.';
        } else if (err.status === 404) {
          this.error = 'Producto no encontrado';
        } else {
          this.error = 'El servidor está tardando en responder. Inténtalo de nuevo en unos momentos.';
        }
        this.loading = false;
      }
    });
  }

  /**
   * Ejecuta las peticiones secundarias no críticas (tendencia y recomendaciones)
   * después de renderizar el bloque principal del producto.
   */
  private scheduleSecondaryLoads(productId: number): void {
    if (!this.connectivityService.isOnline) {
      return;
    }
    this.secondaryTimer = setTimeout(() => {
      if (this.currentProductId === productId && this.product) {
        this.loadRecommendations(productId);
        this.loadTrendStatus(productId);
      }
    }, 60);
  }

  // ── Galería ────────────────────────────────────────────────────────────────

  /** Devuelve todas las URLs de imagen: primero imageUrl, luego las adicionales */
  get allImages(): string[] {
    if (!this.product) return [];
    const extras = (this.product.images ?? [])
      .slice()
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      .map(i => i.url)
      .filter(Boolean);
    if (this.product.imageUrl) {
      return [this.product.imageUrl, ...extras.filter(u => u !== this.product!.imageUrl)];
    }
    return extras.length ? extras : [];
  }

  readonly fallbackImageUrl =
    "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23FAF8F5'/%3E%3Ccircle cx='200' cy='180' r='54' fill='%23722F37' fill-opacity='0.08'/%3E%3Cpath d='M212 145v58.5a19.5 19.5 0 1 1-11-17.55V132h29v13h-18z' fill='%23722F37' fill-opacity='0.45'/%3E%3Ctext x='200' y='272' text-anchor='middle' font-family='sans-serif' font-size='14' font-weight='600' fill='%2364748B'%3ECasa de M%C3%BAsica Castillo%3C/text%3E%3C/svg%3E";

  get currentImage(): string {
    const imgs = this.allImages;
    return imgs[this.selectedImageIndex] ?? this.fallbackImageUrl;
  }

  onProductImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img && img.src !== this.fallbackImageUrl) {
      img.src = this.fallbackImageUrl;
    }
  }

  selectImage(index: number): void {
    if (this.selectedImageIndex !== index) {
      this.isLightboxImageLoading = true;
      this.lightboxImageError = false;
    }
    this.selectedImageIndex = index;
    if (this.showGalleryModal) {
      this.resetZoom();
      this.preloadAdjacentImages();
    }
  }

  openGallery(): void {
    if (this.allImages.length === 0) return;
    this.showGalleryModal = true;
    this.isLightboxImageLoading = true;
    this.lightboxImageError = false;
    this.resetZoom();
    this.lockScroll();
    this.preloadAdjacentImages();
  }

  closeGallery(): void {
    this.showGalleryModal = false;
    this.resetZoom();
    this.restoreScroll();
  }
  
  // Callback desde HTML (img load)
  onLightboxImageLoad(): void {
    this.isLightboxImageLoading = false;
    this.recalculateBounds();
  }
  
  // Callback desde HTML (img error)
  onLightboxImageError(): void {
    this.isLightboxImageLoading = false;
    this.lightboxImageError = true;
  }
  
  retryLightboxImage(): void {
    this.isLightboxImageLoading = true;
    this.lightboxImageError = false;
    // Forzar recarga mediante truco de query param si fuera necesario, 
    // pero usualmente solo reasignar la variable dispara el intento.
    const currentImages = this.allImages;
    if (currentImages[this.selectedImageIndex]) {
       // Angular detectará el mismo string, así que lo dejamos así o forzamos change detection
    }
  }

  private preloadAdjacentImages(): void {
    const images = this.allImages;
    if (images.length <= 1) return;
    
    const prevIndex = this.selectedImageIndex > 0 ? this.selectedImageIndex - 1 : images.length - 1;
    const nextIndex = this.selectedImageIndex < images.length - 1 ? this.selectedImageIndex + 1 : 0;
    
    const imgPrev = new Image();
    imgPrev.src = images[prevIndex];
    
    const imgNext = new Image();
    imgNext.src = images[nextIndex];
  }

  private lockScroll(): void {
    const html = document.documentElement;
    const body = document.body;
    
    this.previousHtmlOverflow = html.style.overflow;
    this.previousBodyOverflow = body.style.overflow;
    this.previousBodyPaddingRight = body.style.paddingRight;
    
    // Calcular ancho de la scrollbar para evitar layout shift
    const scrollbarWidth = window.innerWidth - html.clientWidth;
    
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }

  private restoreScroll(): void {
    const html = document.documentElement;
    const body = document.body;
    
    html.style.overflow = this.previousHtmlOverflow;
    body.style.overflow = this.previousBodyOverflow;
    body.style.paddingRight = this.previousBodyPaddingRight;
  }

  previousImage(event: Event): void {
    event.stopPropagation();
    if (this.selectedImageIndex > 0) {
      this.selectImage(this.selectedImageIndex - 1);
    } else {
      this.selectImage(this.allImages.length - 1);
    }
  }

  nextImage(event: Event): void {
    event.stopPropagation();
    if (this.selectedImageIndex < this.allImages.length - 1) {
      this.selectImage(this.selectedImageIndex + 1);
    } else {
      this.selectImage(0);
    }
  }

  // ── Zoom y Pan ─────────────────────────────────────────────────────────────

  zoomIn(): void {
    const nextIndex = this.zoomSteps.findIndex(s => s > this.zoomScale);
    if (nextIndex !== -1) {
      this.zoomScale = this.zoomSteps[nextIndex];
      this.recalculateBounds();
    }
  }

  zoomOut(): void {
    // Buscar el paso anterior más cercano
    let prevStep = 1;
    for (let i = this.zoomSteps.length - 1; i >= 0; i--) {
      if (this.zoomSteps[i] < this.zoomScale) {
        prevStep = this.zoomSteps[i];
        break;
      }
    }
    this.zoomScale = prevStep;
    if (this.zoomScale === 1) {
      this.resetZoom();
    } else {
      this.recalculateBounds();
    }
  }

  resetZoom(): void {
    this.zoomScale = 1;
    this.panX = 0;
    this.panY = 0;
    this.lastPanX = 0;
    this.lastPanY = 0;
    this.maxPanX = 0;
    this.maxPanY = 0;
  }

  // Double click en desktop
  onImageDoubleClick(event: MouseEvent): void {
    event.stopPropagation();
    if (this.zoomScale === 1) {
      this.zoomScale = 2; // Jump to 200%
      this.recalculateBounds();
    } else {
      this.resetZoom();
    }
  }
  
  // Wheel Zoom (Ctrl + Wheel)
  onWheel(event: WheelEvent): void {
    if (event.ctrlKey) {
      event.preventDefault(); // Prevenir zoom del navegador completo solo si es ctrl+wheel
      if (event.deltaY < 0) {
        this.zoomIn();
      } else {
        this.zoomOut();
      }
    }
  }

  // Geometría para Boundaries
  recalculateBounds(): void {
    if (this.zoomScale <= 1) {
      this.maxPanX = 0;
      this.maxPanY = 0;
      this.panX = 0;
      this.panY = 0;
      this.lastPanX = 0;
      this.lastPanY = 0;
      return;
    }
    
    // Obtenemos el viewport real (Image Stage)
    const stage = document.querySelector('.lightbox-viewport');
    const img = document.querySelector('.lightbox-viewport img');
    if (!stage || !img) return;
    
    const viewportWidth = stage.clientWidth;
    const viewportHeight = stage.clientHeight;
    
    // Dimensiones lógicas calculadas por object-fit contain
    const imgEl = img as HTMLImageElement;
    const renderedWidth = imgEl.clientWidth;
    const renderedHeight = imgEl.clientHeight;
    
    // Calculamos si la imagen escalada excede el viewport
    this.maxPanX = Math.max(0, (renderedWidth * this.zoomScale - viewportWidth) / 2);
    this.maxPanY = Math.max(0, (renderedHeight * this.zoomScale - viewportHeight) / 2);
    
    // Clamp actual pan positions
    this.panX = Math.max(-this.maxPanX, Math.min(this.maxPanX, this.panX));
    this.panY = Math.max(-this.maxPanY, Math.min(this.maxPanY, this.panY));
    this.lastPanX = this.panX;
    this.lastPanY = this.panY;
  }

  onPointerDown(event: PointerEvent): void {
    if (this.zoomScale <= 1) return;
    event.preventDefault();
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    this.isPanning = true;
    this.hasDragged = false;
    this.startX = event.clientX;
    this.startY = event.clientY;
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.isPanning) return;
    event.preventDefault();
    
    const dx = event.clientX - this.startX;
    const dy = event.clientY - this.startY;
    
    // Detección de arrastre real (mínimo 3px) para evitar tap
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      this.hasDragged = true;
    }
    
    this.pendingPanX = this.lastPanX + dx;
    this.pendingPanY = this.lastPanY + dy;
    
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => this.applyPan());
    }
  }
  
  private applyPan(): void {
    this.panX = Math.max(-this.maxPanX, Math.min(this.maxPanX, this.pendingPanX));
    this.panY = Math.max(-this.maxPanY, Math.min(this.maxPanY, this.pendingPanY));
    this.rafId = null;
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.isPanning) return;
    this.isPanning = false;
    
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.applyPan();
    }
    
    this.lastPanX = this.panX;
    this.lastPanY = this.panY;
    (event.target as HTMLElement).releasePointerCapture(event.pointerId);
  }
  
  onBackdropClick(event: MouseEvent): void {
    // Solo cerrar si el click es directamente en el viewport o overlay, no en controles ni imagen
    // Y solo si no ha sido parte de un arrastre
    const target = event.target as HTMLElement;
    if (target.classList.contains('lightbox-viewport') || target.classList.contains('cmc-lightbox-overlay')) {
      if (!this.hasDragged) {
        this.closeGallery();
      }
    }
    // Si cliquea cualquier otra parte, reseteamos el flag para futuros clicks
    setTimeout(() => this.hasDragged = false, 0);
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.showGalleryModal) {
      this.recalculateBounds();
    }
  }

  // ── Precio ─────────────────────────────────────────────────────────────────

  get effectivePrice(): number {
    return this.product?.discountPrice ?? this.product?.price ?? 0;
  }

  get discountPercent(): number {
    if (!this.product?.discountPrice || !this.product?.price) return 0;
    return Math.round((1 - this.product.discountPrice / this.product.price) * 100);
  }

  // ── Stock / Cantidad ───────────────────────────────────────────────────────

  get inStock(): boolean {
    return (this.product?.stock ?? 0) > 0;
  }

  incrementQuantity(): void {
    if (this.product && this.quantity < this.product.stock) {
      this.quantity++;
    }
  }

  decrementQuantity(): void {
    if (this.quantity > 1) this.quantity--;
  }

  normalizeQuantity(): void {
    if (!this.product) return;
    
    if (this.quantity == null || isNaN(this.quantity)) {
      this.quantity = 1;
    } else {
      this.quantity = Math.floor(Number(this.quantity));
    }

    if (this.quantity < 1) {
      this.quantity = 1;
    } else if (this.quantity > this.product.stock) {
      this.quantity = this.product.stock;
    }
  }

  // ── Estrellas ──────────────────────────────────────────────────────────────

  getStars(rating: number): boolean[] {
    return Array(5).fill(false).map((_, i) => i < Math.round(rating));
  }

  // ── Carrito ────────────────────────────────────────────────────────────────

  addToCart(event?: MouseEvent): void {
    if (!this.product) return;

    if (!this.connectivityService.isOnline) {
      this.connectivityService.notifyOfflineAction('Agregar al carrito requiere conexión a Internet.');
      return;
    }

    if (!this.isLoggedIn) {
      this.router.navigate(['/login'], {
        queryParams: { returnUrl: `/producto/${this.product.id}` }
      });
      return;
    }

    this.addingToCart = true;
    const buttonElement = event?.currentTarget as HTMLElement;
    const rect = buttonElement?.getBoundingClientRect();

    this.cartService.addToCart(this.product as any, this.quantity, undefined, {
      x: rect ? rect.left + rect.width / 2 : window.innerWidth / 2,
      y: rect ? rect.top + rect.height / 2 : window.innerHeight / 2
    });

    setTimeout(() => { this.addingToCart = false; }, 500);
  }

  onAddRecommendationToCart(rec: ProductRecommendation): void {
    if (this.addingToCartMap[rec.productId]) return;

    if (!this.connectivityService.isOnline) {
      this.connectivityService.notifyOfflineAction('Agregar al carrito requiere conexión a Internet.');
      return;
    }

    if (!this.isLoggedIn) {
      this.router.navigate(['/login'], {
        queryParams: { returnUrl: `/producto/${this.product?.id}` }
      });
      return;
    }

    this.addingToCartMap[rec.productId] = true;

    const productLike = {
      id: rec.productId.toString(),
      name: rec.name,
      images: [rec.imageUrl || '/assets/icons/icon-192x192.png'],
      price: rec.effectivePrice,
      inStock: rec.stock > 0
    } as any;

    this.cartService.addToCart(productLike, 1, undefined, {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    });

    setTimeout(() => { this.addingToCartMap[rec.productId] = false; }, 500);
  }

  // ── Navegación ─────────────────────────────────────────────────────────────

  goBack(): void {
    this.router.navigate(['/catalogo']);
  }

  // ── Descripción y Especificaciones Técnicas ────────────────────────────────

  /**
   * Sanitiza el HTML de la descripción detallada para evitar XSS.
   */
  get safeDetailedDescription(): SafeHtml | null {
    if (!this.product?.detailedDescription || !this.product.detailedDescription.trim()) return null;
    return this.sanitizer.bypassSecurityTrustHtml(this.product.detailedDescription);
  }

  get hasTextDescription(): boolean {
    return Boolean(this.product?.description && this.product.description.trim().length > 0);
  }

  get savingsAmount(): number {
    if (!this.product?.discountPrice || !this.product?.price) return 0;
    if (this.product.discountPrice >= this.product.price) return 0;
    return this.product.price - this.product.discountPrice;
  }

  private loadTrendStatus(productId: number): void {
    this.trendSub?.unsubscribe();
    this.loadingTrend = true;
    this.trendSub = this.publicApiService.getProductTrendStatus(productId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (status) => {
        this.trendStatus = status;
        this.loadingTrend = false;
      },
      error: () => {
        this.loadingTrend = false;
      }
    });
  }

  private loadRecommendations(id: number): void {
    this.recommendationsSub?.unsubscribe();
    this.recommendations = [];
    this.loadingRecommendations = true;
    this.recommendationsSub = this.publicApiService.getRecommendations(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (recs) => {
        this.recommendations = recs || [];
        this.loadingRecommendations = false;
      },
      error: () => {
        this.recommendations = [];
        this.loadingRecommendations = false;
      }
    });
  }

  /**
   * Atributos dinámicos ordenados por displayOrder y filtrados de valores vacíos.
   */
  get sortedAttributes(): PublicProductAttribute[] {
    if (!this.product?.attributes?.length) return [];
    return this.product.attributes
      .filter(a => a && a.name && a.value != null && String(a.value).trim() !== '')
      .slice()
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  }

  /**
   * Construye la lista completa y ordenada de especificaciones reales del producto
   * (Categoría, Marca, Modelo, SKU, Disponibilidad, Peso, Dimensiones y Atributos dinámicos).
   */
  get technicalSpecs(): TechnicalSpecItem[] {
    if (!this.product) return [];
    const specs: TechnicalSpecItem[] = [];

    if (this.product.category?.name) {
      specs.push({
        label: 'Categoría',
        value: this.product.category.name,
        icon: 'category'
      });
    }

    if (this.product.brand?.name) {
      specs.push({
        label: 'Marca',
        value: this.product.brand.name,
        icon: 'verified'
      });
    }

    if (this.product.model && this.product.model.trim()) {
      specs.push({
        label: 'Modelo',
        value: this.product.model.trim(),
        icon: 'piano'
      });
    }

    if (this.product.sku && this.product.sku.trim()) {
      specs.push({
        label: 'Código / SKU',
        value: this.product.sku.trim(),
        icon: 'qr_code_2',
        isCode: true
      });
    }

    specs.push({
      label: 'Disponibilidad',
      value: this.inStock
        ? (this.product.stock <= 5
            ? `¡Últimas ${this.product.stock} pieza${this.product.stock === 1 ? '' : 's'}!`
            : `En existencia (${this.product.stock} disponibles)`)
        : 'Agotado temporalmente',
      icon: 'inventory_2',
      isStatus: true,
      inStock: this.inStock
    });

    if (this.product.weight != null && this.product.weight > 0) {
      specs.push({
        label: 'Peso aproximado',
        value: `${this.product.weight} kg`,
        icon: 'scale'
      });
    }

    if (this.product.dimensions && this.product.dimensions.trim()) {
      specs.push({
        label: 'Dimensiones',
        value: this.product.dimensions.trim(),
        icon: 'straighten'
      });
    }

    for (const attr of this.sortedAttributes) {
      specs.push({
        label: attr.name,
        value: String(attr.value).trim(),
        icon: 'tune'
      });
    }

    return specs;
  }

  /**
   * Indica si el producto cuenta con especificaciones físicas o dinámicas adicionales
   * además de Categoría, SKU y Disponibilidad.
   */
  get hasExtendedPhysicalOrCustomSpecs(): boolean {
    if (!this.product) return false;
    return Boolean(
      this.product.brand?.name ||
      (this.product.model && this.product.model.trim()) ||
      (this.product.weight != null && this.product.weight > 0) ||
      (this.product.dimensions && this.product.dimensions.trim()) ||
      this.sortedAttributes.length > 0
    );
  }

  /**
   * Compatibilidad con template: siempre que exista el producto, la sección de
   * ficha técnica se muestra con sus campos reales disponibles.
   */
  get hasSpecs(): boolean {
    return this.technicalSpecs.length > 0;
  }
}
