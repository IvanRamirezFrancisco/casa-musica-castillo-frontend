import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { PublicApiService } from '../../services/public-api.service';
import { User } from '../../models/user.model';
import { PublicProduct, PublicCategory, PublicTrendingProduct } from '../../models/product.model';
import { ConnectivityService } from '../../services/connectivity.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  host: {
    '(document:click)': 'onDocumentClick($event)'
  }
})
export class HomeComponent implements OnInit, OnDestroy {
  searchQuery = '';
  cartItemCount = 3;
  emailSubscription = '';

  // Usuario logueado
  isLoggedIn = false;
  currentUser: User | null = null;
  showUserMenu = false;

  // Datos reales del backend
  featuredProducts: PublicProduct[] = [];
  latestProducts: PublicProduct[] = [];
  trendingProducts: PublicTrendingProduct[] = [];
  categories: PublicCategory[] = [];
  loadingFeatured = true;
  loadingTrending = true;
  trendingError = false;
  trendingEmpty = false;
  loadingCategories = true;
  categoriesError = false;
  categoriesEmpty = false;

  // ── Hero Slider ────────────────────────────────────────────────────────────
  currentSlide = 0;
  hasInteractedOrAutoplayed = false;
  private sliderInterval?: ReturnType<typeof setInterval>;
  private initialTimeout?: ReturnType<typeof setTimeout>;

  heroSlides = [
    {
      imageUrl: 'https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_1600/v1790057931/negocio1_dfuoko.png',
      srcset: 'https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_640/v1790057931/negocio1_dfuoko.png 640w, https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_768/v1790057931/negocio1_dfuoko.png 768w, https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_1200/v1790057931/negocio1_dfuoko.png 1200w, https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_1600/v1790057931/negocio1_dfuoko.png 1600w',
      tag: 'Casa de Música Castillo',
      title: 'Tu Pasión,\nNuestros Instrumentos',
      subtitle: 'Descubre la colección más completa de instrumentos musicales. Calidad profesional para cada nivel.',
      cta: 'Explorar Catálogo',
      ctaLink: '/catalogo',
      ctaParams: {},
      align: 'left',
    },
    {
      imageUrl: 'https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_1600/v1790057930/negocio_dkwtdw.png',
      srcset: 'https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_640/v1790057930/negocio_dkwtdw.png 640w, https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_768/v1790057930/negocio_dkwtdw.png 768w, https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_1200/v1790057930/negocio_dkwtdw.png 1200w, https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_1600/v1790057930/negocio_dkwtdw.png 1600w',
      tag: 'Guitarras Premium',
      title: 'Guitarras Para\nCada Músico',
      subtitle: 'Desde el primer acorde hasta el escenario profesional. Modelos acústicos, eléctricos y clásicos.',
      cta: 'Ver Guitarras',
      ctaLink: '/catalogo',
      ctaParams: { categoria: 'guitarras' },
      align: 'left',
    },
    {
      imageUrl: 'https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_1600/v1790057931/negocio1_dfuoko.png',
      srcset: 'https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_640/v1790057931/negocio1_dfuoko.png 640w, https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_768/v1790057931/negocio1_dfuoko.png 768w, https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_1200/v1790057931/negocio1_dfuoko.png 1200w, https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_1600/v1790057931/negocio1_dfuoko.png 1600w',
      tag: 'Envío a todo México',
      title: 'Sonido que\nInspira',
      subtitle: 'Pianos, teclados, baterías y mucho más. Encuentra el instrumento que lleva tu música al siguiente nivel.',
      cta: 'Ver Colección',
      ctaLink: '/catalogo',
      ctaParams: {},
      align: 'left',
    }
  ];

  goToSlide(index: number): void {
    this.hasInteractedOrAutoplayed = true;
    this.currentSlide = index;
    if (this.initialTimeout) clearTimeout(this.initialTimeout);
    this.resetSliderTimer();
  }

  private startAutoplayWithDelay(): void {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    this.initialTimeout = setTimeout(() => {
      this.resetSliderTimer();
    }, 20000);
  }

  private resetSliderTimer(): void {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    if (this.sliderInterval) clearInterval(this.sliderInterval);
    this.sliderInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      this.hasInteractedOrAutoplayed = true;
      this.currentSlide = (this.currentSlide + 1) % this.heroSlides.length;
    }, 6000);
  }

  private destroy$ = new Subject<void>();

  constructor(
    public router: Router,
    private authService: AuthService,
    private publicApiService: PublicApiService,
    private connectivityService: ConnectivityService
  ) {}

  get isOnline(): boolean {
    return this.connectivityService.isOnline;
  }

  ngOnInit(): void {
    // Iniciar hero slider con retraso seguro para evitar penalización LCP
    this.startAutoplayWithDelay();

    // Verificar si el usuario está logueado
    this.authService.getCurrentUser().pipe(takeUntil(this.destroy$)).subscribe((user: User | null) => {
      this.currentUser = user;
      this.isLoggedIn = !!user;
    });

    // Cargar productos destacados reales
    this.publicApiService.getFeaturedProducts(0, 4).pipe(takeUntil(this.destroy$)).subscribe({
      next: (page) => {
        this.featuredProducts = page.content;
        this.loadingFeatured = false;
      },
      error: () => { this.loadingFeatured = false; }
    });

    // Cargar últimos productos
    this.publicApiService.getLatestProducts().pipe(takeUntil(this.destroy$)).subscribe({
      next: (products) => { this.latestProducts = products; },
      error: () => {}
    });

    // Cargar productos en tendencia (Solución 2)
    this.publicApiService.getTrendingProducts(8).pipe(takeUntil(this.destroy$)).subscribe({
      next: (products) => {
        this.trendingProducts = products;
        this.loadingTrending = false;
        this.trendingEmpty = products.length === 0;
      },
      error: () => {
        this.loadingTrending = false;
        this.trendingError = true;
      }
    });

    // Cargar categorías con productos activos
    this.publicApiService.getActiveCategories(true).pipe(takeUntil(this.destroy$)).subscribe({
      next: (cats) => {
        this.categories = cats;
        this.loadingCategories = false;
        this.categoriesEmpty = cats.length === 0;
      },
      error: () => {
        this.loadingCategories = false;
        this.categoriesError = true;
      }
    });
  }

  ngOnDestroy(): void {
    if (this.sliderInterval) clearInterval(this.sliderInterval);
    if (this.initialTimeout) clearTimeout(this.initialTimeout);
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

  getTrendingDiscountPercent(p: PublicTrendingProduct): number {
    if (!p.discountPrice || p.discountPrice >= p.regularPrice) return 0;
    return Math.round((1 - p.discountPrice / p.regularPrice) * 100);
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

  getCategoryIcon(name: string): string {
    if (!name) return 'category';
    const lower = name.toLowerCase();
    if (lower.includes('guitar')) return 'music_note';
    if (lower.includes('piano') || lower.includes('teclad')) return 'piano';
    if (lower.includes('bateria') || lower.includes('percusion')) return 'music_note'; // Material doesn't have a drum icon by default, music_note is generic
    if (lower.includes('viento') || lower.includes('saxo') || lower.includes('trompet')) return 'music_note';
    if (lower.includes('cuerda') || lower.includes('violin') || lower.includes('violon')) return 'music_note';
    if (lower.includes('amp')) return 'speaker';
    if (lower.includes('audio') || lower.includes('micro') || lower.includes('dj')) return 'mic';
    if (lower.includes('accesorio') || lower.includes('cable')) return 'settings';
    return 'category';
  }

  specialProduct = {
    name: 'Guitarra Premium Edición Limitada',
    description: 'Una guitarra excepcional con acabados únicos, perfecta para músicos profesionales.',
    price: 1299,
    originalPrice: 1599,
    discount: 19,
    features: [
      'Madera de caoba premium',
      'Pastillas profesionales',
      'Acabado artesanal único',
      'Incluye estuche premium',
      'Garantía extendida de 3 años'
    ]
  };

  soundDemos = [
    { id: 'demo1', title: 'Jarana Huasteca Premium', instrument: 'Jaranas', videoId: 'demo1', thumbnail: 'https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_600/v1790057930/negocio_dkwtdw.png' },
    { id: 'demo2', title: 'Guitarra Acústica Artesanal', instrument: 'Guitarras', videoId: 'demo2', thumbnail: 'https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_600/v1790057931/negocio1_dfuoko.png' },
    { id: 'demo3', title: 'Micrófono Condensador Estudio', instrument: 'Audio Pro', videoId: 'demo3', thumbnail: 'https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_600/v1790057930/negocio_dkwtdw.png' },
    { id: 'demo4', title: 'Batería Acústica 5 Piezas', instrument: 'Baterías', videoId: 'demo4', thumbnail: 'https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_600/v1790057931/negocio1_dfuoko.png' }
  ];

  playDemo(demo: any) {
    // Placeholder para la integración real de video / reproductor de audio
    alert('Próximamente: Demostración de ' + demo.title);
  }

  performSearch() {
    if (this.searchQuery.trim()) {
      this.router.navigate(['/search'], { queryParams: { q: this.searchQuery } });
    }
  }

  navigateToCategory(categoryId: number | string) {
    this.router.navigate(['/catalogo'], { queryParams: { categoryId } });
  }

  navigateToCart() {
    this.router.navigate(['/cart']);
  }



  addToCart(product: any) {
    this.cartItemCount++;
  }

  subscribeNewsletter() {
    if (this.emailSubscription.trim()) {
      this.emailSubscription = '';
    }
  }

  addSpecialToCart() {
    this.cartItemCount++;
  }

  viewProductDetails() {
    this.router.navigate(['/product-details'], { queryParams: { id: 'special' } });
  }

  navigateToLogin() { this.router.navigate(['/login']); }
  navigateToRegister() { this.router.navigate(['/register']); }
  navigateToCatalog() { this.router.navigate(['/catalogo']); }
  navigateToHelp() { this.router.navigate(['/ayuda']); }

  onImageError(event: any): void {
    event.target.src = '/https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_400/v1782840424/Dise%C3%B1o_sin_t%C3%ADtulo_4_xruh6t.png';
  }
}
