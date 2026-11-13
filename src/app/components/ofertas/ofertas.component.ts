import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { User } from '../../models/user.model';
import { Product } from '../../models/product.model';

@Component({
  selector: 'app-ofertas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './ofertas.component.html',
  styleUrl: './ofertas.component.css',
  changeDetection: ChangeDetectionStrategy.Eager,
  host: {
    '(document:click)': 'onDocumentClick($event)'
  }
})
export class OfertasComponent implements OnInit {
  searchQuery = '';
  cartItemCount = 0;

  // Usuario logueado
  isLoggedIn = false;
  currentUser: User | null = null;
  showUserMenu = false;

  // Productos en oferta
  ofertas: Product[] = [];
  loading = true;

  // Ordenamiento
  sortBy: 'discount' | 'price' | 'name' = 'discount';

  constructor(
    private router: Router,
    private authService: AuthService,
    private productService: ProductService,
    private cartService: CartService
  ) {}

  ngOnInit(): void {
    // Verificar autenticación
    this.authService.getCurrentUser().subscribe((user: User | null) => {
      this.currentUser = user;
      this.isLoggedIn = !!user;
    });

    // Cargar productos en oferta
    this.loadOfertas();

    // Actualizar contador de carrito
    this.cartService.cartCount$.subscribe(count => {
      this.cartItemCount = count;
    });
  }

  loadOfertas(): void {
    this.loading = true;
    this.productService.getDiscountedProducts().subscribe({
      next: (products) => {
        this.ofertas = products;
        this.applySorting();
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
      }
    });
  }

  applySorting(): void {
    switch (this.sortBy) {
      case 'discount':
        this.ofertas.sort((a, b) => (b.discount || 0) - (a.discount || 0));
        break;
      case 'price':
        this.ofertas.sort((a, b) => a.price - b.price);
        break;
      case 'name':
        this.ofertas.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
  }

  changeSorting(sortBy: 'discount' | 'price' | 'name'): void {
    this.sortBy = sortBy;
    this.applySorting();
  }

  verDetalle(producto: Product): void {
    this.router.navigate(['/producto', producto.id]);
  }

  agregarAlCarrito(producto: Product, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }

    if (!this.isLoggedIn) {
      // Redirigir al login si no está autenticado
      this.router.navigate(['/login'], { 
        queryParams: { returnUrl: this.router.url } 
      });
      return;
    }

    // Obtener coordenadas del botón para la animación
    const buttonElement = event?.currentTarget as HTMLElement;
    const rect = buttonElement?.getBoundingClientRect();
    
    // Agregar al carrito con animación
    this.cartService.addToCart(producto, 1, undefined, {
      x: rect ? rect.left + rect.width / 2 : window.innerWidth / 2,
      y: rect ? rect.top + rect.height / 2 : window.innerHeight / 2
    });
  }

  calcularAhorro(producto: Product): number {
    if (!producto.discount || !producto.originalPrice) {
      return 0;
    }
    return producto.originalPrice - producto.price;
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

  performSearch(): void {
    if (this.searchQuery.trim()) {
      // Búsqueda silenciosa
    }
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
}
