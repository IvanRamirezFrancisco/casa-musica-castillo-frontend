import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { OrderService } from '../../../services/order.service';
import { AuthService } from '../../../services/auth.service';
import { NotificationCenterService } from '../../../core/services/notification-center.service';
import { 
  Order, 
  OrderStatus, 
  PaymentStatus, 
  ShippingStatus,
  OrderFilters,
  OrderStats
} from '../../../models/order.model';
import { OrderDetailModalComponent } from '../order-detail-modal/order-detail-modal.component';
import { PaymentSettingsService } from '../../../services/payment-settings.service';

declare const Swal: any;

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, OrderDetailModalComponent],
  templateUrl: './admin-orders.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./admin-orders.component.css']
})
export class AdminOrdersComponent implements OnInit, OnDestroy {
  // ==================== DATOS ====================
  orders: Order[] = [];
  stats: OrderStats | null = null;
  selectedOrder: Order | null = null;
  showDetailModal = false;
  hasBankSettings = false;

  // ==================== PAGINACIÓN ====================
  currentPage = 0;
  pageSize = 20;
  totalElements = 0;
  totalPages = 0;
  
  // ==================== FILTROS ====================
  searchTerm = '';
  selectedOrderStatus: OrderStatus | null = null;
  selectedPaymentStatus: PaymentStatus | null = null;
  selectedShippingStatus: ShippingStatus | null = null;
  startDate = '';
  endDate = '';

  // ==================== ORDENAMIENTO ====================
  sortBy = 'createdAt';
  sortDir = 'DESC';

  // ==================== ESTADO UI ====================
  loading = false;
  error: string | null = null;
  filtersVisible = true;

  // ==================== ENUMS PARA TEMPLATE ====================
  OrderStatus = OrderStatus;
  PaymentStatus = PaymentStatus;
  ShippingStatus = ShippingStatus;

  hasReportViewPermission = false;

  // Opciones para selects
  orderStatusOptions = Object.values(OrderStatus);
  paymentStatusOptions = Object.values(PaymentStatus);
  shippingStatusOptions = Object.values(ShippingStatus);

  // ==================== MAPAS DE TRADUCCIÓN ====================
  readonly orderStatusMap: Record<string, string> = {
    'PENDING':    'Pendiente',
    'CONFIRMED':  'Confirmada',
    'PROCESSING': 'En Proceso',
    'COMPLETED':  'Completada',
    'CANCELLED':  'Cancelada',
  };

  readonly paymentStatusMap: Record<string, string> = {
    'PENDING':   'Pendiente',
    'PAID':      'Pagado',
    'REFUNDED':  'Reembolsado',
    'FAILED':    'Fallido',
  };

  readonly shippingStatusMap: Record<string, string> = {
    'PENDING':    'Sin enviar',
    'PREPARING':  'Preparando',
    'SHIPPED':    'Enviado',
    'IN_TRANSIT': 'En Tránsito',
    'DELIVERED':  'Entregado',
    'RETURNED':   'Devuelto',
  };

  /** Devuelve la etiqueta en español para un estado de orden. */
  getOrderStatusText(status: string): string {
    return this.orderStatusMap[status] ?? status;
  }

  /** Devuelve la etiqueta en español para un estado de pago. */
  getPaymentStatusText(status: string): string {
    return this.paymentStatusMap[status] ?? status;
  }

  /** Devuelve la etiqueta en español para un estado de envío. */
  getShippingStatusText(status: string): string {
    return this.shippingStatusMap[status] ?? status;
  }

  /**
   * Devuelve las clases Tailwind de color para cada estado de orden.
   * Paleta: verde=completada, ámbar=pendiente, azul=procesando, rojo=cancelada.
   */
  getOrderStatusBadgeClass(status: string): string {
    const map: Record<string, string> = {
      'PENDING':    'bg-amber-100 text-amber-800',
      'CONFIRMED':  'bg-blue-100 text-blue-800',
      'PROCESSING': 'bg-blue-100 text-blue-800',
      'COMPLETED':  'bg-green-100 text-green-800',
      'CANCELLED':  'bg-red-100 text-red-800',
    };
    return map[status] ?? 'bg-gray-100 text-gray-700';
  }

  /**
   * Devuelve las clases Tailwind de color para cada estado de pago.
   */
  getPaymentStatusBadgeClass(status: string): string {
    const map: Record<string, string> = {
      'PENDING':  'bg-amber-100 text-amber-800',
      'PAID':     'bg-green-100 text-green-800',
      'REFUNDED': 'bg-red-100 text-red-800',
      'FAILED':   'bg-red-100 text-red-800',
    };
    return map[status] ?? 'bg-gray-100 text-gray-700';
  }

  /**
   * Devuelve las clases Tailwind de color para cada estado de envío.
   */
  getShippingStatusBadgeClass(status: string): string {
    const map: Record<string, string> = {
      'PENDING':    'bg-gray-100 text-gray-600',
      'PREPARING':  'bg-blue-100 text-blue-800',
      'SHIPPED':    'bg-indigo-100 text-indigo-800',
      'IN_TRANSIT': 'bg-indigo-100 text-indigo-800',
      'DELIVERED':  'bg-green-100 text-green-800',
      'RETURNED':   'bg-red-100 text-red-800',
    };
    return map[status] ?? 'bg-gray-100 text-gray-700';
  }

  // ==================== RXJS ====================
  private searchSubject$ = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(
    public orderService: OrderService,
    private notifService: NotificationCenterService,
    private paymentSettingsService: PaymentSettingsService,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService
  ) {
    this.hasReportViewPermission = this.authService.hasPermission('REPORT_VIEW');
  }

  ngOnInit(): void {
    // Configurar debounce para búsqueda (500ms)
    this.searchSubject$
      .pipe(
        debounceTime(500),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.currentPage = 0;
        this.loadOrders();
      });

    // Cargar datos iniciales
    this.loadOrders();
    this.loadStats();
    this.checkBankSettings();

    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        if (params['action'] === 'export') {
          this.exportToCsv();
          this.clearActionParam();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== CARGAR DATOS ====================

  loadOrders(): void {
    this.loading = true;
    this.error = null;

    const filters: OrderFilters = {
      search: this.searchTerm || undefined,
      orderStatus: this.selectedOrderStatus || undefined,
      paymentStatus: this.selectedPaymentStatus || undefined,
      shippingStatus: this.selectedShippingStatus || undefined,
      startDate: this.startDate || undefined,
      endDate: this.endDate || undefined
    };

    this.orderService
      .getAllOrders(this.currentPage, this.pageSize, this.sortBy, this.sortDir, filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.orders = response.content;
          this.totalElements = response.totalElements;
          this.totalPages = response.totalPages;
          this.loading = false;
        },
        error: (err) => {
          console.error('Error al cargar órdenes:', err);
          this.error = 'Error al cargar las órdenes. Por favor, intenta de nuevo.';
          this.loading = false;
        }
      });
  }

  loadStats(): void {
    this.orderService
      .getOrderStats()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stats) => {
          this.stats = stats;
        },
        error: (err) => {
          console.error('Error al cargar estadísticas:', err);
        }
      });
  }

  checkBankSettings(): void {
    this.paymentSettingsService.getBankTransferSettings()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.hasBankSettings = true;
        },
        error: (err) => {
          if (err?.status === 404) {
            this.hasBankSettings = false;
          }
        }
      });
  }

  // ==================== BÚSQUEDA Y FILTROS ====================

  onSearch(): void {
    this.searchSubject$.next(this.searchTerm);
  }

  onFilterChange(): void {
    this.currentPage = 0;
    this.loadOrders();
  }

  /** Limpia filtros y recarga */
  clearFilters(): void {
    this.searchTerm = '';
    this.selectedOrderStatus = null;
    this.selectedPaymentStatus = null;
    this.selectedShippingStatus = null;
    this.startDate = '';
    this.endDate = '';
    this.currentPage = 0;
    this.loadOrders();
  }

  /** Navega al módulo de clustering para analizar la orden */
  analyzePattern(orderId: number): void {
    // Si viene del modal, ya cerró. Nos aseguramos.
    this.closeDetailModal();
    this.router.navigate(['/admin/analitica/patrones-compra'], { queryParams: { orderId } });
  }

  onAnalyzePatternRow(orderId: number, event: Event): void {
    event.stopPropagation();
    this.analyzePattern(orderId);
  }

  // ==================== PAGINACIÓN ====================

  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.loadOrders();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
      this.loadOrders();
    }
  }

  previousPage(): void {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.loadOrders();
    }
  }

  onPageSizeChange(): void {
    this.currentPage = 0;
    this.loadOrders();
  }

  private clearActionParam(): void {
    this.router.navigate([], {
      queryParams: { action: null },
      queryParamsHandling: 'merge'
    });
  }

  // ==================== ORDENAMIENTO ====================

  sortByColumn(column: string): void {
    if (this.sortBy === column) {
      this.sortDir = this.sortDir === 'ASC' ? 'DESC' : 'ASC';
    } else {
      this.sortBy = column;
      this.sortDir = 'DESC';
    }
    this.loadOrders();
  }

  // ==================== MODAL DE DETALLE ====================

  openDetailModal(order: Order): void {
    this.selectedOrder = order;
    this.showDetailModal = true;
    document.body.classList.add('overflow-hidden');
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.selectedOrder = null;
    document.body.classList.remove('overflow-hidden');
  }

  onOrderUpdated(updatedOrder: Order): void {
    const index = this.orders.findIndex(o => o.id === updatedOrder.id);
    if (index !== -1) {
      this.orders[index] = updatedOrder;
    }
    this.loadStats();
  }

  // ==================== CANCELAR ORDEN ====================

  cancelOrder(order: Order): void {
    Swal.fire({
      title: 'Cancelar Orden',
      html: `
        <p style="margin-bottom:1rem; color:#555;">
          Estás por cancelar la orden <strong>${order.orderNumber}</strong>.<br>
          Esta acción no se puede deshacer.
        </p>
        <textarea id="cancelReason" class="swal2-textarea" placeholder="Motivo de cancelación (obligatorio)..." style="min-height:90px; resize:vertical;"></textarea>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Cancelar Orden',
      cancelButtonText: 'Volver',
      confirmButtonColor: '#722f37',
      cancelButtonColor: '#6c757d',
      preConfirm: () => {
        const reason = (document.getElementById('cancelReason') as HTMLTextAreaElement)?.value?.trim();
        if (!reason) {
          Swal.showValidationMessage('El motivo de cancelación es obligatorio');
          return false;
        }
        if (reason.length > 500) {
          Swal.showValidationMessage('El motivo no puede exceder 500 caracteres');
          return false;
        }
        return reason;
      }
    }).then((result: any) => {
      if (result.isConfirmed && result.value) {
        this.orderService.cancelOrder(order.id, result.value)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (updatedOrder: Order) => {
              const index = this.orders.findIndex(o => o.id === order.id);
              if (index !== -1) {
                this.orders[index] = updatedOrder;
              }
              this.loadStats();
              // Notificación de cancelación
              this.notifService.orderCancelled(
                order.orderNumber,
                result.value || 'Sin motivo especificado'
              );
              Swal.fire({
                title: 'Orden Cancelada',
                text: `La orden ${order.orderNumber} fue cancelada correctamente.`,
                icon: 'success',
                confirmButtonColor: '#722f37',
                timer: 3500,
                timerProgressBar: true
              });
            },
            error: (err: any) => {
              Swal.fire({
                title: 'Error',
                text: err.error?.error || 'No se pudo cancelar la orden.',
                icon: 'error',
                confirmButtonColor: '#722f37'
              });
            }
          });
      }
    });
  }

  // ==================== EXPORTAR CSV ====================

  exportToCsv(): void {
    this.orderService.exportToCsv().pipe(takeUntil(this.destroy$)).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ordenes_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        Swal.fire({
          title: 'Error',
          text: 'No se pudo exportar el archivo CSV.',
          icon: 'error',
          confirmButtonColor: '#722f37'
        });
      }
    });
  }

  // ==================== HELPERS ====================

  getVisiblePages(): number[] {
    const maxVisible = 5;
    const pages: number[] = [];
    let start = Math.max(0, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.totalPages, start + maxVisible);
    if (end - start < maxVisible) {
      start = Math.max(0, end - maxVisible);
    }
    for (let i = start; i < end; i++) {
      pages.push(i);
    }
    return pages;
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(' ').filter(p => p.length > 0);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  formatDateShort(dateString: string): string {
    if (!dateString) return '—';
    const d = new Date(dateString);
    const day   = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleDateString('es-MX', { month: 'short' })
                   .replace('.', '');          // "feb" sin punto
    const year  = d.getFullYear();
    return `${day} ${month} ${year}`;         // "21 feb 2026" — siempre completo
  }

  formatTime(dateString: string): string {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  translateOrderStatus(status: OrderStatus): string {
    const translations: Record<OrderStatus, string> = {
      [OrderStatus.PENDING]: 'Pendiente',
      [OrderStatus.CONFIRMED]: 'Confirmada',
      [OrderStatus.PROCESSING]: 'Procesando',
      [OrderStatus.COMPLETED]: 'Completada',
      [OrderStatus.CANCELLED]: 'Cancelada'
    };
    return translations[status] || status;
  }

  translatePaymentStatus(status: PaymentStatus): string {
    const translations: Record<PaymentStatus, string> = {
      [PaymentStatus.PENDING]: 'Pendiente',
      [PaymentStatus.PAID]: 'Pagado',
      [PaymentStatus.FAILED]: 'Fallido',
      [PaymentStatus.REFUNDED]: 'Reembolsado',
      [PaymentStatus.PARTIALLY_REFUNDED]: 'Parcialmente Reembolsado'
    };
    return translations[status] || status;
  }

  translateShippingStatus(status: ShippingStatus): string {
    const translations: Record<ShippingStatus, string> = {
      [ShippingStatus.PENDING]: 'Pendiente',
      [ShippingStatus.PREPARING]: 'Preparando',
      [ShippingStatus.SHIPPED]: 'Enviado',
      [ShippingStatus.IN_TRANSIT]: 'En Tránsito',
      [ShippingStatus.DELIVERED]: 'Entregado',
      [ShippingStatus.RETURNED]: 'Devuelto'
    };
    return translations[status] || status;
  }
}
