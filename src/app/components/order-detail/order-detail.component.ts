import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpResponse } from '@angular/common/http';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { OrderService } from '../../services/order.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { 
  Order, 
  OrderStatus, 
  PaymentStatus, 
  ShippingStatus, 
  PaymentProofStatus, 
  PaymentProofResponse,
  PaymentInstructionsResponse,
  OrderTimelineEvent
} from '../../models/order.model';
import Swal from 'sweetalert2';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { loadPdfDocument, renderPdfPage } from '../../shared/pdf/pdf-preview';


@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './order-detail.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./order-detail.component.css']
})
export class OrderDetailComponent implements OnInit {

  order: Order | null = null;
  isLoading = true;
  error = '';

  // Modal de cancelación
  showCancelModal = false;
  cancelReason = '';
  isCancelling = false;
  cancelError = '';

  // Comprobante de pago
  proofMetadata: PaymentProofResponse | null = null;
  proofForm: FormGroup;
  selectedFile: File | null = null;
  isUploading = false;
  uploadError = '';
  // Visor de comprobante
  @ViewChild('pdfCanvas') pdfCanvas!: ElementRef<HTMLCanvasElement>;
  pdfDocument: PDFDocumentProxy | null = null;
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

  // Instrucciones bancarias
  paymentInstructions: PaymentInstructionsResponse | null = null;
  loadingInstructions = false;
  transferDateError: string = '';
  minTransferDate: string = '';
  maxTransferDate: string = '';

  // Pickup Code
  pickupCode: string | null = null;
  loadingPickupCode = false;
  pickupCodeError = '';

  // Expiración de pago
  remainingTimeText: string = '';
  isAlmostExpired: boolean = false;
  countdownInterval: any;

  // Timeline
  timeline: OrderTimelineEvent[] = [];
  loadingTimeline = false;
  timelineError: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private orderService: OrderService,
    private fb: FormBuilder,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {
    this.proofForm = this.fb.group({
      referenceNumber: ['', [Validators.maxLength(100)]],
      bankName: ['', [Validators.maxLength(100)]],
      amountDeclared: [null, [Validators.min(0.01)]],
      transferDate: [''],
      notes: ['', [Validators.maxLength(500)]]
    });

    this.proofForm.get('transferDate')?.valueChanges.subscribe(() => {
      this.validateTransferDate();
    });
  }

  private validateTransferDate(): void {
    const val = this.proofForm.get('transferDate')?.value;
    this.transferDateError = '';
    if (val) {
      if (val < this.minTransferDate) {
        this.transferDateError = 'La fecha no puede ser anterior a la creación de la orden.';
        this.proofForm.get('transferDate')?.setErrors({ outOfRange: true });
      } else if (val > this.maxTransferDate) {
        this.transferDateError = 'La fecha no puede ser posterior al día de hoy.';
        this.proofForm.get('transferDate')?.setErrors({ outOfRange: true });
      } else {
        this.proofForm.get('transferDate')?.setErrors(null);
      }
    } else {
      this.proofForm.get('transferDate')?.setErrors(null);
    }
  }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id || id <= 0) {
      this.error = 'Pedido no válido.';
      this.isLoading = false;
      return;
    }
    this.loadOrder(id);
  }

  loadOrder(id: number): void {
    this.isLoading = true;
    this.error = '';
    this.orderService.getMyOrderById(id).subscribe({
      next: (order) => {
        this.order = order;
        this.isLoading = false;
        
        const now = new Date();
        this.maxTransferDate = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
        
        if (order.createdAt) {
          const cDate = new Date(order.createdAt);
          this.minTransferDate = cDate.getFullYear() + '-' + String(cDate.getMonth() + 1).padStart(2, '0') + '-' + String(cDate.getDate()).padStart(2, '0');
        }

        if (order.paymentMethod === 'BANK_TRANSFER' || order.paymentMethod === 'TRANSFER') {
          this.loadPaymentInstructions(id);
        }
        if (order.hasPaymentProof) {
          this.loadProofMetadata(id);
        }
        
        if (order.deliveryType === 'PICKUP_STORE' && order.pickupStatus === 'READY_FOR_PICKUP') {
          this.loadPickupCode(id);
        }
        
        this.loadTimeline(id);
      },
      error: (err) => {
        this.isLoading = false;
        if (err?.status === 403 || err?.status === 404) {
          this.error = 'No tienes permiso para ver este pedido o no existe.';
        } else if (err?.status === 401) {
          this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
        } else {
          this.error = 'No pudimos cargar los detalles del pedido.';
        }
      }
    });
  }

  isPayingWithMP = false;

  payWithMercadoPago(): void {
    if (!this.order) return;
    this.isPayingWithMP = true;
    this.orderService.createPayment(this.order.id, { provider: 'MERCADO_PAGO' }).subscribe({
      next: (response) => {
        if (response.checkoutUrl) {
          window.location.href = response.checkoutUrl;
        } else {
          this.isPayingWithMP = false;
          Swal.fire('Error', 'No se recibió la URL de pago de Mercado Pago', 'error');
        }
      },
      error: (err) => {
        this.isPayingWithMP = false;
        console.error('Error al crear pago MP:', err);
        if (err.status === 409) {
          Swal.fire('Atención', 'Ya existe un intento de pago activo para esta orden.', 'warning');
        } else {
          Swal.fire('Error', 'No se pudo iniciar el pago con Mercado Pago', 'error');
        }
      }
    });
  }

  canClientCancel(): boolean {
    if (!this.order) return false;
    return this.orderService.canClientCancel(this.order.status);
  }

  openCancelModal(): void {
    this.cancelReason = '';
    this.cancelError = '';
    this.showCancelModal = true;
  }

  closeCancelModal(): void {
    this.showCancelModal = false;
    this.cancelError = '';
  }

  confirmCancel(): void {
    if (!this.order || this.isCancelling) return;
    this.isCancelling = true;
    this.cancelError = '';

    const request = { reason: this.cancelReason.trim() || 'Cancelado por el cliente' };

    this.orderService.cancelMyOrder(this.order.id, request).subscribe({
      next: (updated) => {
        this.order = updated;
        this.isCancelling = false;
        this.showCancelModal = false;
        Swal.fire({
          icon: 'success',
          title: 'Pedido cancelado',
          text: 'Tu pedido ha sido cancelado correctamente.',
          confirmButtonColor: '#722f37'
        });
      },
      error: (err) => {
        this.isCancelling = false;
        const msg = err?.error?.error ?? err?.error?.message;
        if (msg) {
          this.cancelError = msg;
        } else if (err?.status === 400) {
          this.cancelError = 'No se pudo cancelar el pedido. Verifica su estado actual.';
        } else {
          this.cancelError = 'Error al cancelar. Inténtalo de nuevo.';
        }
      }
    });
  }

  loadPickupCode(orderId: number): void {
    this.loadingPickupCode = true;
    this.pickupCodeError = '';
    this.orderService.getMyOrderPickupCode(orderId).subscribe({
      next: (res) => {
        this.pickupCode = res.pickupCode;
        this.loadingPickupCode = false;
      },
      error: (err) => {
        this.loadingPickupCode = false;
        if (err.status !== 404) {
          this.pickupCodeError = 'No se pudo cargar el código de recolección.';
        }
      }
    });
  }

  getStatusBadgeClass(status: OrderStatus): string {
    const map: Record<string, string> = {
      PENDING: 'badge-amber', CONFIRMED: 'badge-blue', PROCESSING: 'badge-indigo',
      COMPLETED: 'badge-green', CANCELLED: 'badge-red'
    };
    return map[status] ?? 'badge-gray';
  }

  getStatusLabel(status: OrderStatus): string {
    const map: Record<string, string> = {
      PENDING: 'Pendiente', CONFIRMED: 'Confirmado', PROCESSING: 'En proceso',
      COMPLETED: 'Entregado', CANCELLED: 'Cancelado'
    };
    return map[status] ?? status;
  }

  getPaymentLabel(status: PaymentStatus): string {
    const map: Record<string, string> = {
      PENDING: 'Pendiente pago', PAID: 'Pagado', FAILED: 'Pago fallido',
      REFUNDED: 'Reembolsado', PARTIALLY_REFUNDED: 'Reembolso parcial'
    };
    return map[status] ?? status;
  }

  getShippingLabel(status: ShippingStatus): string {
    const map: Record<string, string> = {
      PENDING: 'Por preparar', PREPARING: 'Preparando', SHIPPED: 'Enviado',
      IN_TRANSIT: 'En camino', DELIVERED: 'Entregado', RETURNED: 'Devuelto'
    };
    return map[status] ?? status;
  }

  getPaymentMethodLabel(method: string | undefined): string {
    if (!method) return '—';
    const map: Record<string, string> = {
      CASH_ON_DELIVERY: 'Pago al recibir',
      BANK_TRANSFER: 'Transferencia bancaria',
      MERCADO_PAGO: 'Mercado Pago'
    };
    return map[method] ?? method;
  }
  
  getDeliveryTypeLabel(type: string | undefined): string {
    if (!type) return 'Estándar';
    const map: Record<string, string> = {
      PICKUP_STORE: 'Recoger en tienda',
      LOCAL_DELIVERY: 'Envío local (Huejutla)',
      EXTERNAL_SHIPPING_QUOTE: 'Envío foráneo (Cotización)'
    };
    return map[type] ?? type;
  }

  getCancelSourceLabel(source: string | undefined): string {
    const map: Record<string, string> = {
      CUSTOMER: 'Por el cliente',
      ADMIN: 'Por el administrador',
      SYSTEM: 'Por el sistema'
    };
    return source ? (map[source] ?? source) : '';
  }

  formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('es-MX', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = '/https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_400/v1782840424/Dise%C3%B1o_sin_t%C3%ADtulo_4_xruh6t.png';
  }

  // ==================== LÓGICA DE COMPROBANTE DE PAGO ====================

  loadPaymentInstructions(orderId: number): void {
    this.loadingInstructions = true;
    this.orderService.getPaymentInstructions(orderId).subscribe({
      next: (instructions) => {
        this.paymentInstructions = instructions;
        this.loadingInstructions = false;
        
        if (instructions?.paymentDeadline && !instructions.isPaymentDeadlineExpired) {
          this.startCountdown(instructions.paymentDeadline);
        }
      },
      error: (err) => {
        console.error('Error cargando instrucciones de pago', err);
        this.loadingInstructions = false;
      }
    });
  }

  private startCountdown(deadlineStr: string): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }

    // El formato de paymentDeadline es "dd/MM/yyyy HH:mm"
    const parts = deadlineStr.split(' ');
    const dateParts = parts[0].split('/');
    const timeParts = parts[1].split(':');
    
    if (dateParts.length !== 3 || timeParts.length !== 2) return;
    
    // Meses en JS son 0-index
    const deadlineDate = new Date(
      parseInt(dateParts[2], 10), 
      parseInt(dateParts[1], 10) - 1, 
      parseInt(dateParts[0], 10),
      parseInt(timeParts[0], 10),
      parseInt(timeParts[1], 10)
    ).getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const distance = deadlineDate - now;

      if (distance <= 0) {
        clearInterval(this.countdownInterval);
        this.remainingTimeText = '';
        if (this.paymentInstructions) {
          this.paymentInstructions.isPaymentDeadlineExpired = true;
        }
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));

      this.remainingTimeText = `${days} días ${hours} h ${minutes} min`;
      this.isAlmostExpired = distance < (12 * 60 * 60 * 1000); // menos de 12 hrs
    };

    updateTimer();
    this.countdownInterval = setInterval(updateTimer, 60000); // actualizar cada minuto
  }

  copyToClipboard(text: string | number | undefined | null, fieldName: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text.toString()).then(() => {
      Swal.fire({
        toast: true,
        position: 'bottom-end',
        icon: 'success',
        title: `${fieldName} copiado al portapapeles`,
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    }).catch(err => {
      console.error('No se pudo copiar el texto', err);
    });
  }

  ngOnDestroy(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }

  loadProofMetadata(orderId: number): void {
    this.orderService.getMyPaymentProof(orderId).subscribe({
      next: (proof) => {
        this.proofMetadata = proof;
      },
      error: (err) => {
        console.error('Error cargando metadata del comprobante', err);
      }
    });
  }

  onFileSelected(event: any): void {
    this.uploadError = '';
    const file = event.target.files[0];
    if (!file) {
      this.selectedFile = null;
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.uploadError = 'El archivo supera el límite de 5 MB.';
      this.selectedFile = null;
      event.target.value = '';
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      this.uploadError = 'Solo se permiten archivos JPG, PNG o PDF.';
      this.selectedFile = null;
      event.target.value = '';
      return;
    }

    this.selectedFile = file;
  }

  submitProof(): void {
    if (!this.order || !this.selectedFile) {
      this.uploadError = 'Debes seleccionar un archivo.';
      return;
    }
    
    if (this.proofForm.invalid) {
      this.uploadError = 'Verifica los campos del formulario.';
      return;
    }

    this.isUploading = true;
    this.uploadError = '';

    const formData = new FormData();
    formData.append('file', this.selectedFile);

    const values = this.proofForm.value;
    if (values.referenceNumber) formData.append('referenceNumber', values.referenceNumber);
    if (values.bankName) formData.append('bankName', values.bankName);
    if (values.amountDeclared) formData.append('amountDeclared', values.amountDeclared);
    if (values.transferDate) formData.append('transferDate', values.transferDate);
    if (values.notes) formData.append('notes', values.notes);

    this.orderService.uploadPaymentProof(this.order.id, formData).subscribe({
      next: (proof) => {
        this.isUploading = false;
        this.proofMetadata = proof;
        if (this.order) {
          this.order.hasPaymentProof = true;
          this.order.paymentProofStatus = proof.status;
          this.loadTimeline(this.order.id);
        }
        Swal.fire({
          icon: 'success',
          title: 'Comprobante subido',
          text: 'Tu comprobante está en revisión.',
          confirmButtonColor: '#722f37'
        });
      },
      error: (err) => {
        this.isUploading = false;
        const msg = err?.error?.error ?? err?.error?.message ?? 'Error al subir comprobante.';
        this.uploadError = msg;
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
    if (!this.order) return;
    
    this.showProofPreviewModal = true;
    this.loadingProofPreview = true;
    this.proofPreviewError = null;
    this.proofPreviewOrderNumber = this.order.orderNumber;
    this.proofPreviewStatus = this.order.paymentProofStatus || 'PENDING_REVIEW';
    
    this.orderService.getMyPaymentProofFile(this.order.id).subscribe({
      next: async (response) => {
        this.loadingProofPreview = false;
        const rawBlob = response.body;

        const contentType = response.headers.get('Content-Type') || (rawBlob as any)?.type || 'application/pdf';
        const typedBlob = new Blob([rawBlob as Blob], { type: contentType });

        // LOGS TEMPORALES DIAGNOSTICO
        console.log('--- DIAGNOSTICO PDF.JS CLIENTE ---');
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
        console.log('----------------------------------');

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
    this.proofPreviewUrl = null;
    this.proofPreviewSafeUrl = null;
    this.proofPreviewBlob = null;
    this.proofPreviewContentType = null;
    this.pdfDocument = null;
  }

  // ==================== TIMELINE CLIENTE ====================

  loadTimeline(orderId: number): void {
    this.loadingTimeline = true;
    this.timelineError = null;
    this.orderService.getMyOrderTimeline(orderId).subscribe({
      next: (events) => {
        this.timeline = events.map(event => this.mapClientTimelineEvent(event));
        this.loadingTimeline = false;
      },
      error: (err) => {
        console.error('Error loading timeline:', err);
        this.timelineError = 'No se pudo cargar el historial en este momento.';
        this.loadingTimeline = false;
      }
    });
  }

  private sanitizeCustomerTimelineText(text: string, eventType: string): string {
    if (!text) return '';
    const technicalTerms = [
      'BANK_TRANSFER_PROOF_APPROVED', 'BANK_PROOF_UPLOADED', 'PAYMENT_APPROVED',
      'ORDER_CONFIRMED', 'SYSTEM_EXPIRATION', 'ADMIN_PANEL', 'metadata_json',
      'source', 'actorType', 'null', 'undefined', 'Fuente:', 'Fuente'
    ];
    
    let hasTechnical = false;
    for (const term of technicalTerms) {
      if (text.includes(term)) {
        hasTechnical = true;
        break;
      }
    }
    
    if (text.includes('{') || text.includes('[')) {
      hasTechnical = true;
    }
    
    if (hasTechnical) {
      // Fallbacks amigables
      switch(eventType) {
        case 'ORDER_CREATED': return 'Tu pedido fue registrado correctamente.';
        case 'BANK_PROOF_UPLOADED': return 'Recibimos tu comprobante de pago. Está pendiente de revisión.';
        case 'BANK_PROOF_APPROVED': return 'Tu comprobante fue revisado correctamente.';
        case 'PAYMENT_APPROVED': return 'Tu pago fue confirmado correctamente. Ahora prepararemos tu pedido para continuar con el proceso.';
        case 'ORDER_CONFIRMED': return 'Tu pedido fue confirmado y está listo para ser preparado.';
        case 'ORDER_CANCELLED': return 'La orden fue cancelada.';
        case 'ORDER_EXPIRED': return 'La orden expiró porque no se confirmó el pago dentro del plazo establecido.';
        case 'MERCADO_PAGO_WEBHOOK_RECEIVED': return 'Recibimos una actualización del estado de tu pago.';
        case 'MERCADO_PAGO_REQUERY': return 'El estado de tu pago fue verificado nuevamente.';
        case 'TRACKING_NUMBER_UPDATED': return 'Se agregó o actualizó la información de rastreo de tu pedido.';
        default: return 'El estado de tu pedido fue actualizado.';
      }
    }
    
    return text;
  }

  private mapClientTimelineEvent(event: OrderTimelineEvent): OrderTimelineEvent {
    const titleMap: Record<string, string> = {
      'ORDER_CREATED': 'Orden creada',
      'BANK_PROOF_UPLOADED': 'Comprobante enviado',
      'BANK_PROOF_REJECTED': 'Comprobante rechazado',
      'BANK_PROOF_APPROVED': 'Comprobante aprobado',
      'PAYMENT_APPROVED': 'Pago aprobado',
      'ORDER_CONFIRMED': 'Pedido confirmado',
      'ORDER_STATUS_CHANGED': 'Pedido actualizado',
      'SHIPPING_STATUS_CHANGED': 'Actualización de envío',
      'TRACKING_NUMBER_UPDATED': 'Número de rastreo actualizado',
      'ORDER_CANCELLED': 'Orden cancelada',
      'ORDER_EXPIRED': 'Orden expirada',
      'MERCADO_PAGO_WEBHOOK_RECEIVED': 'Actualización de pago',
      'MERCADO_PAGO_REQUERY': 'Pago verificado',
      'PICKUP_AUTHORIZED': 'Personas autorizadas registradas',
      'PICKUP_CODE_GENERATED': 'Recolección preparada',
      'PICKUP_READY': 'Pedido listo para recoger',
      'PICKUP_CODE_VERIFIED': 'Código verificado',
      'ORDER_PICKED_UP': 'Pedido recolectado',
      'PICKUP_CODE_REGENERATED': 'Código actualizado',
      'PICKUP_VERIFICATION_FAILED': 'Intento de recolección fallido'
    };

    if (event.eventType === 'SHIPPING_STATUS_CHANGED') {
      const shippingTitleMap: Record<string, string> = {
        'PREPARING': 'Pedido en preparación',
        'SHIPPED': 'Pedido enviado',
        'DELIVERED': 'Pedido entregado',
        'IN_TRANSIT': 'Pedido en camino',
        'RETURNED': 'Pedido devuelto'
      };
      const shippingDescMap: Record<string, string> = {
        'PREPARING': 'Estamos preparando tu pedido.',
        'SHIPPED': 'Tu pedido fue enviado.',
        'DELIVERED': 'Tu pedido fue entregado.',
        'IN_TRANSIT': 'Tu pedido está en camino.',
        'RETURNED': 'El pedido fue marcado como devuelto.'
      };
      if (event.shippingStatusAfter && shippingTitleMap[event.shippingStatusAfter]) {
        event.title = shippingTitleMap[event.shippingStatusAfter];
        event.description = shippingDescMap[event.shippingStatusAfter];
      } else {
        event.title = titleMap[event.eventType] || 'Actualización de la orden';
      }
    } else if (event.eventType === 'ORDER_STATUS_CHANGED') {
      const statusDescMap: Record<string, string> = {
        'CONFIRMED': 'Tu pedido fue confirmado.',
        'PROCESSING': 'Estamos preparando tu pedido.',
        'COMPLETED': 'Tu pedido fue completado.',
        'CANCELLED': 'La orden fue cancelada.'
      };
      event.title = titleMap[event.eventType] || 'Pedido actualizado';
      if (event.orderStatusAfter && statusDescMap[event.orderStatusAfter]) {
        event.description = statusDescMap[event.orderStatusAfter];
      } else {
        event.description = 'El estado de tu pedido fue actualizado.';
      }
    } else if (event.eventType.startsWith('PICKUP_') || event.eventType === 'ORDER_PICKED_UP') {
      const pickupDescMap: Record<string, string> = {
        'PICKUP_AUTHORIZED': 'Se registraron personas autorizadas para recoger el pedido.',
        'PICKUP_CODE_GENERATED': 'Se generó el código de recolección. Lo verás cuando tu pedido esté listo para recoger.',
        'PICKUP_READY': 'Tu pedido ya puede recogerse en tienda con el código de recolección y una identificación oficial.',
        'PICKUP_CODE_VERIFIED': 'El código de recolección fue validado en tienda.',
        'ORDER_PICKED_UP': 'El pedido fue recolectado en tienda.',
        'PICKUP_CODE_REGENERATED': 'Se generó un nuevo código de recolección.',
        'PICKUP_VERIFICATION_FAILED': 'Hubo un problema al validar el código de recolección.'
      };
      event.title = titleMap[event.eventType] || 'Actualización de recolección';
      event.description = pickupDescMap[event.eventType] || 'El estado de recolección fue actualizado.';
    } else {
      event.title = titleMap[event.eventType] || 'Actualización de la orden';
    }
    
    if (event.eventType === 'BANK_PROOF_REJECTED') {
      let rawDesc = event.description || '';
      // Si el backend mandó "El comprobante fue rechazado... Motivo: blabla", intentamos extraer el motivo.
      let motive = '';
      if (rawDesc.includes('Motivo:')) {
         motive = rawDesc.split('Motivo:')[1].trim();
      } else if (rawDesc && !rawDesc.includes('{') && !rawDesc.includes('Fuente')) {
         motive = rawDesc;
      }
      
      if (motive) {
         event.description = `Motivo: ${motive}`;
      } else {
         event.description = 'Tu comprobante fue rechazado. Revisa el motivo y sube uno nuevo si el plazo sigue vigente.';
      }
    } else if (event.eventType !== 'SHIPPING_STATUS_CHANGED' && event.eventType !== 'ORDER_STATUS_CHANGED') {
      event.description = this.sanitizeCustomerTimelineText(event.description || '', event.eventType);
    }

    return event;
  }

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
        text: 'El navegador bloqueó la nueva pestaña. Usa el botón Descargar comprobante.',
        confirmButtonColor: '#722f37'
      });
    }
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
    console.error('Error descargando blob', err);
    
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
    Swal.fire('Error', message, 'error');
  }
}
