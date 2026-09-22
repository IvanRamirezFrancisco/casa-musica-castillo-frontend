import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { ProductService } from '../../services/product.service';
import { DashboardComponent } from '../dashboard/dashboard.component';
import { HeaderLoggedinComponent } from '../header-loggedin/header-loggedin.component';

interface DashboardStats {
  totalOrders: number;
  totalSpent: number;
  favoriteProducts: number;
  wishlistItems: number;
  cartItems: number;
}

interface RecentOrder {
  id: string;
  date: string;
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  items: number;
}

interface FavoriteProduct {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
}

@Component({
  selector: 'app-user-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, DashboardComponent, HeaderLoggedinComponent],
  templateUrl: './user-dashboard.component.html',
  styleUrls: ['./user-dashboard.component.css']
})
export class UserDashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private cartService = inject(CartService);
  private productService = inject(ProductService);
  private router = inject(Router);

  currentUser: any = null;
  dashboardStats: DashboardStats = {
    totalOrders: 0,
    totalSpent: 0,
    favoriteProducts: 0,
    wishlistItems: 0,
    cartItems: 0
  };

  recentOrders: RecentOrder[] = [];
  favoriteProducts: FavoriteProduct[] = [];
  recommendedProducts: any[] = [];
  
  loading = true;
  activeSection = 'overview';

  ngOnInit() {
    this.loadUserData();
    this.loadDashboardData();
  }

  loadUserData() {
    this.authService.user$.subscribe(user => {
      this.currentUser = user;
    });
  }

  loadDashboardData() {
    // Simular carga de datos - en producción vendría del backend
    setTimeout(() => {
      this.dashboardStats = {
        totalOrders: 12,
        totalSpent: 45670,
        favoriteProducts: 8,
        wishlistItems: 15,
        cartItems: this.cartService.getCartCount()
      };

      this.recentOrders = [
        {
          id: 'ORD-001',
          date: '2025-11-10',
          total: 2890,
          status: 'delivered',
          items: 3
        },
        {
          id: 'ORD-002',
          date: '2025-11-08',
          total: 1250,
          status: 'shipped',
          items: 1
        },
        {
          id: 'ORD-003',
          date: '2025-11-05',
          total: 5670,
          status: 'processing',
          items: 2
        }
      ];

      this.favoriteProducts = [
        {
          id: '1',
          name: 'Guitarra Fender Stratocaster',
          price: 18900,
          image: '/https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_400/v1782840424/Dise%C3%B1o_sin_t%C3%ADtulo_4_xruh6t.png',
          category: 'Guitarras'
        },
        {
          id: '2',
          name: 'Piano Digital Yamaha P-125',
          price: 12500,
          image: '/https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_400/v1782840424/Dise%C3%B1o_sin_t%C3%ADtulo_4_xruh6t.png',
          category: 'Pianos'
        },
        {
          id: '3',
          name: 'Batería Pearl Export',
          price: 22000,
          image: '/https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_400/v1782840424/Dise%C3%B1o_sin_t%C3%ADtulo_4_xruh6t.png',
          category: 'Baterías'
        }
      ];

      this.loading = false;
    }, 1000);
  }

  setActiveSection(section: string) {
    this.activeSection = section;
  }

  getStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
      'pending': 'warning',
      'processing': 'info',
      'shipped': 'primary',
      'delivered': 'success',
      'cancelled': 'error'
    };
    return colors[status] || 'default';
  }

  getStatusText(status: string): string {
    const texts: { [key: string]: string } = {
      'pending': 'Pendiente',
      'processing': 'Procesando',
      'shipped': 'Enviado',
      'delivered': 'Entregado',
      'cancelled': 'Cancelado'
    };
    return texts[status] || status;
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(price);
  }

  navigateToOrders() {
    this.router.navigate(['/orders/my']);
  }

  navigateToWishlist() {
    this.router.navigate(['/wishlist']);
  }

  navigateToCart() {
    this.router.navigate(['/cart']);
  }

  navigateToProfile() {
    this.router.navigate(['/profile']);
  }

  navigateToProduct(productId: string) {
    this.router.navigate(['/product', productId]);
  }

  viewAllOrders() {
    this.navigateToOrders();
  }

  viewAllFavorites() {
    this.navigateToWishlist();
  }

  continueShopping() {
    this.router.navigate(['/catalog']);
  }
}