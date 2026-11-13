import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import { CartService, BackendCartItem } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

// FASE 1.2 - Carrito UX - 2026-05-15

/** Estados del ciclo de vida de la vista del carrito. */
type CartViewState = 'loading' | 'loaded-with-items' | 'loaded-empty' | 'error';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ transform: 'translateY(-20px)', opacity: 0 }),
        animate('300ms ease-out', style({ transform: 'translateY(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ transform: 'translateY(-20px)', opacity: 0 }))
      ])
    ])
  ]
})
export class CartComponent implements OnInit, OnDestroy {

  cartItems: BackendCartItem[] = [];
  cartSubtotal  = 0;
  cartTaxes     = 0;
  cartShipping  = 0;
  cartTotal     = 0;
  unavailableItemsTotal = 0;
  appliedCoupon: string | null = null;
  
  canCheckout = true;
  cartWarningMessage: string | null = null;

  readonly freeShippingThreshold = 1000;

  /** Estado actual de la vista del carrito. */
  viewState: CartViewState = 'loading';

  /** Mensaje de error legible para el usuario. */
  errorMessage = '';

  showClearConfirm = false;
  showCouponInput  = false;
  couponCode       = '';

  /** IDs de items que están siendo actualizados en este momento. */
  updatingItemIds = new Set<number>();

  private subscriptions: Subscription[] = [];

  constructor(
    private cartService: CartService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.checkAuthentication();
    this.subscribeToCartItems();
    this.loadCartFromBackend();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // ── Setup ────────────────────────────────────────────────────────────────

  private checkAuthentication(): void {
    const authSub = this.authService.isLoggedIn$.subscribe(isLoggedIn => {
      if (!isLoggedIn) {
        this.router.navigate(['/login'], {
          queryParams: { returnUrl: '/carrito' }
        });
      }
    });
    this.subscriptions.push(authSub);
  }

  private subscribeToCartItems(): void {
    // Escucha cambios reactivos del servicio (actualizaciones de cantidad, cupones, etc.)
    const cartSub = this.cartService.cartItems$.subscribe(items => {
      this.cartItems = items as BackendCartItem[];
      this.appliedCoupon = this.cartService.getAppliedCouponCode();
      this.updateTotals();
      // Solo actualizar el viewState si ya pasamos por la carga inicial
      if (this.viewState !== 'loading') {
        this.viewState = this.cartItems.length > 0 ? 'loaded-with-items' : 'loaded-empty';
      }
    });
    
    const checkoutSub = this.cartService.canCheckout$.subscribe(val => this.canCheckout = val);
    const warningSub = this.cartService.warningMessage$.subscribe(val => this.cartWarningMessage = val);
    
    this.subscriptions.push(cartSub, checkoutSub, warningSub);
  }

  /**
   * FASE 1.2: Carga real desde el backend al inicializar la vista.
   * Se ejecuta en ngOnInit y en cada F5 (el servicio es stateless entre navegaciones).
   * En caso de 401, el interceptor redirige a /login automáticamente.
   */
  private loadCartFromBackend(): void {
    this.viewState = 'loading';

    this.cartService.loadCart().subscribe({
      next: () => {
        // cartItems$ ya fue actualizado por applyCartResponse dentro de loadCart()
        this.viewState = this.cartItems.length > 0 ? 'loaded-with-items' : 'loaded-empty';
      },
      error: err => {
        const status = err?.status;

        if (status === 401) {
          // El interceptor ya maneja la redirección; no hacemos nada aquí
          this.viewState = 'error';
          this.errorMessage = 'Tu sesión expiró. Redirigiendo al inicio de sesión...';
        } else if (status >= 500 || status === 0) {
          this.viewState = 'error';
          this.errorMessage = 'No se pudo conectar con el servidor. Intenta más tarde.';
        } else {
          this.viewState = 'error';
          this.errorMessage = 'Ocurrió un error al cargar tu carrito.';
        }
      }
    });
  }

  /** Reintenta la carga si hubo error. */
  retryLoad(): void {
    this.loadCartFromBackend();
  }

  private updateTotals(): void {
    this.cartSubtotal = this.cartService.getSubtotal();
    this.cartTaxes    = this.cartService.getTaxes();
    this.cartShipping = this.cartService.getShipping();
    this.cartTotal    = this.cartService.getFinalTotal();
    this.unavailableItemsTotal = this.cartService.getUnavailableItemsTotal();
  }

  // ── Helpers de vista ─────────────────────────────────────────────────────

  get isLoading(): boolean { return this.viewState === 'loading'; }
  get hasItems():  boolean { return this.viewState === 'loaded-with-items'; }
  get isEmpty():   boolean { return this.viewState === 'loaded-empty'; }
  get hasError():  boolean { return this.viewState === 'error'; }

  /** Expone el descuento actual para el template. */
  get currentDiscount(): number { return this.cartService.getDiscount(); }

  getTotalItems(): number {
    return this.cartService.getCartCount();
  }

  getItemTotal(item: BackendCartItem): number {
    return item.backendUnitPrice * item.quantity;
  }

  /** true si el item con ese itemId está siendo procesado ahora. */
  isItemUpdating(itemId: number): boolean {
    return this.updatingItemIds.has(itemId);
  }

  // ── Helpers de Disponibilidad (FASE 3) ──────────────────────────────────
  
  isItemAvailable(item: BackendCartItem): boolean {
    return item.available !== false && item.availabilityStatus === 'AVAILABLE';
  }

  getAvailabilityLabel(item: BackendCartItem): string {
    if (this.isItemAvailable(item)) return '';
    if (item.availabilityStatus === 'OUT_OF_STOCK') return 'Agotado';
    return 'No disponible';
  }

  getAvailabilityMessage(item: BackendCartItem): string {
    return item.warningMessage || 'Este producto ya no está disponible para su compra.';
  }

  canUpdateQuantity(item: BackendCartItem): boolean {
    return this.isItemAvailable(item);
  }

  // ── Control de cantidad ──────────────────────────────────────────────────

  /**
   * FASE 1.2: Incrementa la cantidad usando directamente el backendItemId.
   * No depende de backendItemId buscado por productId — es directo.
   */
  increaseQuantity(item: BackendCartItem): void {
    if (!this.canUpdateQuantity(item)) return;
    if (this.isItemUpdating(item.backendItemId)) return;
    if (item.quantity >= (item.availableStock || item.product.stockQuantity || 99)) return;

    this.setItemUpdating(item.backendItemId, true);

    this.cartService.updateItemById(item.backendItemId, item.quantity + 1).subscribe({
      next:  () => this.setItemUpdating(item.backendItemId, false),
      error: err => {
        this.setItemUpdating(item.backendItemId, false);
        this.showItemError('No se pudo aumentar la cantidad', err);
      }
    });
  }

  /**
   * FASE 1.2: Decrementa la cantidad. No baja de 1.
   */
  decreaseQuantity(item: BackendCartItem): void {
    if (!this.canUpdateQuantity(item)) return;
    if (this.isItemUpdating(item.backendItemId)) return;
    if (item.quantity <= 1) return;

    this.setItemUpdating(item.backendItemId, true);

    this.cartService.updateItemById(item.backendItemId, item.quantity - 1).subscribe({
      next:  () => this.setItemUpdating(item.backendItemId, false),
      error: err => {
        this.setItemUpdating(item.backendItemId, false);
        this.showItemError('No se pudo disminuir la cantidad', err);
      }
    });
  }

  /** Actualiza cantidad desde el valor del span (si se usa input). Nunca < 1. */
  updateQuantityDirect(item: BackendCartItem, rawValue: string): void {
    if (!this.canUpdateQuantity(item)) return;
    const newQty = parseInt(rawValue, 10);
    if (isNaN(newQty) || newQty < 1) return;
    if (newQty > (item.availableStock || item.product.stockQuantity || 99)) return;
    if (newQty === item.quantity) return;

    this.setItemUpdating(item.backendItemId, true);

    this.cartService.updateItemById(item.backendItemId, newQty).subscribe({
      next:  () => this.setItemUpdating(item.backendItemId, false),
      error: err => {
        this.setItemUpdating(item.backendItemId, false);
        this.showItemError('No se pudo actualizar la cantidad', err);
      }
    });
  }

  // ── Acciones del carrito ─────────────────────────────────────────────────

  removeItem(item: BackendCartItem): void {
    if (this.isItemUpdating(item.backendItemId)) return;

    this.setItemUpdating(item.backendItemId, true);

    this.cartService.removeItemById(item.backendItemId).subscribe({
      next:  () => this.setItemUpdating(item.backendItemId, false),
      error: err => {
        this.setItemUpdating(item.backendItemId, false);
        this.showItemError('No se pudo eliminar el producto', err);
      }
    });
  }

  moveToWishlist(item: BackendCartItem): void {
    if (this.isItemUpdating(item.backendItemId)) return;

    this.setItemUpdating(item.backendItemId, true);

    this.cartService.moveItemToWishlist(item.backendItemId).subscribe({
      next: () => {
        this.setItemUpdating(item.backendItemId, false);
        Swal.fire({
          icon: 'success',
          title: 'Movido a Lista de Deseos',
          text: `Se movió "${item.product.name}" a tu lista de deseos.`,
          timer: 2000,
          showConfirmButton: false
        });
      },
      error: err => {
        this.setItemUpdating(item.backendItemId, false);
        this.showItemError('No se pudo mover a lista de deseos', err);
      }
    });
  }

  clearCart(): void {
    this.showClearConfirm = true;
  }

  confirmClearCart(): void {
    this.cartService.clearCart();
    this.showClearConfirm = false;
  }

  // ── Cupón ────────────────────────────────────────────────────────────────

  toggleCoupon(): void {
    this.showCouponInput = !this.showCouponInput;
    if (!this.showCouponInput) { this.couponCode = ''; }
  }

  applyCoupon(): void {
    const code = this.couponCode.trim();
    if (!code) {
      Swal.fire({ icon: 'warning', title: 'Código vacío', text: 'Ingresa un código de cupón.', confirmButtonColor: '#722f37' });
      return;
    }

    this.cartService.applyCoupon(code).subscribe({
      next: () => {
        this.couponCode = '';
        this.showCouponInput = false;
        const applied = this.cartService.getAppliedCouponCode();
        if (applied) {
          Swal.fire({
            icon: 'success', title: '¡Cupón aplicado!',
            text: `Descuento del cupón "${applied}" aplicado.`,
            timer: 2500, showConfirmButton: false
          });
        }
      },
      error: () => {
        Swal.fire({ icon: 'error', title: 'Cupón inválido', text: 'El código no es válido o ha expirado.', confirmButtonColor: '#722f37' });
      }
    });
  }

  removeCoupon(): void {
    this.cartService.removeCoupon();
    this.appliedCoupon = null;
  }

  // ── Checkout ─────────────────────────────────────────────────────────────

  /**
   * TODO Fase 2: conectar con el módulo real de checkout.
   */
  proceedToCheckout(): void {
    if (this.cartItems.length === 0 || !this.canCheckout) return;
    this.router.navigate(['/checkout']);
  }

  // ── Utilidades de vista ──────────────────────────────────────────────────

  getSelectedOptionsArray(options: { [key: string]: string } | undefined): { key: string; value: string }[] {
    if (!options) return [];
    return Object.entries(options).map(([key, value]) => ({ key, value }));
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = '/https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_400/v1782840424/Dise%C3%B1o_sin_t%C3%ADtulo_4_xruh6t.png';
  }

  trackByItemId(index: number, item: BackendCartItem): number {
    return item.backendItemId;
  }

  // ── Internos ─────────────────────────────────────────────────────────────

  private setItemUpdating(itemId: number, updating: boolean): void {
    if (updating) {
      this.updatingItemIds.add(itemId);
    } else {
      this.updatingItemIds.delete(itemId);
    }
  }

  private showItemError(title: string, err: unknown): void {
    const status = (err as any)?.status;
    let text = 'Intenta de nuevo.';
    if (status === 400 || status === 409) {
      text = (err as any)?.error?.message || 'El producto está agotado o inactivo.';
      // Refrescar carrito para obtener el estado real
      this.loadCartFromBackend();
    }
    if (status >= 500)  text = 'Error del servidor. Intenta más tarde.';

    Swal.fire({ icon: 'error', title, text, confirmButtonColor: '#722f37' });
  }
}