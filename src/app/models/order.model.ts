/**
 * 📦 Modelos para Órdenes - Reflejan los DTOs del Backend
 */

// ==================== ENUMS ====================

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED'
}

export enum ShippingStatus {
  PENDING = 'PENDING',
  PREPARING = 'PREPARING',
  SHIPPED = 'SHIPPED',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  RETURNED = 'RETURNED'
}

export enum PaymentProofStatus {
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export type PickupStatus =
  | 'NOT_APPLICABLE'
  | 'WAITING_PAYMENT'
  | 'PAID_WAITING_PREPARATION'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP'
  | 'CANCELLED';

// ==================== INTERFACES ====================

export interface OrderItem {
  id: number;
  productId: number;
  productName: string;
  productSku: string;
  productImage?: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface Order {
  // Basic Info
  id: number;
  orderNumber: string;
  orderDate: string;

  // Customer Info
  userId: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;

  // Totals
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;

  // States (con displayNames)
  status: OrderStatus;
  statusDisplayName: string;
  paymentStatus: PaymentStatus;
  paymentStatusDisplayName: string;
  shippingStatus: ShippingStatus;
  shippingStatusDisplayName: string;

  // Payment Info
  paymentMethod?: string;
  transactionId?: string;

  // Shipping Info
  shippingAddress?: string;
  billingAddress?: string;
  trackingNumber?: string;
  // Items
  items: OrderItem[];
  totalItems: number;

  // Notes
  notes?: string;
  customerNotes?: string;
  cancellationReason?: string;
  cancelledBy?: number;
  cancelSource?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  shippedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;

  // Business Logic Flags
  canBeCancelled?: boolean;
  canBeRefunded?: boolean;
  canUpdateShipping?: boolean;

  // Payment Proof Fields
  hasPaymentProof?: boolean;
  paymentProofStatus?: PaymentProofStatus;
  paymentProofUploadedAt?: string;
  paymentProofRejectionReason?: string;
  
  // Delivery/Shipping Additions
  deliveryType?: 'PICKUP_STORE' | 'LOCAL_DELIVERY' | 'EXTERNAL_SHIPPING_QUOTE';
  pickupCodeLast4?: string;
  pickupCodeAvailable?: boolean;
  pickupReadyAt?: string;
  pickedUpAt?: string;
  pickedUpByName?: string;
  pickedUpByAuthorizationId?: number;
  pickupStatus?: PickupStatus;
  authorizedPersons?: AuthorizedPersonDTO[];
}

export interface OrderStats {
  totalOrders: number;
  pendingOrders: number;
  confirmedOrders: number;
  processingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
}

export interface OrderFilters {
  search?: string;
  orderStatus?: OrderStatus | null;
  paymentStatus?: PaymentStatus | null;
  shippingStatus?: ShippingStatus | null;
  startDate?: string;
  endDate?: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

// ==================== CHECKOUT ====================

export type PaymentMethodType = 'CASH_ON_DELIVERY' | 'BANK_TRANSFER' | 'MERCADO_PAGO';

export interface AuthorizedPersonDTO {
  id?: number;
  fullName: string;
  isPrimary?: boolean;
}

export interface CheckoutRequest {
  deliveryOption: 'PICKUP_STORE' | 'LOCAL_DELIVERY' | 'EXTERNAL_SHIPPING_QUOTE';
  state?: string;
  city?: string;
  postalCode?: string;
  shippingAddress: string;
  billingAddress: string;
  paymentMethod: PaymentMethodType;
  notes?: string;
  authorizedPersons?: AuthorizedPersonDTO[];
}

export interface CancelOrderRequest {
  reason?: string;
}

// ==================== COMPROBANTES DE PAGO ====================

export interface PaymentProofResponse {
  id: number;
  orderId: number;
  orderNumber: string;
  originalFilename: string;
  contentType: string;
  fileSizeBytes: number;
  status: PaymentProofStatus;
  referenceNumber?: string;
  bankName?: string;
  amountDeclared?: number;
  transferDate?: string;
  notes?: string;
  uploadedAt: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export interface RejectPaymentProofRequest {
  reason: string;
}

// ==================== CONFIGURACIÓN DE TRANSFERENCIA BANCARIA ====================

export interface PaymentInstructionsResponse {
  configured: boolean;
  bankName?: string;
  accountHolder?: string;
  clabe?: string;
  accountNumber?: string;
  concept?: string;
  amount?: number;
  orderNumber?: string;
  referenceInstructions?: string;
  additionalInstructions?: string;
  paymentDeadline?: string;
  isPaymentDeadlineExpired?: boolean;
}

export interface OrderTransitionsDTO {
  currentOrderStatus: OrderStatus;
  currentPaymentStatus: PaymentStatus;
  currentShippingStatus: ShippingStatus;
  allowedOrderStatuses: OrderStatus[];
  allowedShippingStatuses: ShippingStatus[];
  canUpdateOrderStatus: boolean;
  canUpdateShippingStatus: boolean;
  canUpdateTrackingNumber: boolean;
  canCancelOrder: boolean;
  requiresCancelReason: boolean;
  orderStatusHelpMessage: string;
  shippingStatusHelpMessage: string;
  cancelOrderHelpMessage: string;
}

export interface OrderTimelineEvent {
  id: number;
  eventType: string;
  title: string;
  description: string;
  orderStatusBefore?: string;
  orderStatusAfter?: string;
  paymentStatusBefore?: string;
  paymentStatusAfter?: string;
  shippingStatusBefore?: string;
  shippingStatusAfter?: string;
  actorLabel?: string;
  source?: string;
  visibility?: string;
  createdAt: string;
}

export interface PricePreviewRequest {
  deliveryOption: string;
  state?: string;
  city?: string;
  postalCode?: string;
}

export interface PricePreviewResponse {
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  deliveryMethod?: string;
  deliveryLabel?: string;
  requiresAddress?: boolean;
  requiresQuote?: boolean;
  canProceedToPayment?: boolean;
  message?: string;
  contactWhatsapp?: string;
  contactPhone?: string;
  quoteMessage?: string;
  businessHours?: string;
}

export interface ShippingSettings {
  id?: number;
  pickupEnabled: boolean;
  pickupLabel?: string;
  pickupAddress?: string;
  pickupInstructions?: string;
  pickupHours?: string;
  localDeliveryEnabled: boolean;
  localDeliveryCost?: number;
  localDeliveryState?: string;
  localDeliveryCity?: string;
  localDeliveryPostalCodes?: string;
  externalShippingEnabled: boolean;
  externalShippingMode: string; // 'FIXED_COST' | 'QUOTE_REQUIRED'
  externalShippingFixedCost?: number;
  contactWhatsapp?: string;
  contactPhone?: string;
  quoteMessage?: string;
  businessHours?: string;
}

export interface AuthorizedPersonDTO {
  fullName: string;
  ineHash?: string;
}
