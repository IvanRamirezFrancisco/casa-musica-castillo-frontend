export interface Product {
  id?: number;
  name: string;
  description?: string;
  price: number;
  discountPrice?: number;
  stock: number;
  imageUrl?: string;
  secondaryImages?: string;
  sku: string;
  categoryId: number;
  categoryName?: string;
  active?: boolean;
  featured?: boolean;
  brand?: string;
  model?: string;
  weight?: number;
  dimensions?: string;
  views?: number;
  salesCount?: number;
  images?: ProductImageResponse[];
}

export interface ProductImageResponse {
  id: number;
  productId: number;
  imageUrl: string;
  publicId?: string;
  contentType?: string;
  fileSizeBytes?: number;
  provider?: string;
  isPrimary: boolean;
  displayOrder: number;
  altText?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Category {
  id?: number;
  name: string;
  description?: string;
  imageUrl?: string;
  active?: boolean;
}

export interface Customer {
  id?: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  active?: boolean;
  totalOrders?: number;
  totalSpent?: number;
  createdAt?: Date;
}

export interface Order {
  id?: number;
  orderNumber: string;
  customerId: number;
  customerName?: string;
  items?: OrderItem[];
  subtotal: number;
  tax?: number;
  shipping?: number;
  discount?: number;
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  transactionId?: string;
  shippingAddress?: string;
  trackingNumber?: string;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OrderItem {
  id?: number;
  productId: number;
  productName: string;
  productSku: string;
  unitPrice: number;
  quantity: number;
  discount?: number;
  subtotal: number;
}

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED'
}

export enum PaymentMethod {
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  PAYPAL = 'PAYPAL',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CASH_ON_DELIVERY = 'CASH_ON_DELIVERY',
  MERCADO_PAGO = 'MERCADO_PAGO',
  STRIPE = 'STRIPE'
}

export interface DashboardStats {
  monthSales: number;
  totalOrders: number;
  totalProducts: number;
  totalCustomers: number;
  pendingOrders: number;
  completedOrders: number;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}
