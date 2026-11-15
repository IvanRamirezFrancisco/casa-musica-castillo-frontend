import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  BehaviorSubject, Observable, Subject,
  catchError, tap, throwError, EMPTY
} from 'rxjs';
import { CartItem, Product } from '../models/product.model';
import { CartValidationResponse } from '../models/cart.model';
import { environment } from '../../environments/environment';

// FASE 1.2 - Carrito UX - 2026-05-15

export interface CartAnimation {
  productId: string;
  productName: string;
  productImage: string;
  startX: number;
  startY: number;
}

/** Extiende CartItem con metadatos del backend para operaciones de update/delete. */
export interface BackendCartItem extends CartItem {
  backendItemId: number;
  backendUnitPrice: number;
  availableStock: number;
  available?: boolean;
  availabilityStatus?: string;
  warningMessage?: string;
}

/** Shape de un item devuelto por el backend. */
interface CartItemResponse {
  itemId: number;
  productId: number;
  productName: string;
  productImage?: string;
  productSku?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  availableStock?: number;
  available?: boolean;
  availabilityStatus?: string;
  warningMessage?: string;
  addedAt?: string;
}

/** Respuesta completa del carrito devuelta por el backend. */
interface CartResponse {
  cartId: number;
  userId?: number;
  items: CartItemResponse[];
  totalItems?: number;
  itemCount?: number;
  subtotal: number;
  tax?: number;
  taxRate?: number;
  discount?: number;
  shippingCost?: number;
  total: number;
  canCheckout?: boolean;
  unavailableItemsCount?: number;
  unavailableItemsTotal?: number;
  warningMessage?: string;
  couponCode?: string;
  appliedCoupon?: unknown;
  status?: string;
  expiresAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {

  // Base path del carrito — coincide con ShoppingCartController.
  private readonly API = `${environment.apiUrl}/cart`;

  private http = inject(HttpClient);
  private router = inject(Router);

  // ── Estado interno ─────────────────────────────────────────────────────────
  private cartItems: BackendCartItem[] = [];
  private cartId: number | null = null;
  private backendSubtotal = 0;
  private backendTax = 0;
  private backendDiscount = 0;
  private backendShipping = 0;
  private backendTotal = 0;
  private backendUnavailableTotal = 0;
  private backendCanCheckout = true;
  private backendWarningMessage: string | null = null;
  private couponCode: string | null = null;

  // ── Subjects públicos (API pública estable) ────────────────────────────────
  private cartItemsSubject = new BehaviorSubject<BackendCartItem[]>([]);
  private cartTotalSubject = new BehaviorSubject<number>(0);
  private cartCountSubject = new BehaviorSubject<number>(0);
  private canCheckoutSubject = new BehaviorSubject<boolean>(true);
  private warningMessageSubject = new BehaviorSubject<string | null>(null);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private addToCartAnimationSubject = new Subject<CartAnimation>();

  /** Array reactivo de items del carrito (BackendCartItem extiende CartItem). */
  public cartItems$ = this.cartItemsSubject.asObservable();
  public cartTotal$ = this.cartTotalSubject.asObservable();
  public cartCount$ = this.cartCountSubject.asObservable();
  public canCheckout$ = this.canCheckoutSubject.asObservable();
  public warningMessage$ = this.warningMessageSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();
  public addToCartAnimation$ = this.addToCartAnimationSubject.asObservable();

  constructor() {
    localStorage.removeItem('music-store-cart');
  }

  // ── Ciclo de vida del carrito ──────────────────────────────────────────────

  /**
   * Carga el carrito del usuario autenticado desde el backend.
   *
   * Backend endpoint: GET /api/cart
   *
   * Devuelve Observable<void> para que el componente pueda suscribirse
   * y gestionar estados de carga/error en la vista.
   *
   * En caso de 401: el interceptor redirige a /login automáticamente.
   */
  loadCart(): Observable<void> {
    this.loadingSubject.next(true);
    return this.http.get<CartResponse>(this.API).pipe(
      tap(cart => {
        this.applyCartResponse(cart);
        this.loadingSubject.next(false);
      }),
      catchError(err => {
        this.loadingSubject.next(false);
        this.clearLocal();
        return throwError(() => err);
      }),
      // Convertir a Observable<void> para no exponer la respuesta interna
      tap(() => { }),
      catchError(err => throwError(() => err))
    ) as unknown as Observable<void>;
  }

  /**
   * Limpia el estado del carrito en memoria sin llamar al backend.
   * Llamado por AuthService al hacer logout.
   */
  clearLocal(): void {
    this.cartItems = [];
    this.cartId = null;
    this.backendSubtotal = 0;
    this.backendTax = 0;
    this.backendDiscount = 0;
    this.backendShipping = 0;
    this.backendTotal = 0;
    this.backendUnavailableTotal = 0;
    this.backendCanCheckout = true;
    this.backendWarningMessage = null;
    this.couponCode = null;
    this.emitState();
  }

  // ── Operaciones del carrito ────────────────────────────────────────────────

  /**
   * Agrega un producto al carrito del usuario autenticado.
   *
   * Backend endpoint: POST /api/cart/items
   * FASE 1.2: La animación de éxito SOLO se dispara tras respuesta exitosa del backend.
   *
   * Validaciones previas:
   *  - product.id convertible a número > 0
   *  - quantity entero > 0
   */
  addToCart(
    product: Product,
    quantity: number = 1,
    options?: { [key: string]: string },
    animationData?: { x: number; y: number }
  ): void {
    if (!this.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }

    const productIdNum = Number(product.id);
    if (!productIdNum || productIdNum <= 0) {
      if (!environment.production) { console.warn('[CartService] addToCart: productId inválido', product.id); }
      return;
    }

    const safeQty = Math.floor(quantity);
    if (!safeQty || safeQty <= 0) {
      if (!environment.production) { console.warn('[CartService] addToCart: quantity inválida', quantity); }
      return;
    }

    this.loadingSubject.next(true);
    this.http.post<CartResponse>(`${this.API}/items`, { productId: productIdNum, quantity: safeQty })
      .subscribe({
        next: cart => {
          this.applyCartResponse(cart);
          this.loadingSubject.next(false);
          // FASE 1.2: Animación SOLO tras éxito del backend
          if (animationData) {
            this.addToCartAnimationSubject.next({
              productId: product.id,
              productName: product.name,
              productImage: product.images?.length > 0 ? product.images[0] : '',
              startX: animationData.x,
              startY: animationData.y
            });
          }
        },
        error: err => {
          this.loadingSubject.next(false);
          if (!environment.production) { console.error('[CartService] addToCart error:', err); }
        }
      });
  }

  /**
   * Elimina un item del carrito por su backendItemId.
   * El componente pasa directamente el itemId del backend.
   *
   * Backend endpoint: DELETE /api/cart/items/{itemId}
   */
  removeItemById(itemId: number): Observable<void> {
    if (!this.isLoggedIn() || itemId <= 0) {
      return EMPTY;
    }

    this.loadingSubject.next(true);
    return this.http.delete<CartResponse>(`${this.API}/items/${itemId}`).pipe(
      tap(cart => { this.applyCartResponse(cart); this.loadingSubject.next(false); }),
      catchError(err => {
        this.loadingSubject.next(false);
        if (!environment.production) { console.error('[CartService] removeItemById error:', err); }
        return throwError(() => err);
      })
    ) as unknown as Observable<void>;
  }

  /**
   * FASE 3: Mueve un item a la lista de deseos.
   *
   * Backend endpoint: POST /api/cart/items/{itemId}/move-to-wishlist
   */
  moveItemToWishlist(itemId: number): Observable<void> {
    if (!this.isLoggedIn() || itemId <= 0) {
      return EMPTY;
    }

    this.loadingSubject.next(true);
    return this.http.post<CartResponse>(`${this.API}/items/${itemId}/move-to-wishlist`, {}).pipe(
      tap(cart => { this.applyCartResponse(cart); this.loadingSubject.next(false); }),
      catchError(err => {
        this.loadingSubject.next(false);
        if (!environment.production) { console.error('[CartService] moveItemToWishlist error:', err); }
        return throwError(() => err);
      })
    ) as unknown as Observable<void>;
  }

  /**
   * Elimina un item por productId (string) — mantiene compatibilidad con componentes legacy.
   */
  removeFromCart(productId: string, options?: { [key: string]: string }): void {
    const item = this.cartItems.find(
      i => i.product.id === productId &&
        JSON.stringify(i.selectedOptions) === JSON.stringify(options)
    );
    if (!item?.backendItemId) {
      if (!environment.production) { console.warn('[CartService] removeFromCart: backendItemId no disponible', productId); }
      return;
    }
    this.removeItemById(item.backendItemId).subscribe();
  }

  /**
   * Actualiza la cantidad de un item por su backendItemId.
   * Si newQuantity <= 0, llama a removeItemById.
   *
   * Backend endpoint: PUT /api/cart/items/{itemId}
   */
  updateItemById(itemId: number, newQuantity: number): Observable<void> {
    if (!this.isLoggedIn()) { return EMPTY; }

    const safeQty = Math.floor(newQuantity);
    if (safeQty <= 0) {
      return this.removeItemById(itemId);
    }

    if (itemId <= 0) { return EMPTY; }

    this.loadingSubject.next(true);
    return this.http.put<CartResponse>(`${this.API}/items/${itemId}`, {
      itemId,
      quantity: safeQty
    }).pipe(
      tap(cart => { this.applyCartResponse(cart); this.loadingSubject.next(false); }),
      catchError(err => {
        this.loadingSubject.next(false);
        if (!environment.production) { console.error('[CartService] updateItemById error:', err); }
        return throwError(() => err);
      })
    ) as unknown as Observable<void>;
  }

  /**
   * Actualiza la cantidad por productId — mantiene compatibilidad con componentes legacy.
   */
  updateQuantity(productId: string, quantity: number, options?: { [key: string]: string }): void {
    const item = this.cartItems.find(
      i => i.product.id === productId &&
        JSON.stringify(i.selectedOptions) === JSON.stringify(options)
    );
    if (!item?.backendItemId) {
      if (!environment.production) { console.warn('[CartService] updateQuantity: backendItemId no disponible', productId); }
      return;
    }
    this.updateItemById(item.backendItemId, quantity).subscribe();
  }

  /**
   * Vacía el carrito completo del usuario autenticado.
   *
   * Backend endpoint: DELETE /api/cart
   */
  clearCart(): void {
    if (!this.isLoggedIn()) {
      this.clearLocal();
      return;
    }

    this.loadingSubject.next(true);
    this.http.delete<void | { message?: string }>(this.API).subscribe({
      next: () => { this.clearLocal(); this.loadingSubject.next(false); },
      error: err => {
        this.loadingSubject.next(false);
        if (!environment.production) { console.error('[CartService] clearCart error:', err); }
      }
    });
  }

  /**
   * Aplica un cupón al carrito.
   *
   * Backend endpoint: POST /api/cart/coupon
   */
  applyCoupon(code: string): Observable<void> {
    if (!this.isLoggedIn()) { return EMPTY; }

    const trimmedCode = (code ?? '').trim();
    if (!trimmedCode) { return EMPTY; }

    this.loadingSubject.next(true);
    return this.http.post<CartResponse>(`${this.API}/coupon`, { couponCode: trimmedCode }).pipe(
      tap(cart => { this.applyCartResponse(cart); this.loadingSubject.next(false); }),
      catchError(err => {
        this.loadingSubject.next(false);
        if (!environment.production) { console.error('[CartService] applyCoupon error:', err); }
        return throwError(() => err);
      })
    ) as unknown as Observable<void>;
  }

  /**
   * Elimina el cupón aplicado al carrito.
   *
   * Backend endpoint: DELETE /api/cart/coupon
   */
  removeCoupon(): void {
    if (!this.isLoggedIn()) { return; }

    this.loadingSubject.next(true);
    this.http.delete<CartResponse>(`${this.API}/coupon`).subscribe({
      next: cart => { this.applyCartResponse(cart); this.loadingSubject.next(false); },
      error: err => {
        this.loadingSubject.next(false);
        if (!environment.production) { console.error('[CartService] removeCoupon error:', err); }
      }
    });
  }

  /**
   * Valida el carrito antes del proceso de pago.
   *
   * Backend endpoint: GET /api/cart/validate
   */
  validateCart(): Observable<CartValidationResponse> {
    return this.http.get<CartValidationResponse>(`${this.API}/validate`).pipe(
      catchError(err => {
        if (!environment.production) { console.error('[CartService] validateCart error:', err); }
        return throwError(() => err);
      })
    );
  }

  /**
   * Transfiere el carrito de una sesión anónima al usuario autenticado.
   *
   * Backend endpoint: POST /api/cart/transfer
   */
  transferAnonymousCart(sessionId: string): void {
    const trimmedSession = (sessionId ?? '').trim();
    if (!trimmedSession) { return; }

    this.http.post<CartResponse>(`${this.API}/transfer`, { sessionId: trimmedSession }).subscribe({
      next: cart => this.applyCartResponse(cart),
      error: err => {
        if (!environment.production) { console.error('[CartService] transferAnonymousCart error:', err); }
      }
    });
  }

  // ── Helpers síncronos (API pública estable) ────────────────────────────────

  /** Devuelve una copia del array de ítems actual como BackendCartItem[]. */
  getCartItems(): BackendCartItem[] {
    return [...this.cartItems];
  }

  /** Subtotal calculado por el backend (sin IVA ni envío). */
  getCartTotal(): number { return this.backendSubtotal; }

  /** Número total de unidades en el carrito. */
  getCartCount(): number {
    return this.cartItems.reduce((count, item) => count + item.quantity, 0);
  }

  /** true si el producto ya está en el carrito. */
  isInCart(productId: string, options?: { [key: string]: string }): boolean {
    return this.cartItems.some(
      item => item.product.id === productId &&
        JSON.stringify(item.selectedOptions) === JSON.stringify(options)
    );
  }

  /** Cantidad actual de un producto específico en el carrito. */
  getProductQuantityInCart(productId: string, options?: { [key: string]: string }): number {
    const item = this.cartItems.find(
      i => i.product.id === productId &&
        JSON.stringify(i.selectedOptions) === JSON.stringify(options)
    );
    return item ? item.quantity : 0;
  }

  getSubtotal(): number { return this.backendSubtotal; }
  getTaxes(): number { return this.backendTax; }
  getDiscount(): number { return this.backendDiscount; }

  getShipping(): number {
    if (this.backendShipping > 0) return this.backendShipping;
    return this.backendSubtotal >= 1000 ? 0 : 50;
  }

  getFinalTotal(): number {
    return this.backendTotal > 0
      ? this.backendTotal + this.getShipping()
      : this.backendSubtotal + this.backendTax + this.getShipping() - this.backendDiscount;
  }

  getUnavailableItemsTotal(): number {
    return this.backendUnavailableTotal;
  }

  getAppliedCouponCode(): string | null { return this.couponCode; }

  // ── Privados ───────────────────────────────────────────────────────────────

  /**
   * Convierte la respuesta del backend al estado interno y emite los observables.
   * FASE 1.2: mapea backendItemId y availableStock como campos requeridos.
   */
  private applyCartResponse(cart: CartResponse): void {
    this.cartId = cart.cartId;
    this.backendSubtotal = cart.subtotal ?? 0;
    this.backendTax = cart.tax ?? 0;
    this.backendDiscount = cart.discount ?? 0;
    this.backendShipping = cart.shippingCost ?? 0;
    this.backendTotal = cart.total ?? 0;
    this.backendUnavailableTotal = cart.unavailableItemsTotal ?? 0;
    this.backendCanCheckout = cart.canCheckout ?? true;
    this.backendWarningMessage = cart.warningMessage ?? null;
    this.couponCode = cart.couponCode ?? null;

    this.cartItems = (cart.items ?? []).map(backendItem => {
      const existing = this.cartItems.find(
        ci => ci.product.id === String(backendItem.productId)
      );

      const availableStock = backendItem.availableStock ?? existing?.product?.stockQuantity ?? 0;

      const product: Product = existing?.product ?? ({
        id: String(backendItem.productId),
        name: backendItem.productName ?? 'Producto',
        shortDescription: backendItem.productName ?? 'Producto del carrito',
        price: backendItem.unitPrice ?? 0,
        images: backendItem.productImage ? [backendItem.productImage] : [],
        description: backendItem.productName ?? 'Producto del carrito',
        category: '',
        stockQuantity: availableStock,
        sku: backendItem.productSku ?? '',
        inStock: availableStock > 0,
        brand: '',
        rating: 0,
        reviewCount: 0,
        specifications: [],
        tags: [],
        featured: false,
        isNew: false,
        createdAt: new Date(),
        updatedAt: new Date()
      } as unknown as Product);

      product.stockQuantity = backendItem.availableStock ?? product.stockQuantity ?? 0;
      product.inStock = product.stockQuantity > 0;

      return {
        product,
        quantity: backendItem.quantity,
        selectedOptions: existing?.selectedOptions,
        backendItemId: backendItem.itemId,
        backendUnitPrice: backendItem.unitPrice,
        availableStock: backendItem.availableStock ?? 0,
        available: backendItem.available ?? true,
        availabilityStatus: backendItem.availabilityStatus ?? 'AVAILABLE',
        warningMessage: backendItem.warningMessage
      } as BackendCartItem;
    });

    this.emitState();
  }

  private emitState(): void {
    this.cartItemsSubject.next([...this.cartItems]);
    this.cartTotalSubject.next(this.backendSubtotal);
    this.cartCountSubject.next(this.getCartCount());
    this.canCheckoutSubject.next(this.backendCanCheckout);
    this.warningMessageSubject.next(this.backendWarningMessage);
  }

  private isLoggedIn(): boolean {
    const token = localStorage.getItem('token');
    return !!token && token !== 'null' && token !== 'undefined';
  }
}