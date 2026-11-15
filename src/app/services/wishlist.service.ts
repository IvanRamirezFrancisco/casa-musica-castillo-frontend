import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  Observable,
  BehaviorSubject,
  Subscription,
  of,
  EMPTY
} from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  WishlistItem,
  WishlistResponse,
  WishlistCheckResponse,
  WishlistSummary,
  AddToWishlistRequest,
  UpdateWishlistRequest,
  WishlistNotification
} from '../models/wishlist.model';
import { AuthService } from './auth.service';

/**
 * Servicio para gestionar la lista de deseos (Wishlist — Fase 2).
 *
 * Diseño de estado reactivo:
 * - `_productIds$` → BehaviorSubject<Set<number>> con los productId en wishlist.
 *   Permite la consulta `isInWishlist(id)` en O(1) desde cualquier componente.
 * - `wishlistItems$` → BehaviorSubject<WishlistItem[]> con la lista completa.
 * - `wishlistCount$` → BehaviorSubject<number> para el badge del header.
 *
 * El toggle actualiza optimistamente el estado local ANTES de la llamada HTTP,
 * dando feedback visual instantáneo, y revierte si el servidor falla.
 */
@Injectable({
  providedIn: 'root'
})
export class WishlistService implements OnDestroy {

  private readonly API_URL = `${environment.apiUrl}/wishlist`;

  // ── Estado reactivo ────────────────────────────────────────────────────────

  private _productIds$ = new BehaviorSubject<Set<number>>(new Set<number>());
  private _items$      = new BehaviorSubject<WishlistItem[]>([]);
  private _count$      = new BehaviorSubject<number>(0);

  /** Observable con los items completos de la wishlist */
  readonly wishlistItems$ = this._items$.asObservable();

  /** Observable con el conteo de items (para el badge del header) */
  readonly wishlistCount$ = this._count$.asObservable();

  private authSub?: Subscription;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    // Cuando el usuario inicia sesión, cargamos la wishlist automáticamente.
    // Cuando cierra sesión, limpiamos el estado local.
    this.authSub = this.authService.isLoggedIn$.subscribe(isLoggedIn => {
      if (isLoggedIn) {
        this.loadWishlistSilently();
      } else {
        this.clearLocalState();
      }
    });
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
  }

  // ── Consultas ──────────────────────────────────────────────────────────────

  /**
   * Devuelve un Observable<boolean> que emite true/false según si el producto
   * está en la wishlist del usuario. Ideal para el botón corazón.
   * Usa el Set interno — sin llamadas HTTP adicionales.
   */
  isInWishlist$(productId: number): Observable<boolean> {
    return this._productIds$.pipe(
      map(ids => ids.has(productId))
    );
  }

  /**
   * Verificación síncrona rápida (para lógica no reactiva).
   */
  isInWishlist(productId: number): boolean {
    return this._productIds$.value.has(productId);
  }

  /**
   * Carga la wishlist completa desde el backend.
   * GET /api/wishlist
   */
  getWishlist(): Observable<WishlistResponse> {
    return this.http.get<WishlistResponse>(this.API_URL).pipe(
      tap(response => this.updateLocalState(response.items)),
      catchError(err => {
        console.error('[WishlistService] Error cargando wishlist:', err);
        throw err;
      })
    );
  }

  /**
   * Obtiene el resumen estadístico.
   * GET /api/wishlist/summary
   */
  getSummary(): Observable<WishlistSummary> {
    return this.http.get<WishlistSummary>(`${this.API_URL}/summary`);
  }

  /**
   * Obtiene items con bajada de precio.
   * GET /api/wishlist/price-drops
   */
  getPriceDrops(): Observable<WishlistItem[]> {
    return this.http.get<WishlistItem[]>(`${this.API_URL}/price-drops`);
  }

  /**
   * Obtiene notificaciones de precio/stock.
   * GET /api/wishlist/notifications
   */
  getNotifications(): Observable<{ priceDrops: WishlistNotification[]; backInStock: WishlistNotification[]; total: number }> {
    return this.http.get<any>(`${this.API_URL}/notifications`);
  }

  // ── Toggle del botón corazón ────────────────────────────────────────────────

  /**
   * Añade o quita un producto de la wishlist.
   *
   * - Si el producto NO está en wishlist → POST /api/wishlist
   * - Si el producto SÍ está en wishlist → DELETE /api/wishlist/by-product/{productId}
   *
   * Actualiza optimistamente el estado local antes de la llamada HTTP.
   * Revierte si el servidor devuelve error.
   *
   * @returns Observable<boolean> — true si quedó en wishlist, false si fue removido.
   */
  toggle(productId: number): Observable<boolean> {
    const currentlyIn = this.isInWishlist(productId);

    if (currentlyIn) {
      // Actualización optimista: quitar del estado local
      this.removeFromLocalState(productId);

      return this.http
        .delete<any>(`${this.API_URL}/by-product/${productId}`)
        .pipe(
          map(() => false),
          catchError(err => {
            console.error('[WishlistService] Error eliminando de wishlist:', err);
            // Revertir — volver a agregar al estado local
            this.reloadWishlistSilently();
            throw err;
          })
        );
    } else {
      // Actualización optimista: agregar al estado local
      this.addToLocalState(productId);

      const request: AddToWishlistRequest = { productId, priority: 2 };
      return this.http
        .post<WishlistItem>(this.API_URL, request)
        .pipe(
          tap(item => {
            // Refrescar estado con el item real devuelto por el servidor
            const current = this._items$.value;
            const updated = [...current, item];
            this.updateLocalState(updated);
          }),
          map(() => true),
          catchError(err => {
            console.error('[WishlistService] Error agregando a wishlist:', err);
            // Revertir — quitar del estado local
            this.removeFromLocalState(productId);
            throw err;
          })
        );
    }
  }

  // ── Operaciones completas (para la página /wishlist) ───────────────────────

  /**
   * Elimina un item por su wishlistId (ID del registro).
   * DELETE /api/wishlist/{itemId}
   */
  removeByWishlistId(wishlistId: number, productId: number): Observable<void> {
    this.removeFromLocalState(productId);
    return this.http.delete<void>(`${this.API_URL}/${wishlistId}`).pipe(
      catchError(err => {
        this.reloadWishlistSilently();
        throw err;
      })
    );
  }

  /**
   * Mueve un item de la wishlist al carrito usando el SP sp_move_wishlist_to_cart.
   * POST /api/wishlist/{itemId}/move-to-cart
   */
  moveToCart(wishlistId: number, productId: number): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/${wishlistId}/move-to-cart`, {}).pipe(
      tap(() => {
        // El SP elimina el item de la wishlist, actualizamos estado local
        this.removeFromLocalState(productId);
      }),
      catchError(err => {
        console.error('[WishlistService] Error moviendo al carrito:', err);
        throw err;
      })
    );
  }

  /**
   * Mueve todos los items en stock al carrito.
   * POST /api/wishlist/move-all-to-cart
   */
  moveAllToCart(): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/move-all-to-cart`, {}).pipe(
      tap(() => this.reloadWishlistSilently())
    );
  }

  /**
   * Actualiza prioridad/notas de un item.
   * PUT /api/wishlist/{itemId}
   */
  updateItem(wishlistId: number, request: UpdateWishlistRequest): Observable<WishlistItem> {
    return this.http.put<WishlistItem>(`${this.API_URL}/${wishlistId}`, request).pipe(
      tap(() => this.reloadWishlistSilently())
    );
  }

  /**
   * Vacía la wishlist completa del usuario.
   * DELETE /api/wishlist
   */
  clearWishlist(): Observable<any> {
    return this.http.delete<any>(this.API_URL).pipe(
      tap(() => this.clearLocalState())
    );
  }

  // ── Estado local ───────────────────────────────────────────────────────────

  /** Devuelve los items actuales sin suscripción */
  getCurrentItems(): WishlistItem[] {
    return this._items$.value;
  }

  /** Devuelve el conteo actual */
  getCurrentCount(): number {
    return this._count$.value;
  }

  // ── Privados ───────────────────────────────────────────────────────────────

  /**
   * Carga la wishlist en silencio al iniciar sesión.
   * Los errores (ej. token expirado) se suprimen para no interrumpir la UX.
   */
  private loadWishlistSilently(): void {
    this.http.get<WishlistResponse>(this.API_URL).pipe(
      catchError(() => EMPTY)
    ).subscribe(response => {
      if (response) {
        this.updateLocalState(response.items);
      }
    });
  }

  private reloadWishlistSilently(): void {
    this.loadWishlistSilently();
  }

  /** Actualiza los tres BehaviorSubjects con la lista recibida del servidor */
  private updateLocalState(items: WishlistItem[]): void {
    const ids = new Set(items.map(i => i.productId));
    this._productIds$.next(ids);
    this._items$.next(items);
    this._count$.next(items.length);
  }

  /** Agrega un productId al Set local (actualización optimista) */
  private addToLocalState(productId: number): void {
    const current = new Set(this._productIds$.value);
    current.add(productId);
    this._productIds$.next(current);
    this._count$.next(current.size);
  }

  /** Quita un productId del Set local y del array de items (actualización optimista) */
  private removeFromLocalState(productId: number): void {
    const current = new Set(this._productIds$.value);
    current.delete(productId);
    this._productIds$.next(current);

    const updatedItems = this._items$.value.filter(i => i.productId !== productId);
    this._items$.next(updatedItems);
    this._count$.next(current.size);
  }

  /** Limpia todo el estado local (al cerrar sesión) */
  private clearLocalState(): void {
    this._productIds$.next(new Set());
    this._items$.next([]);
    this._count$.next(0);
  }
}
