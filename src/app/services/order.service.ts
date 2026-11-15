import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { 
  Order, 
  OrderStats, 
  OrderFilters, 
  PageResponse,
  OrderStatus,
  PaymentStatus,
  ShippingStatus,
  CheckoutRequest,
  CancelOrderRequest,
  PaymentProofResponse,
  RejectPaymentProofRequest,
  PaymentInstructionsResponse,
  OrderTransitionsDTO,
  OrderTimelineEvent,
  PricePreviewRequest,
  PricePreviewResponse
} from '../models/order.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private apiUrl = `${environment.apiUrl}/admin/orders`;
  private customerApiUrl = `${environment.apiUrl}/orders/my`;
  private checkoutUrl = `${environment.apiUrl}/checkout`;

  constructor(private http: HttpClient) {}

  // ==================== LISTAR Y BUSCAR ====================

  /**
   * 📋 Obtener todas las órdenes con filtros y paginación
   */
  getAllOrders(
    page: number = 0,
    size: number = 20,
    sortBy: string = 'createdAt',
    sortDir: string = 'DESC',
    filters?: OrderFilters
  ): Observable<PageResponse<Order>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sortBy', sortBy)
      .set('sortDir', sortDir);

    // Agregar filtros opcionales
    if (filters?.search) {
      params = params.set('search', filters.search);
    }
    if (filters?.orderStatus) {
      params = params.set('orderStatus', filters.orderStatus);
    }
    if (filters?.paymentStatus) {
      params = params.set('paymentStatus', filters.paymentStatus);
    }
    if (filters?.shippingStatus) {
      params = params.set('shippingStatus', filters.shippingStatus);
    }
    if (filters?.startDate) {
      params = params.set('startDate', filters.startDate);
    }
    if (filters?.endDate) {
      params = params.set('endDate', filters.endDate);
    }

    return this.http.get<PageResponse<Order>>(this.apiUrl, { params });
  }

  /**
   * 🔍 Obtener detalle de una orden
   */
  getOrderById(id: number): Observable<Order> {
    return this.http.get<Order>(`${this.apiUrl}/${id}`);
  }

  /**
   * 👤 Obtener órdenes de un cliente
   */
  getOrdersByCustomer(
    userId: number, 
    page: number = 0, 
    size: number = 20
  ): Observable<PageResponse<Order>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<PageResponse<Order>>(
      `${this.apiUrl}/customer/${userId}`, 
      { params }
    );
  }

  /**
   * 📊 Obtener estadísticas de órdenes
   */
  getOrderStats(): Observable<OrderStats> {
    return this.http.get<OrderStats>(`${this.apiUrl}/stats`);
  }

  // ==================== ENDPOINTS DE ADMINISTRADOR ====================

  /**
   * Marcar orden como lista para recolección (Admin).
   */
  markReadyForPickup(orderId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${orderId}/pickup-ready`, {});
  }

  /**
   * Verificar código de recolección y entregar pedido (Admin).
   */
  verifyPickup(orderId: number, code: string, pickupAuthorizationId: number, notes?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${orderId}/pickup-verify`, {
      code,
      pickupAuthorizationId,
      notes
    });
  }

  // ==================== ACTUALIZAR ESTADOS ====================

  /**
   * 📊 Actualizar estado de la orden
   */
  updateOrderStatus(orderId: number, newStatus: OrderStatus): Observable<Order> {
    return this.http.patch<Order>(
      `${this.apiUrl}/${orderId}/status`,
      { status: newStatus }
    );
  }

  /**
   * 💳 Actualizar estado de pago
   */
  updatePaymentStatus(orderId: number, newStatus: PaymentStatus): Observable<Order> {
    return this.http.patch<Order>(
      `${this.apiUrl}/${orderId}/payment-status`,
      { paymentStatus: newStatus }
    );
  }

  /**
   * Reconsulta a Mercado Pago el estado de una orden.
   */
  requeryPaymentByOrderId(orderId: number): Observable<any> {
    // Obtenemos los pagos de esta orden
    return this.http.get<any>(`/api/admin/payments`, { params: { orderId: orderId.toString() } }).pipe(
      switchMap(pageData => {
        const payments = pageData.content || [];
        const mpPayment = payments.find((p: any) => p.provider === 'MERCADO_PAGO' && p.status === 'PENDING');
        if (!mpPayment) {
          return throwError(() => new Error('No se encontró un pago pendiente de Mercado Pago para esta orden.'));
        }
        return this.http.post(`/api/admin/payments/${mpPayment.id}/requery`, {});
      })
    );
  }

  /**
   * 🚚 Actualizar estado de envío
   */
  updateShippingStatus(
    orderId: number, 
    newStatus: ShippingStatus, 
    trackingNumber?: string
  ): Observable<Order> {
    const body: any = { shippingStatus: newStatus };
    if (trackingNumber) {
      body.trackingNumber = trackingNumber;
    }

    return this.http.patch<Order>(
      `${this.apiUrl}/${orderId}/shipping-status`,
      body
    );
  }

  // ==================== CLIENTE ====================

  /**
   * Crear pedido desde el carrito (POST /api/checkout).
   * Solo envía los campos permitidos — el backend calcula totales.
   */
  createOrder(request: CheckoutRequest): Observable<Order> {
    return this.http.post<Order>(this.checkoutUrl, request);
  }

  /**
   * Calcular pre-visualización de precios y disponibilidad de envío.
   */
  pricePreview(request: PricePreviewRequest): Observable<PricePreviewResponse> {
    return this.http.post<PricePreviewResponse>(`${this.checkoutUrl}/price-preview`, request);
  }

  /**
   * Historial de pedidos del cliente autenticado (GET /api/orders/my).
   */
  getMyOrders(page: number = 0, size: number = 20): Observable<PageResponse<Order>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<PageResponse<Order>>(this.customerApiUrl, { params });
  }

  /**
   * Detalle de un pedido del cliente (GET /api/orders/my/{id}).
   */
  getMyOrderById(id: number): Observable<Order> {
    return this.http.get<Order>(`${this.customerApiUrl}/${id}`);
  }

  /**
   * Historial de eventos (Timeline) de un pedido del cliente
   */
  getMyOrderTimeline(orderId: number): Observable<OrderTimelineEvent[]> {
    return this.http.get<OrderTimelineEvent[]>(`${this.customerApiUrl}/${orderId}/timeline`);
  }

  /**
   * Obtener código de recolección para una orden
   */
  getMyOrderPickupCode(orderId: number): Observable<{ pickupCode: string }> {
    return this.http.get<{ pickupCode: string }>(`${this.customerApiUrl}/${orderId}/pickup-code`);
  }

  /**
   * Cancelación por cliente (PATCH /api/orders/my/{id}/cancel).
   */
  cancelMyOrder(orderId: number, request: CancelOrderRequest): Observable<Order> {
    return this.http.patch<Order>(`${this.customerApiUrl}/${orderId}/cancel`, request);
  }

  /**
   * Determina si un pedido puede ser cancelado por el cliente.
   */
  canClientCancel(status: OrderStatus): boolean {
    return status === OrderStatus.PENDING || status === OrderStatus.CONFIRMED;
  }

  // ==================== COMPROBANTES DE PAGO (CLIENTE) ====================

  /**
   * 📄 Subir comprobante de pago
   */
  uploadPaymentProof(orderId: number, formData: FormData): Observable<PaymentProofResponse> {
    return this.http.post<PaymentProofResponse>(`${this.customerApiUrl}/${orderId}/payment-proof`, formData);
  }

  /**
   * 📄 Obtener metadata del comprobante de pago
   */
  getMyPaymentProof(orderId: number): Observable<PaymentProofResponse> {
    return this.http.get<PaymentProofResponse>(`${this.customerApiUrl}/${orderId}/payment-proof`);
  }

  /**
   * 📄 Descargar archivo del comprobante
   */
  getMyPaymentProofFile(orderId: number): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.customerApiUrl}/${orderId}/payment-proof/file`, {
      responseType: 'blob',
      observe: 'response'
    });
  }

  /**
   * 🏦 Obtener instrucciones de transferencia bancaria
   */
  getPaymentInstructions(orderId: number): Observable<PaymentInstructionsResponse> {
    return this.http.get<PaymentInstructionsResponse>(`${this.customerApiUrl}/${orderId}/payment-instructions`);
  }

  /**
   * 💳 Crear intento de pago (Mercado Pago, etc.)
   */
  createPayment(orderId: number, request: { provider: string }): Observable<{ checkoutUrl?: string, providerPreferenceId?: string }> {
    return this.http.post<{ checkoutUrl?: string, providerPreferenceId?: string }>(`${this.customerApiUrl}/${orderId}/payments`, request);
  }

  // ==================== ADMIN ====================

  /**
   * Cancelar una orden con motivo obligatorio (Admin).
   */
  cancelOrder(orderId: number, reason: string): Observable<Order> {
    return this.http.patch<Order>(
      `${this.apiUrl}/${orderId}/cancel`,
      { reason }
    );
  }

  /**
   * Historial de eventos (Timeline) de un pedido para Admin
   */
  getAdminOrderTimeline(orderId: number): Observable<OrderTimelineEvent[]> {
    return this.http.get<OrderTimelineEvent[]>(`${this.apiUrl}/${orderId}/timeline`);
  }

  /**
   * Exportar órdenes a CSV.
   */
  exportToCsv(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export/csv`, {
      responseType: 'blob'
    });
  }

  // ==================== COMPROBANTES DE PAGO (ADMIN) ====================

  /**
   * 📄 Consultar metadata del comprobante (Admin)
   */
  getAdminPaymentProof(orderId: number): Observable<PaymentProofResponse> {
    return this.http.get<PaymentProofResponse>(`${this.apiUrl}/${orderId}/payment-proof`);
  }

  /**
   * 📄 Descargar archivo del comprobante (Admin)
   */
  getAdminPaymentProofFile(orderId: number): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.apiUrl}/${orderId}/payment-proof/file`, {
      responseType: 'blob',
      observe: 'response'
    });
  }

  /**
   * ✅ Aprobar comprobante de pago (Admin)
   */
  approvePaymentProof(orderId: number): Observable<PaymentProofResponse> {
    return this.http.patch<PaymentProofResponse>(`${this.apiUrl}/${orderId}/payment-proof/approve`, {});
  }

  /**
   * ❌ Rechazar comprobante de pago (Admin)
   */
  rejectPaymentProof(orderId: number, reason: string): Observable<PaymentProofResponse> {
    const request: RejectPaymentProofRequest = { reason };
    return this.http.patch<PaymentProofResponse>(`${this.apiUrl}/${orderId}/payment-proof/reject`, request);
  }

  // ==================== HELPERS ====================

  /**
   * 🎨 Obtener clase CSS para badge de estado de orden
   */
  getOrderStatusClass(status: OrderStatus): string {
    const classes: Record<OrderStatus, string> = {
      [OrderStatus.PENDING]: 'badge-warning',
      [OrderStatus.CONFIRMED]: 'badge-info',
      [OrderStatus.PROCESSING]: 'badge-primary',
      [OrderStatus.COMPLETED]: 'badge-success',
      [OrderStatus.CANCELLED]: 'badge-danger'
    };
    return classes[status] || 'badge-secondary';
  }

  /**
   * 🎨 Obtener clase CSS para badge de estado de pago
   */
  getPaymentStatusClass(status: PaymentStatus): string {
    const classes: Record<PaymentStatus, string> = {
      [PaymentStatus.PENDING]: 'badge-warning',
      [PaymentStatus.PAID]: 'badge-success',
      [PaymentStatus.FAILED]: 'badge-danger',
      [PaymentStatus.REFUNDED]: 'badge-secondary',
      [PaymentStatus.PARTIALLY_REFUNDED]: 'badge-info'
    };
    return classes[status] || 'badge-secondary';
  }

  /**
   * 🎨 Obtener clase CSS para badge de estado de envío
   */
  getShippingStatusClass(status: ShippingStatus): string {
    const classes: Record<ShippingStatus, string> = {
      [ShippingStatus.PENDING]: 'badge-warning',
      [ShippingStatus.PREPARING]: 'badge-info',
      [ShippingStatus.SHIPPED]: 'badge-primary',
      [ShippingStatus.IN_TRANSIT]: 'badge-primary',
      [ShippingStatus.DELIVERED]: 'badge-success',
      [ShippingStatus.RETURNED]: 'badge-danger'
    };
    return classes[status] || 'badge-secondary';
  }

  /**
   * 💰 Formatear precio a moneda
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  }

  /**
   * 📅 Formatear fecha
   */
  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }



  // ==================== STATE TRANSITIONS ====================
  /**
   * Obtener opciones permitidas de transición de estados.
   */
  getAllowedTransitions(orderId: number): Observable<OrderTransitionsDTO> {
    return this.http.get<OrderTransitionsDTO>(`${this.apiUrl}/${orderId}/allowed-transitions`);
  }
}
