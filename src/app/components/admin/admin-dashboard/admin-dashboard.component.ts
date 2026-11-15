import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AdminDashboardService } from '../../../services/admin-dashboard.service';
import { AuthService } from '../../../services/auth.service';
import { DashboardStats, Order, Product } from '../../../models/admin.models';
import { AdminInventoryPredictionComponent } from '../admin-inventory-prediction/admin-inventory-prediction.component';

interface StatCard {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative';
  icon: string;
  color: string;
  route: string;
}

interface RecentOrder {
  id: string;
  customer: string;
  product: string;
  amount: number;
  status: 'pending' | 'completed' | 'cancelled';
  date: Date;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, AdminInventoryPredictionComponent],
  templateUrl: './admin-dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  stats: StatCard[] = [];
  recentOrders: Order[] = [];
  topProducts: Product[] = [];
  loading: boolean = true;
  error: string = '';

  private destroy$ = new Subject<void>();

  constructor(
    private dashboardService: AdminDashboardService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadDashboardData(): void {
    this.loading = true;

    // Cargar estadísticas
    this.dashboardService.getDashboardStats().pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: DashboardStats) => {
        this.updateStats(data);
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar estadísticas:', err);
        this.error = 'Error al cargar las estadísticas del dashboard';
        this.loading = false;
        // Mantener datos de ejemplo si hay error
        this.loadFallbackData();
      }
    });

    // Cargar órdenes recientes
    this.dashboardService.getRecentOrders(5).pipe(takeUntil(this.destroy$)).subscribe({
      next: (orders: Order[]) => {
        this.recentOrders = orders;
      },
      error: (err) => {
        console.error('Error al cargar órdenes recientes:', err);
      }
    });

    // Cargar productos más vendidos
    this.dashboardService.getTopProducts(5).pipe(takeUntil(this.destroy$)).subscribe({
      next: (products: Product[]) => {
        this.topProducts = products;
      },
      error: (err) => {
        console.error('Error al cargar productos top:', err);
      }
    });
  }

  private updateStats(data: DashboardStats): void {
    this.stats = [
      {
        title: 'Ventas del Mes',
        value: `$${data.monthSales.toLocaleString('es-MX')}`,
        change: '+12.5%',
        changeType: 'positive',
        icon: 'trending_up',
        color: '#27ae60',
        route: '/admin/ordenes'
      },
      {
        title: 'Órdenes Totales',
        value: data.totalOrders.toLocaleString('es-MX'),
        change: `${data.pendingOrders} pendientes`,
        changeType: 'positive',
        icon: 'shopping_cart',
        color: '#3498db',
        route: '/admin/ordenes'
      },
      {
        title: 'Productos',
        value: data.totalProducts.toLocaleString('es-MX'),
        change: '+23 vs mes anterior',
        changeType: 'positive',
        icon: 'inventory_2',
        color: '#9b59b6',
        route: '/admin/products'
      },
      {
        title: 'Clientes',
        value: data.totalCustomers.toLocaleString('es-MX'),
        change: '+45 vs mes anterior',
        changeType: 'positive',
        icon: 'people',
        color: '#e67e22',
        route: '/admin/customers'
      }
    ];
  }

  private loadFallbackData(): void {
    // Datos de respaldo si falla la API
    this.stats = [
      {
        title: 'Ventas del Mes',
        value: '$0',
        change: '+0%',
        changeType: 'positive',
        icon: 'trending_up',
        color: '#27ae60',
        route: '/admin/ordenes'
      },
      {
        title: 'Órdenes Totales',
        value: '0',
        change: '0 pendientes',
        changeType: 'positive',
        icon: 'shopping_cart',
        color: '#3498db',
        route: '/admin/ordenes'
      },
      {
        title: 'Productos',
        value: '0',
        change: '+0',
        changeType: 'positive',
        icon: 'inventory_2',
        color: '#9b59b6',
        route: '/admin/products'
      },
      {
        title: 'Clientes',
        value: '0',
        change: '+0',
        changeType: 'positive',
        icon: 'people',
        color: '#e67e22',
        route: '/admin/customers'
      }
    ];
  }

  getStatusClass(status: string): string {
    const classes: { [key: string]: string } = {
      'DELIVERED': 'status-completed',
      'CONFIRMED': 'status-completed',
      'PENDING': 'status-pending',
      'PROCESSING': 'status-pending',
      'SHIPPED': 'status-pending',
      'CANCELLED': 'status-cancelled',
      'REFUNDED': 'status-cancelled'
    };
    return classes[status] || 'status-pending';
  }

  getStatusText(status: string): string {
    const texts: { [key: string]: string } = {
      'PENDING': 'Pendiente',
      'CONFIRMED': 'Confirmada',
      'PROCESSING': 'En Proceso',
      'SHIPPED': 'Enviada',
      'DELIVERED': 'Entregada',
      'CANCELLED': 'Cancelada',
      'REFUNDED': 'Reembolsada'
    };
    return texts[status] || status;
  }
}
