import { Component, OnInit, OnDestroy, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { CartService, CartAnimation } from '../../services/cart.service';
import { WishlistService } from '../../services/wishlist.service';
import { User } from '../../models/user.model';
import { GlobalSearchComponent } from '../global-search/global-search.component';
import { Subscription, filter } from 'rxjs';

@Component({
  selector: 'app-main-header',
  imports: [CommonModule, RouterModule, FormsModule, GlobalSearchComponent],
  templateUrl: './main-header.component.html',
  styleUrl: './main-header.component.css',
  host: {
    '(document:click)': 'onDocumentClick($event)'
  }
})
export class MainHeaderComponent implements OnInit, OnDestroy {
  @ViewChild('mobileMenuBtn') mobileMenuBtn!: ElementRef<HTMLButtonElement>;

  cartItemCount = 0;
  wishlistCount = 0;  // alimentado por WishlistService.wishlistCount$
  
  // Usuario logueado
  isLoggedIn = false;
  currentUser: User | null = null;
  showUserMenu = false;
  showInfoMenu = false;
  isMobileMenuOpen = false;
  isMobileSearchOpen = false;
  isSearchActive = false;
  
  // Header inteligente
  isHeaderVisible = true;
  isHeaderCompact = false;
  lastScrollPosition = 0;
  scrollDirection: 'up' | 'down' = 'up';
  
  // Animación de productos
  flyingProducts: CartAnimation[] = [];
  private subscriptions = new Subscription();
  private resizeTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private router: Router,
    private authService: AuthService,
    private cartService: CartService,
    private wishlistService: WishlistService
  ) {}

  ngOnInit(): void {
    // Verificar si el usuario está logueado
    this.authService.getCurrentUser().subscribe((user: User | null) => {
      this.currentUser = user;
      this.isLoggedIn = !!user;
    });
    
    // Suscribirse al contador del carrito
    this.subscriptions.add(
      this.cartService.cartCount$.subscribe(count => {
        this.cartItemCount = count;
      })
    );

    // Suscribirse al contador de la wishlist
    this.subscriptions.add(
      this.wishlistService.wishlistCount$.subscribe(count => {
        this.wishlistCount = count;
      })
    );
    
    // Suscribirse a las animaciones de productos
    this.subscriptions.add(
      this.cartService.addToCartAnimation$.subscribe(animation => {
        this.triggerFlyToCartAnimation(animation);
      })
    );

    // Cerrar menú al cambiar ruta en móviles y desktop
    this.subscriptions.add(
      this.router.events.pipe(
        filter(event => event instanceof NavigationEnd)
      ).subscribe(() => {
        this.closeMobileMenu();
        this.closeInfoMenu();
      })
    );
  }
  
  ngOnDestroy(): void {
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }
    this.subscriptions.unsubscribe();
    this.closeMobileMenu(); // Ensures body scroll is restored
  }
  
  triggerFlyToCartAnimation(animation: CartAnimation): void {
    // Agregar producto a la lista de animaciones
    this.flyingProducts.push(animation);
    
    // Eliminar después de que termine la animación (1.2 segundos)
    setTimeout(() => {
      const index = this.flyingProducts.findIndex(p => p.productId === animation.productId);
      if (index > -1) {
        this.flyingProducts.splice(index, 1);
      }
    }, 1200);
  }

  get interactionLocked(): boolean {
    return this.isMobileMenuOpen || this.showUserMenu || this.showInfoMenu || this.isMobileSearchOpen || this.isSearchActive;
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    // Si hay interacción abierta (menú móvil o dropdowns), el header no se oculta
    if (this.interactionLocked) {
      this.isHeaderVisible = true;
      return;
    }

    const currentScroll = window.scrollY || document.documentElement.scrollTop;

    if (currentScroll < 50) {
      this.isHeaderVisible = true;
      this.isHeaderCompact = false;
    } else {
      this.isHeaderCompact = true;
      
      const delta = currentScroll - this.lastScrollPosition;
      
      // Umbral mínimo para considerar movimiento (previene temblor)
      if (Math.abs(delta) > 10) {
        if (delta > 0 && currentScroll > 120) {
          // Bajando
          this.isHeaderVisible = false;
          this.scrollDirection = 'down';
        } else if (delta < 0) {
          // Subiendo
          this.isHeaderVisible = true;
          this.scrollDirection = 'up';
        }
      }
    }

    this.lastScrollPosition = currentScroll;
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any): void {
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }
    this.resizeTimeout = setTimeout(() => {
      // Limpiar estados móviles al pasar a escritorio (>= 768px)
      if (window.innerWidth >= 768) {
        if (this.isMobileSearchOpen) {
          this.isMobileSearchOpen = false;
        }
        if (this.isMobileMenuOpen) {
          this.closeMobileMenu();
        }
      }
    }, 150); // Debounce moderado
  }

  @HostListener('window:keydown.escape', ['$event'])
  onEscape(event: KeyboardEvent): void {
    if (this.showInfoMenu) {
      this.closeInfoMenu();
    }
    if (this.isMobileMenuOpen) {
      this.closeMobileMenu();
      if (this.mobileMenuBtn?.nativeElement) {
        this.mobileMenuBtn.nativeElement.focus();
      }
    }
  }

  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const userMenuContainer = target.closest('.user-menu-container');
    const infoMenuContainer = target.closest('.dropdown-nav');
    
    if (!userMenuContainer && this.showUserMenu) {
      this.showUserMenu = false;
    }
    
    if (!infoMenuContainer && this.showInfoMenu) {
      this.showInfoMenu = false;
    }
    
    // El global-search maneja su propio click-outside para cerrarse o cerrar el panel
  }

  onSearchActiveChange(active: boolean): void {
    this.isSearchActive = active;
  }

  toggleMobileSearch(): void {
    this.isMobileSearchOpen = !this.isMobileSearchOpen;
    if (this.isMobileSearchOpen) {
      this.showUserMenu = false;
      this.showInfoMenu = false;
      this.isMobileMenuOpen = false;
    }
  }

  closeMobileSearch(): void {
    this.isMobileSearchOpen = false;
  }

  toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
    if (this.showUserMenu) {
      this.showInfoMenu = false;
    }
  }

  closeUserMenu(): void {
    this.showUserMenu = false;
  }

  toggleInfoMenu(): void {
    this.showInfoMenu = !this.showInfoMenu;
    if (this.showInfoMenu) {
      this.showUserMenu = false;
    }
  }

  closeInfoMenu(): void {
    this.showInfoMenu = false;
  }

  toggleWishlist(): void {
    this.router.navigate(['/wishlist']);
  }

  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }

  navigateToCart(): void {
    this.router.navigate(['/carrito']);
  }

  navigateToProfile(): void {
    this.closeUserMenu();
    this.router.navigate(['/dashboard/seguridad']);
  }

  navigateToAdmin(): void {
    this.closeUserMenu();
    this.router.navigate(['/admin']);
  }

  isAdminUser(): boolean {
    return this.authService.isAdmin() || this.authService.isSuperAdmin();
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    if (this.isMobileMenuOpen) {
      this.isMobileSearchOpen = false;
      document.body.style.overflow = 'hidden'; // Prevenir scroll cuando el menú está abierto
    } else {
      document.body.style.overflow = '';
    }
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
    document.body.style.overflow = '';
  }

  @HostListener('window:keydown.Escape', ['$event'])
  onEscapePress(event: KeyboardEvent): void {
    if (this.isMobileMenuOpen) {
      this.closeMobileMenu();
    }
  }

  logout(): void {
    this.closeUserMenu();
    this.closeMobileMenu();
    this.authService.logout();
    this.isLoggedIn = false;
    this.currentUser = null;
    this.router.navigate(['/home']);
  }
}

