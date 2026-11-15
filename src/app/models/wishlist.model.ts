// ============================================
// WISHLIST MODELS — Fase 2 E-Commerce
// Campos alineados con WishlistDTO.java del backend
// ============================================

/**
 * Item individual de la wishlist.
 * Corresponde a WishlistDTO.WishlistItemResponse del backend.
 */
export interface WishlistItem {
  wishlistId: number;           // ID del registro en la tabla wishlists
  productId: number;
  productName: string;
  productImage: string | null;
  productSku: string;
  currentPrice: number;
  priceWhenAdded: number | null;
  priceDifference: number;
  discountPercentage: number;
  priceDropped: boolean;
  availableStock: number;
  inStock: boolean;
  priority: number;             // 1=LOW, 2=MEDIUM, 3=HIGH
  priorityLabel: string;        // 'LOW' | 'MEDIUM' | 'HIGH'
  notes: string | null;
  notifiedBackInStock: boolean;
  notifiedDiscount: boolean;
  addedAt: string;
  updatedAt: string | null;
}

/**
 * Respuesta del GET /api/wishlist
 * Corresponde a WishlistDTO.WishlistResponse
 */
export interface WishlistResponse {
  items: WishlistItem[];
  totalItems: number;
  highPriorityItems: number;
  outOfStockItems: number;
  priceDroppedItems: number;
}

/**
 * Respuesta del GET /api/wishlist/check/{productId}
 * Corresponde a WishlistDTO.CheckResponse
 */
export interface WishlistCheckResponse {
  inWishlist: boolean;
  wishlistId: number | null;
}

/**
 * Resumen de la wishlist.
 * Corresponde a WishlistDTO.WishlistSummaryResponse
 */
export interface WishlistSummary {
  totalItems: number;
  highPriorityCount: number;
  mediumPriorityCount: number;
  lowPriorityCount: number;
  inStockCount: number;
  outOfStockCount: number;
  priceDroppedCount: number;
  totalValue: number;
  potentialSavings: number;
}

/**
 * Request para agregar a wishlist.
 * Corresponde a WishlistDTO.AddToWishlistRequest
 */
export interface AddToWishlistRequest {
  productId: number;
  priority?: number;    // 1 | 2 | 3 — default 2 (MEDIUM)
  notes?: string;
}

/**
 * Request para actualizar un item.
 * Corresponde a WishlistDTO.UpdateWishlistRequest
 */
export interface UpdateWishlistRequest {
  priority?: number;
  notes?: string;
}

/**
 * Notificación de wishlist (bajada de precio o vuelta a stock).
 * Corresponde a WishlistDTO.WishlistNotification
 */
export interface WishlistNotification {
  wishlistId: number;
  productId: number;
  productName: string;
  notificationType: 'PRICE_DROP' | 'BACK_IN_STOCK';
  message: string;
  currentPrice: number | null;
  previousPrice: number | null;
  discountPercentage: number | null;
  notifiedAt: string | null;
}
