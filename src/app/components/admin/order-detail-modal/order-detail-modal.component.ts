import { Component, Input, Output, EventEmitter, OnInit, ViewChild, ElementRef, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { HttpResponse } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../../services/order.service';
import { 
  Order, 
  OrderStatus, 
  PaymentStatus, 
  ShippingStatus,
  PaymentProofResponse,
  OrderTransitionsDTO,
  OrderTimelineEvent
} from '../../../models/order.model';
import Swal from 'sweetalert2';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { loadPdfDocument, renderPdfPage } from '../../../shared/pdf/pdf-preview';
import { AuthService } from '../../../services/auth.service';


@Component({
  selector: 'app-order-detail-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './order-detail-modal.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./order-detail-modal.component.css']
})
export class OrderDetailModalComponent implements OnInit {
  @Input() order!: Order;
  @Output() close = new EventEmitter<void>();
  @Output() orderUpdated = new EventEmitter<Order>();
  @Output() analyzePatternEvent = new EventEmitter<number>();

  // Estados editables
  selectedOrderStatus: OrderStatus;
  selectedPaymentStatus: PaymentStatus;
  selectedShippingStatus: ShippingStatus;
  trackingNumber: string = '';

  // UI State
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;
  allowedTransitions: OrderTransitionsDTO | null = null;
  loadingTransitions = false;
  hasReportViewPermission = false;

  // Comprobante
  proofMetadata: PaymentProofResponse | null = null;
  proofLoading = false;
  // Visor de comprobante
  showProofPreviewModal = false;
  proofPreviewUrl: string | null = null;
  proofPreviewSafeUrl: SafeResourceUrl | null = null;
  proofPreviewBlob: Blob | null = null;
  proofPreviewContentType: string | null = null;
  proofPreviewFilename: string | null = null;
  proofPreviewOrderNumber: string | null = null;
  proofPreviewStatus: string | null = null;
  proofPreviewError: string | null = null;
  loadingProofPreview = false;
  @ViewChild('pdfCanvas') pdfCanvas!: ElementRef<HTMLCanvasElement>;
  pdfDocument: PDFDocumentProxy | null = null;

  // Timeline
  timeline: OrderTimelineEvent[] = [];
  loadingTimeline = false;
  timelineError: string | null = null;

  // Enums para template
  OrderStatus = OrderStatus;
  PaymentStatus = PaymentStatus;
  ShippingStatus = ShippingStatus;

  orderStatusOptions = Object.values(OrderStatus);
  paymentStatusOptions = Object.values(PaymentStatus);
  shippingStatusOptions = Object.values(ShippingStatus);

  constructor(
    public orderService: OrderService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private router: Router
  ) {
    this.selectedOrderStatus = OrderStatus.PENDING;
    this.selectedPaymentStatus = PaymentStatus.PENDING;
    this.selectedShippingStatus = ShippingStatus.PENDING;
    this.hasReportViewPermission = this.authService.hasPermission('REPORT_VIEW');
  }

  ngOnInit(): void {
    // Inicializar con los valores actuales de la orden
    this.selectedOrderStatus = this.order.status;
    this.selectedPaymentStatus = this.order.paymentStatus;
    this.selectedShippingStatus = this.order.shippingStatus;
    this.trackingNumber = this.order.trackingNumber || '';

    if (this.order.paymentMethod === 'BANK_TRANSFER' || this.order.paymentMethod === 'TRANSFER') {
      this.loadPaymentProof();
    }
    
    this.loadAllowedTransitions();
    this.loadTimeline();
  }

  loadTimeline(): void {
    this.loadingTimeline = true;
    this.timelineError = null;
    this.orderService.getAdminOrderTimeline(this.order.id).subscribe({
      next: (events) => {
        this.timeline = events.map(event => this.mapAdminTimelineEvent(event));
        this.loadingTimeline = false;
      },
      error: (err) => {
        console.error('Error loading timeline:', err);
        this.timelineError = 'No se pudo cargar el historial en este momento.';
        this.loadingTimeline = false;
      }
    });
  }

  private mapAdminTimelineEvent(event: OrderTimelineEvent): OrderTimelineEvent {
    let desc = event.description || '';
    
    // Remove "Fuente:" from description if exists
    if (desc.includes('Fuente:')) {
      desc = desc.split('Fuente:')[0].trim();
    }
    
    // Remove metadata_json if it got leaked in description
    if (desc.includes('{') || desc.includes('metadata_json') || desc.includes('source:')) {
      desc = 'Evento del sistema registrado.';
    }
    
    event.description = desc;
    
    // Translate Source for actorLabel if needed
    if (event.source) {
      const sourceMap: Record<string, string> = {
        'BANK_TRANSFER_PROOF_APPROVED': 'Transferencia bancaria',
        'BANK_TRANSFER_PROOF_REJECTED': 'Transferencia bancaria',
        'SYSTEM_EXPIRATION': 'Sistema',
        'ADMIN_PANEL': 'Panel administrativo',
        'MERCADO_PAGO': 'Mercado Pago',
        'ORDER_SERVICE': 'Sistema',
        'PAYMENT_PROOF': 'Gestión de comprobantes'
      };
      
      const translatedSource = sourceMap[event.source] || event.source;
      // If actorLabel doesn't exist, we can use the translated source as actor
      if (!event.actorLabel) {
         event.actorLabel = translatedSource;
      } else if (event.actorLabel === 'Sistema') {
         event.actorLabel = `Sistema (${translatedSource})`;
      }
    }
    
    return event;
  }

  loadAllowedTransitions(): void {
    this.loadingTransitions = true;
    this.orderService.getAllowedTransitions(this.order.id).subscribe({
      next: (transitions) => {
        this.allowedTransitions = transitions;
        this.loadingTransitions = false;
      },
      error: (err) => {
        console.error('Error cargando transiciones permitidas:', err);
        this.loadingTransitions = false;
      }
    });
  }

  refreshOrderAfterMutation(): void {
    this.orderService.getOrderById(this.order.id).subscribe({
      next: (reloadedOrder) => {
        this.order = reloadedOrder;
        this.selectedOrderStatus = reloadedOrder.status;
        this.selectedPaymentStatus = reloadedOrder.paymentStatus;
        this.selectedShippingStatus = reloadedOrder.shippingStatus;
        this.trackingNumber = reloadedOrder.trackingNumber || '';
        
        if (this.order.paymentMethod === 'BANK_TRANSFER' || this.order.paymentMethod === 'TRANSFER') {
          this.loadPaymentProof();
        }
        
        this.loadAllowedTransitions();
        this.loadTimeline();
        this.orderUpdated.emit(this.order);
      },
      error: (err) => {
        console.error('Error recargando orden tras mutación:', err);
      }
    });
  }

  onAnalyzePattern(): void {
    const orderId = this.order.id;
    this.closeModal();
    this.analyzePatternEvent.emit(orderId);
  }

  // ==================== CERRAR Y NOTIFICAR ====================

  closeModal(): void {
    this.close.emit();
  }

  // Cerrar al hacer clic en el backdrop
  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeModal();
    }
  }

  // ==================== ACTUALIZAR ESTADOS ====================

  updateOrderStatus(): void {
    if (this.selectedOrderStatus === this.order.status) {
      return; // No hay cambios
    }

    this.loading = true;
    this.error = null;
    this.successMessage = null;

    this.orderService.updateOrderStatus(this.order.id, this.selectedOrderStatus)
      .subscribe({
        next: (updatedOrder) => {
          this.order = updatedOrder;
          this.successMessage = 'Estado de orden actualizado correctamente';
          this.orderUpdated.emit(updatedOrder);
          this.loadAllowedTransitions();
          this.loadTimeline();
          this.loading = false;
          this.hideMessageAfterDelay();
        },
        error: (err) => {
          console.error('Error al actualizar estado de orden:', err);
          const errorMsg = err.error?.message || err.error?.error || 'Error al actualizar el estado de la orden';
          this.error = errorMsg;
          
          Swal.fire({
            title: 'No permitido',
            text: errorMsg,
            icon: 'warning',
            confirmButtonColor: '#3085d6',
            confirmButtonText: 'Entendido'
          });
          
          this.loading = false;
          // Revertir selección
          this.selectedOrderStatus = this.order.status;
          this.hideMessageAfterDelay();
        }
      });
  }

  updatePaymentStatus(): void {
    if (this.selectedPaymentStatus === this.order.paymentStatus) {
      return;
    }

    this.loading = true;
    this.error = null;
    this.successMessage = null;

    this.orderService.updatePaymentStatus(this.order.id, this.selectedPaymentStatus)
      .subscribe({
        next: (updatedOrder) => {
          this.order = updatedOrder;
          this.successMessage = 'Estado de pago actualizado correctamente';
          this.loading = false;
          this.orderUpdated.emit();
          this.loadTimeline();
        },
        error: (err) => {
          this.error = err.error?.error || 'Error al actualizar el estado de pago';
          this.loading = false;
          // Revertir selección
          this.selectedPaymentStatus = this.order.paymentStatus;
        }
      });
  }

  cancelOrder(): void {
    if (!this.allowedTransitions?.canCancelOrder) return;

    Swal.fire({
      title: 'Cancelar Orden',
      text: this.allowedTransitions.requiresCancelReason ? 'Por favor, ingresa el motivo de la cancelación (mínimo 10 caracteres):' : '¿Estás seguro de cancelar esta orden?',
      input: this.allowedTransitions.requiresCancelReason ? 'textarea' : undefined,
      inputPlaceholder: 'Motivo de cancelación...',
      inputAttributes: {
        'aria-label': 'Motivo de cancelación',
        'maxlength': '500'
      },
      showCancelButton: true,
      confirmButtonText: 'Sí, cancelar orden',
      cancelButtonText: 'Volver',
      confirmButtonColor: '#dc2626',
      preConfirm: (reason) => {
        if (this.allowedTransitions?.requiresCancelReason) {
          if (!reason || reason.trim().length < 10) {
            Swal.showValidationMessage('Debes ingresar un motivo válido (mínimo 10 caracteres)');
            return false;
          }
        }
        return reason || 'Cancelada por administrador';
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.loading = true;
        this.orderService.cancelOrder(this.order.id, result.value).subscribe({
          next: (updatedOrder) => {
            this.order = updatedOrder;
            this.successMessage = 'La orden ha sido cancelada exitosamente';
            this.orderUpdated.emit(updatedOrder);
            this.loadAllowedTransitions();
            this.loadTimeline();
            this.loading = false;
            this.hideMessageAfterDelay();
            Swal.fire('Cancelada', 'La orden fue cancelada correctamente.', 'success');
          },
          error: (err) => {
            let msg = err.error?.message || err.error?.error || 'No se pudo cancelar la orden.';
            msg = this.sanitizeErrorMessage(msg);
            Swal.fire('Error', msg, 'error');
            this.loading = false;
          }
        });
      }
    });
  }

  requeryPayment(): void {
    this.loading = true;
    this.error = null;
    this.successMessage = null;

    // Buscar el paymentId (asumimos que el backend lo requiere, pero el modal no lo tiene directamente en la orden
    // Espera, el endpoint es POST /api/admin/payments/{paymentId}/requery.
    // Si la orden tiene un transactionId o podemos llamar a un endpoint de orden.
    // Wait, el backend requiere paymentId... ¿La orden expone el paymentId en algún lado?
    // Vamos a tener que crear un endpoint de requery por orderId, o usar el order.transactionId?
    // El frontend admin probablemente no conoce el internal payment ID a menos que se cargue la lista de pagos.
    // Dejaré un alert o implementaré un servicio temporal si transactionId no es suficiente.
    this.orderService.requeryPaymentByOrderId(this.order.id)
      .subscribe({
        next: (result) => {
          this.successMessage = `Reconsulta exitosa. Estado: ${result.status}`;
          this.loading = false;
          this.orderUpdated.emit();
          this.loadTimeline();
          if (result.status === 'PAID') {
             this.order.paymentStatus = PaymentStatus.PAID;
             this.selectedPaymentStatus = PaymentStatus.PAID;
          }
        },
        error: (err) => {
          this.error = err.error?.error || 'Error al reconsultar en Mercado Pago';
          this.loading = false;
        }
      });
  }

  updateShippingStatus(): void {
    if (this.selectedShippingStatus === this.order.shippingStatus && 
        this.trackingNumber === (this.order.trackingNumber || '')) {
      return;
    }

    this.loading = true;
    this.error = null;
    this.successMessage = null;

    this.orderService.updateShippingStatus(
      this.order.id, 
      this.selectedShippingStatus, 
      this.trackingNumber || undefined
    ).subscribe({
      next: (updatedOrder) => {
        this.order = updatedOrder;
        this.successMessage = 'Estado de envío actualizado correctamente';
        this.orderUpdated.emit(updatedOrder);
        this.loadAllowedTransitions();
        this.loadTimeline();
        this.loading = false;
        this.hideMessageAfterDelay();
      },
      error: (err) => {
        console.error('Error al actualizar estado de envío:', err);
        const errorMsg = err.error?.message || err.error?.error || 'Error al actualizar el estado de envío';
        this.error = errorMsg;
        
        Swal.fire({
          title: 'No permitido',
          text: errorMsg,
          icon: 'warning',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Entendido'
        });
        
        this.loading = false;
        // Revertir selección
        this.selectedShippingStatus = this.order.shippingStatus;
        this.trackingNumber = this.order.trackingNumber || '';
        this.hideMessageAfterDelay();
      }
    });
  }

  hideMessageAfterDelay(): void {
    setTimeout(() => {
      this.successMessage = null;
      this.error = null;
    }, 5000);
  }

  // ==================== ACCIONES DE PICKUP ====================

  markReadyForPickup(): void {
    Swal.fire({
      title: 'Marcar como Listo para Recolección',
      text: 'Esto notificará al cliente que su pedido está listo para ser recogido en tienda.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, marcar como listo',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#3085d6'
    }).then((result) => {
      if (result.isConfirmed) {
        this.loading = true;
        this.orderService.markReadyForPickup(this.order.id).subscribe({
          next: () => {
            this.successMessage = 'Orden marcada como lista para recolección.';
            this.hideMessageAfterDelay();
            Swal.fire('¡Listo!', 'El pedido está listo para recolección.', 'success');
            this.refreshOrderAfterMutation();
          },
          error: (err) => {
            let msg = err.error?.message || err.error?.error || 'Error al marcar como listo.';
            Swal.fire('Error', this.sanitizeErrorMessage(msg), 'error');
            this.loading = false;
          }
        });
      }
    });
  }

  verifyPickupCode(): void {
    if (!this.order.authorizedPersons || this.order.authorizedPersons.length === 0) {
      Swal.fire('Error', 'No hay personas autorizadas registradas para este pedido.', 'error');
      return;
    }

    const optionsHtml = this.order.authorizedPersons.map(ap => 
      `<option value="${ap.id}">${ap.fullName} ${ap.isPrimary ? '(Principal)' : ''}</option>`
    ).join('');

    Swal.fire({
      title: 'Verificar Código de Recolección',
      html: `
        <div class="mb-3 text-left">
          <label class="block text-sm font-medium text-gray-700 mb-1">Persona que recoge</label>
          <select id="swal-auth-id" class="swal2-select !mt-0 !mb-0" style="display: flex; width: 100%; max-width: 100%;">
            <option value="">Seleccione una persona...</option>
            ${optionsHtml}
          </select>
        </div>
        <div class="mb-3 text-left">
          <label class="block text-sm font-medium text-gray-700 mb-1">Código de recolección</label>
          <input id="swal-code" class="swal2-input !mt-0 !mb-0 font-mono tracking-widest text-center" placeholder="XXXXXX">
        </div>
        <div class="text-left">
          <label class="block text-sm font-medium text-gray-700 mb-1">Notas u observaciones (opcional)</label>
          <textarea id="swal-notes" class="swal2-textarea !mt-0 !mb-0" placeholder="Ej. Se verificó INE."></textarea>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Verificar y Entregar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#166534',
      preConfirm: () => {
        const authId = (document.getElementById('swal-auth-id') as HTMLSelectElement).value;
        const code = (document.getElementById('swal-code') as HTMLInputElement).value;
        const notes = (document.getElementById('swal-notes') as HTMLTextAreaElement).value;
        
        if (!authId) {
          Swal.showValidationMessage('Debe seleccionar a la persona autorizada que recoge el pedido');
          return false;
        }
        if (!code || code.trim().length === 0) {
          Swal.showValidationMessage('Debe ingresar el código de recolección');
          return false;
        }
        return { pickupAuthorizationId: Number(authId), code: code.trim(), notes: notes.trim() };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.loading = true;
        this.orderService.verifyPickup(this.order.id, result.value.code, result.value.pickupAuthorizationId, result.value.notes).subscribe({
          next: () => {
            Swal.fire('¡Entregado!', 'El código fue verificado y el pedido marcado como entregado.', 'success');
            this.refreshOrderAfterMutation();
          },
          error: (err) => {
            console.error('Error verificando código:', err);
            const errorMsg = err.error?.message || err.error?.error || 'Código incorrecto o error en la verificación';
            Swal.fire('Error', errorMsg, 'error');
            this.loading = false;
          }
        });
      }
    });
  }

  // ==================== HELPERS ====================

  calculateItemsTotal(): number {
    return this.order.items.reduce((sum, item) => sum + item.quantity, 0);
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

  translatePickupStatus(status: string | undefined | null): string {
    if (!status) return 'Desconocido';
    const translations: Record<string, string> = {
      'NOT_APPLICABLE': 'No aplica',
      'WAITING_PAYMENT': 'Esperando pago',
      'PAID_WAITING_PREPARATION': 'Pago confirmado, preparando pedido',
      'READY_FOR_PICKUP': 'Listo para recoger',
      'PICKED_UP': 'Recolectado en tienda',
      'CANCELLED': 'Cancelado'
    };
    return translations[status] || status;
  }

  canManagePayments(): boolean {
    return this.authService.hasRole('ROLE_SUPER_ADMIN') || 
           this.authService.hasPermission('ORDER_UPDATE') || 
           this.authService.hasPermission('ORDER_MANAGE') || 
           this.authService.hasPermission('PAYMENT_MANAGE');
  }

  // ==================== TIMELINE ADMIN ====================

  getTimelineIcon(eventType: string): string {
    const map: Record<string, string> = {
      'ORDER_CREATED': 'description',
      'BANK_PROOF_UPLOADED': 'upload_file',
      'BANK_PROOF_REJECTED': 'error',
      'BANK_PROOF_APPROVED': 'check_circle',
      'PAYMENT_APPROVED': 'payments',
      'ORDER_CONFIRMED': 'check_circle',
      'ORDER_STATUS_CHANGED': 'sync_alt',
      'SHIPPING_STATUS_CHANGED': 'local_shipping',
      'TRACKING_NUMBER_UPDATED': 'local_offer',
      'ORDER_CANCELLED': 'cancel',
      'ORDER_EXPIRED': 'timer_off',
      'MERCADO_PAGO_WEBHOOK_RECEIVED': 'payment',
      'MERCADO_PAGO_REQUERY': 'refresh'
    };
    return map[eventType] || 'info';
  }

  getTimelineColorClass(eventType: string): string {
    const map: Record<string, string> = {
      'ORDER_CREATED': 'text-gray-500 bg-gray-100',
      'BANK_PROOF_UPLOADED': 'text-blue-500 bg-blue-100',
      'BANK_PROOF_REJECTED': 'text-red-500 bg-red-100',
      'BANK_PROOF_APPROVED': 'text-green-500 bg-green-100',
      'PAYMENT_APPROVED': 'text-green-500 bg-green-100',
      'ORDER_CONFIRMED': 'text-green-500 bg-green-100',
      'ORDER_STATUS_CHANGED': 'text-blue-500 bg-blue-100',
      'SHIPPING_STATUS_CHANGED': 'text-blue-500 bg-blue-100',
      'TRACKING_NUMBER_UPDATED': 'text-blue-500 bg-blue-100',
      'ORDER_CANCELLED': 'text-red-500 bg-red-100',
      'ORDER_EXPIRED': 'text-orange-500 bg-orange-100',
      'MERCADO_PAGO_WEBHOOK_RECEIVED': 'text-blue-500 bg-blue-100',
      'MERCADO_PAGO_REQUERY': 'text-blue-500 bg-blue-100'
    };
    return map[eventType] || 'text-gray-500 bg-gray-100';
  }

  // ==================== COMPROBANTE DE PAGO (ADMIN) ====================

  loadPaymentProof(): void {
    this.proofLoading = true;
    this.orderService.getAdminPaymentProof(this.order.id).subscribe({
      next: (proof) => {
        this.proofMetadata = proof;
        this.proofLoading = false;
      },
      error: (err) => {
        this.proofLoading = false;
        // Si no hay (404), no mostramos error al admin, simplemente es que no hay.
        if (err.status !== 404) {
          console.error('Error cargando comprobante admin', err);
        }
      }
    });
  }

  private buildProofFilename(orderNumber: string, contentType: string): string {
    let cleanOrderNumber = orderNumber || 'UNKNOWN';
    if (cleanOrderNumber.startsWith('#')) {
      cleanOrderNumber = cleanOrderNumber.substring(1);
    }
    let ext = '.pdf';
    if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = '.jpg';
    else if (contentType.includes('png')) ext = '.png';
    else if (contentType.includes('webp')) ext = '.webp';

    if (cleanOrderNumber.startsWith('ORD-')) {
      return `comprobante-${cleanOrderNumber}${ext}`;
    } else {
      return `comprobante-ORD-${cleanOrderNumber}${ext}`;
    }
  }

  viewProof(): void {
    this.showProofPreviewModal = true;
    this.loadingProofPreview = true;
    this.proofPreviewError = null;
    this.proofPreviewOrderNumber = this.order.orderNumber;
    this.proofPreviewStatus = this.order.paymentProofStatus || 'PENDING_REVIEW';
    
    this.orderService.getAdminPaymentProofFile(this.order.id).subscribe({
      next: async (response) => {
        this.loadingProofPreview = false;
        const rawBlob = response.body;

        const contentType = response.headers.get('Content-Type') || (rawBlob as any)?.type || 'application/pdf';
        const typedBlob = new Blob([rawBlob as Blob], { type: contentType });

        // LOGS TEMPORALES DIAGNOSTICO
        console.log('--- DIAGNOSTICO PDF.JS ADMIN ---');
        console.log('response.status:', response.status);
        console.log('Content-Type header:', response.headers.get('Content-Type'));
        console.log('Content-Disposition:', response.headers.get('Content-Disposition'));
        console.log('blob instanceof Blob:', rawBlob instanceof Blob);
        console.log('blob.size:', (rawBlob as any)?.size);
        console.log('blob.type:', (rawBlob as any)?.type);
        console.log('typedBlob.size:', typedBlob.size);
        console.log('typedBlob.type:', typedBlob.type);

        if (typedBlob.size > 0) {
          const head = new Uint8Array(await typedBlob.slice(0, 8).arrayBuffer());
          console.log('PDF HEAD BYTES:', Array.from(head));
          console.log('PDF HEAD TEXT:', String.fromCharCode(...head));
        }
        console.log('--------------------------------');

        if (!(typedBlob instanceof Blob) || typedBlob.size === 0) {
          this.proofPreviewError = 'Archivo inválido o vacío';
          return;
        }

        // Whitelist estricta
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(contentType)) {
          this.proofPreviewError = 'Este tipo de archivo no se puede previsualizar. Puedes descargarlo si tienes permiso.';
        }

        this.proofPreviewContentType = contentType;
        this.proofPreviewBlob = typedBlob;
        this.proofPreviewFilename = this.buildProofFilename(this.order?.orderNumber || '', contentType);

        // URL Segura
        if (this.proofPreviewUrl) URL.revokeObjectURL(this.proofPreviewUrl);
        this.proofPreviewUrl = URL.createObjectURL(typedBlob);
        this.proofPreviewSafeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.proofPreviewUrl);

        if (contentType === 'application/pdf') {
          await this.renderPdf(typedBlob);
        }
      },
      error: async (err) => {
        this.loadingProofPreview = false;
        this.proofPreviewError = await this.extractBlobErrorMessage(err);
      }
    });
  }

  async renderPdf(blob: Blob): Promise<void> {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      this.pdfDocument = await loadPdfDocument(arrayBuffer);
      const page = await this.pdfDocument.getPage(1);
      
      // Forzar que Angular renderice el modal y asigne el elemento al ViewChild
      this.cdr.detectChanges();

      setTimeout(async () => {
        if (!this.pdfCanvas?.nativeElement) {
          console.error('PDF canvas no disponible después del setTimeout');
          return;
        }
        try {
          await renderPdfPage(page, this.pdfCanvas.nativeElement);
        } catch {
          this.proofPreviewError = 'No se pudo previsualizar el PDF. Puedes descargarlo.';
          this.cdr.detectChanges();
        }
      }, 0);
    } catch (error) {
      console.error('PDF.js render error:', error);
      this.proofPreviewError = 'No se pudo previsualizar el PDF. Puedes descargarlo.';
    }
  }

  closeProofPreview(): void {
    this.showProofPreviewModal = false;
    this.proofPreviewSafeUrl = null;
    this.proofPreviewBlob = null;
    this.proofPreviewContentType = null;
    this.proofPreviewFilename = null;
    this.proofPreviewError = null;
    this.pdfDocument = null;
    if (this.proofPreviewUrl) {
      URL.revokeObjectURL(this.proofPreviewUrl);
      this.proofPreviewUrl = null;
    }
  }

  downloadProof(): void {
    if (!this.proofPreviewUrl || !this.proofPreviewFilename) return;
    const a = document.createElement('a');
    a.href = this.proofPreviewUrl;
    a.download = this.proofPreviewFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  openProofInNewTab(): void {
    if (!this.proofPreviewUrl) return;
    const newWindow = window.open(this.proofPreviewUrl, '_blank', 'noopener,noreferrer');
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      Swal.fire({
        icon: 'info',
        title: 'Ventana emergente bloqueada',
        text: 'El navegador bloqueó la nueva pestaña. Usa el botón Descargar comprobante.'
      });
    }
  }

  approveProof(): void {
    Swal.fire({
      title: '¿Aprobar comprobante?',
      text: 'El estado del pago cambiará a Pagado.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, aprobar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#166534'
    }).then((result) => {
      if (result.isConfirmed) {
        this.orderService.approvePaymentProof(this.order.id).subscribe({
          next: (res) => {
            this.successMessage = 'Comprobante aprobado exitosamente.';
            this.hideMessageAfterDelay();
            this.loading = false;
            Swal.fire('Aprobado', 'El comprobante ha sido aprobado.', 'success');
            
            this.refreshOrderAfterMutation();
          },
          error: (err) => {
            let msg = err.error?.message || err.error?.error || 'Error al aprobar.';
            msg = this.sanitizeErrorMessage(msg);
            Swal.fire('Error', msg, 'error');
          }
        });
      }
    });
  }

  rejectProof(): void {
    Swal.fire({
      title: 'Rechazar comprobante',
      text: 'Ingresa el motivo del rechazo:',
      input: 'textarea',
      inputPlaceholder: 'Ej. La imagen está borrosa, monto incorrecto...',
      inputAttributes: {
        'aria-label': 'Motivo del rechazo',
        'maxlength': '500'
      },
      showCancelButton: true,
      confirmButtonText: 'Rechazar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      preConfirm: (reason) => {
        if (!reason || reason.trim() === '') {
          Swal.showValidationMessage('Debes ingresar un motivo');
        }
        return reason;
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.orderService.rejectPaymentProof(this.order.id, result.value).subscribe({
          next: (proof) => {
            this.successMessage = 'Comprobante rechazado exitosamente.';
            this.hideMessageAfterDelay();
            Swal.fire('Rechazado', 'El comprobante ha sido rechazado.', 'success');
            
            this.refreshOrderAfterMutation();
          },
          error: (err) => {
            let msg = err.error?.message || err.error?.error || 'Error al rechazar.';
            msg = this.sanitizeErrorMessage(msg);
            Swal.fire('Error', msg, 'error');
          }
        });
      }
    });
  }

  private async extractBlobErrorMessage(error: any): Promise<string> {
    if (error?.error instanceof Blob) {
      try {
        const text = await error.error.text();
        const json = JSON.parse(text);
        return json.message || json.error || 'El archivo no está disponible en este momento.';
      } catch {
        return 'El archivo no está disponible en este momento.';
      }
    }
    return error?.error?.message || error?.message || 'El archivo no está disponible en este momento.';
  }

  private async handleBlobError(err: any): Promise<void> {
    console.error('Error descargando blob admin', err);
    
    if (err.status === 0) {
      Swal.fire('Error', 'No se pudo conectar con el servidor.', 'error');
      return;
    }
    if (err.status === 404) {
      Swal.fire('Error', 'No se encontró el comprobante.', 'error');
      return;
    }
    if (err.status === 403) {
      Swal.fire('Error', 'No tienes permiso para ver este comprobante.', 'error');
      return;
    }

    const message = await this.extractBlobErrorMessage(err);
    Swal.fire('Error', this.sanitizeErrorMessage(message), 'error');
  }

  private sanitizeErrorMessage(msg: string): string {
    if (!msg) return 'No se pudo completar la operación. Inténtalo nuevamente.';
    const lowerMsg = msg.toLowerCase();
    if (
      lowerMsg.includes('jdbc') || 
      lowerMsg.includes('sql') || 
      lowerMsg.includes('insert into') || 
      lowerMsg.includes('select ') || 
      lowerMsg.includes('metadata_json') || 
      lowerMsg.includes('rollback-only') || 
      lowerMsg.includes('transacción abortada') || 
      lowerMsg.includes('exception') || 
      lowerMsg.includes('stack trace') ||
      lowerMsg.includes('transaction system')
    ) {
      return 'No se pudo completar la operación. Inténtalo nuevamente.';
    }
    return msg;
  }
}
