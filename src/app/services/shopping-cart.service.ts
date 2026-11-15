import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, tap, map } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ShoppingCartDTO,
  AddToCartRequest,
  UpdateCartItemRequest,
  ApplyCouponRequest,
  TransferCartRequest,
  CartValidationResponse,
  ApiResponse
} from '../models/cart.model';

// FASE 1 - Carrito - 2026-05-15
// Este servicio ha sido reemplazado por CartService (cart.service.ts).
// Se mantiene temporalmente para evitar romper imports legacy.

/**
 * @deprecated Use CartService from cart.service.ts.
 *
 * Este servicio no está conectado a ningún componente activo de usuario.
 * Contiene métodos que apuntan a endpoints no existentes en el backend:
 *   - getCartById()  → GET  /api/cart/{cartId}       ❌
 *   - getAbandonedCarts() → GET /api/cart/abandoned   ❌
 *   - checkout()     → POST /api/cart/{cartId}/checkout ❌
 *
 * La migración de admin-abandoned-carts a un endpoint real queda pendiente.
 * TODO Fase futura: implementar endpoint backend GET /api/admin/carts/abandoned.
 */
@Injectable({
  providedIn: 'root'
})
export class ShoppingCartService {
  private readonly API_URL = `${environment.apiUrl}/cart`;
  
  // Subject para compartir el estado del carrito entre componentes
  private cartSubject = new BehaviorSubject<ShoppingCartDTO | null>(null);
  public cart$ = this.cartSubject.asObservable();
  
  private cartCountSubject = new BehaviorSubject<number>(0);
  public cartCount$ = this.cartCountSubject.asObservable();

  constructor(private http: HttpClient) {
    // Cargar el carrito al inicializar el servicio
    this.loadCart();
  }

  /**
   * Obtener o crear el carrito del usuario actual
   * GET /api/cart
   */
  getCart(): Observable<ShoppingCartDTO> {
    return this.http.get<ShoppingCartDTO>(this.API_URL).pipe(
      tap(cart => {
        this.cartSubject.next(cart);
        this.cartCountSubject.next(cart.itemCount);
      })
    );
  }

  /**
   * Obtener carrito por ID específico
   * GET /api/cart/{cartId}
   */
  getCartById(cartId: number): Observable<ShoppingCartDTO> {
    return this.http.get<ShoppingCartDTO>(`${this.API_URL}/${cartId}`).pipe(
      tap(cart => {
        this.cartSubject.next(cart);
        this.cartCountSubject.next(cart.itemCount);
      })
    );
  }

  /**
   * Agregar producto al carrito del usuario autenticado
   * POST /api/cart/items
   * SEGURIDAD: El backend deriva el carrito del JWT, no se envía cartId
   */
  addToCart(request: AddToCartRequest): Observable<ShoppingCartDTO> {
    return this.http.post<ShoppingCartDTO>(`${this.API_URL}/items`, request).pipe(
      tap(cart => {
        this.cartSubject.next(cart);
        this.cartCountSubject.next(cart.itemCount);
      })
    );
  }

  /**
   * Actualizar cantidad de un item del carrito
   * PUT /api/cart/items/{itemId}
   */
  updateCartItem(itemId: number, request: UpdateCartItemRequest): Observable<ShoppingCartDTO> {
    return this.http.put<ShoppingCartDTO>(`${this.API_URL}/items/${itemId}`, request).pipe(
      tap(cart => {
        this.cartSubject.next(cart);
        this.cartCountSubject.next(cart.itemCount);
      })
    );
  }

  /**
   * Eliminar item del carrito
   * DELETE /api/cart/items/{itemId}
   */
  removeCartItem(itemId: number): Observable<ShoppingCartDTO> {
    return this.http.delete<ShoppingCartDTO>(`${this.API_URL}/items/${itemId}`).pipe(
      tap(cart => {
        this.cartSubject.next(cart);
        this.cartCountSubject.next(cart.itemCount);
      })
    );
  }

  /**
   * Vaciar el carrito del usuario autenticado
   * DELETE /api/cart
   * SEGURIDAD: El backend deriva el carrito del JWT
   */
  clearCart(): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}`).pipe(
      tap(() => {
        this.cartSubject.next(null);
        this.cartCountSubject.next(0);
      })
    );
  }

  /**
   * Aplicar cupón de descuento al carrito del usuario autenticado
   * POST /api/cart/coupon
   * SEGURIDAD: El backend deriva el carrito del JWT
   */
  applyCoupon(request: ApplyCouponRequest): Observable<ShoppingCartDTO> {
    return this.http.post<ShoppingCartDTO>(`${this.API_URL}/coupon`, request).pipe(
      tap(cart => {
        this.cartSubject.next(cart);
      })
    );
  }

  /**
   * Remover cupón aplicado del carrito del usuario autenticado
   * DELETE /api/cart/coupon
   * SEGURIDAD: El backend deriva el carrito del JWT
   */
  removeCoupon(): Observable<ShoppingCartDTO> {
    return this.http.delete<ShoppingCartDTO>(`${this.API_URL}/coupon`).pipe(
      tap(cart => {
        this.cartSubject.next(cart);
      })
    );
  }

  /**
   * Validar carrito antes del checkout
   * GET /api/cart/validate
   * SEGURIDAD: El backend deriva el carrito del JWT
   */
  validateCart(): Observable<CartValidationResponse> {
    return this.http.get<CartValidationResponse>(`${this.API_URL}/validate`);
  }

  /**
   * Transferir carrito de sesión anónima a usuario logueado
   * POST /api/cart/transfer
   */
  transferCart(request: TransferCartRequest): Observable<ShoppingCartDTO> {
    return this.http.post<ShoppingCartDTO>(`${this.API_URL}/transfer`, request).pipe(
      tap(cart => {
        this.cartSubject.next(cart);
        this.cartCountSubject.next(cart.itemCount);
      })
    );
  }

  /**
   * Obtener carritos abandonados (ADMIN)
   * GET /api/cart/abandoned
   */
  getAbandonedCarts(hours: number = 24): Observable<ShoppingCartDTO[]> {
    const params = new HttpParams().set('hours', hours.toString());
    return this.http.get<ShoppingCartDTO[]>(`${this.API_URL}/abandoned`, { params });
  }

  /**
   * Convertir carrito a orden (checkout)
   * POST /api/cart/{cartId}/checkout
   */
  checkout(cartId: number): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.API_URL}/${cartId}/checkout`, {}).pipe(
      tap(() => {
        // Limpiar el carrito después del checkout exitoso
        this.cartSubject.next(null);
        this.cartCountSubject.next(0);
      })
    );
  }

  /**
   * Calcular totales del carrito (método helper)
   */
  calculateTotals(cart: ShoppingCartDTO): {
    subtotal: number;
    discount: number;
    tax: number;
    shipping: number;
    total: number;
  } {
    return {
      subtotal: cart.subtotal,
      discount: cart.discount,
      tax: cart.tax,
      shipping: cart.shippingCost,
      total: cart.total
    };
  }

  /**
   * Cargar el carrito actual al inicializar
   */
  private loadCart(): void {
    const token = localStorage.getItem('token');
    if (token) {
      this.getCart().subscribe({
        error: (err) => {
          console.warn('No se pudo cargar el carrito:', err);
        }
      });
    }
  }

  /**
   * Obtener el carrito actual del BehaviorSubject
   */
  getCurrentCart(): ShoppingCartDTO | null {
    return this.cartSubject.value;
  }

  /**
   * Obtener el contador actual de items
   */
  getCurrentCount(): number {
    return this.cartCountSubject.value;
  }
}
