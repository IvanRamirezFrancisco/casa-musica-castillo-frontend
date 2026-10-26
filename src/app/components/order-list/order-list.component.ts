import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { OrderService } from '../../services/order.service';
import { Order, OrderStatus, PaymentStatus, ShippingStatus } from '../../models/order.model';

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './order-list.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./order-list.component.css']
})
export class OrderListComponent implements OnInit {

  orders: Order[] = [];
  isLoading = true;
  error = '';
  currentPage = 0;
  totalPages = 0;
  totalElements = 0;
  readonly pageSize = 10;

  constructor(private orderService: OrderService) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(page: number = 0): void {
    this.isLoading = true;
    this.error = '';
    this.orderService.getMyOrders(page, this.pageSize).subscribe({
      next: (response) => {
        this.orders = response.content;
        this.currentPage = response.number;
        this.totalPages = response.totalPages;
        this.totalElements = response.totalElements;
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        if (err?.status === 401) {
          this.error = 'Tu sesión expiró. Por favor inicia sesión nuevamente.';
        } else {
          this.error = 'No pudimos cargar tus pedidos. Inténtalo de nuevo.';
        }
      }
    });
  }

  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages) {
      this.loadOrders(page);
    }
  }

  getStatusBadgeClass(status: OrderStatus): string {
    const map: Record<string, string> = {
      PENDING: 'badge-amber',
      CONFIRMED: 'badge-blue',
      PROCESSING: 'badge-indigo',
      COMPLETED: 'badge-green',
      CANCELLED: 'badge-red'
    };
    return map[status] ?? 'badge-gray';
  }

  getStatusLabel(status: OrderStatus): string {
    const map: Record<string, string> = {
      PENDING: 'Pendiente',
      CONFIRMED: 'Confirmado',
      PROCESSING: 'En proceso',
      COMPLETED: 'Entregado',
      CANCELLED: 'Cancelado'
    };
    return map[status] ?? status;
  }

  getPaymentLabel(status: PaymentStatus): string {
    const map: Record<string, string> = {
      PENDING: 'Pendiente',
      PAID: 'Pagado',
      FAILED: 'Fallido',
      REFUNDED: 'Reembolsado',
      PARTIALLY_REFUNDED: 'Parcial'
    };
    return map[status] ?? status;
  }

  getShippingLabel(status: ShippingStatus): string {
    const map: Record<string, string> = {
      PENDING: 'Por preparar',
      PREPARING: 'Preparando',
      SHIPPED: 'Enviado',
      IN_TRANSIT: 'En camino',
      DELIVERED: 'Entregado',
      RETURNED: 'Devuelto'
    };
    return map[status] ?? status;
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  }

  canClientCancel(status: OrderStatus): boolean {
    return this.orderService.canClientCancel(status);
  }

  trackByOrderId(_: number, order: Order): number {
    return order.id;
  }
}
