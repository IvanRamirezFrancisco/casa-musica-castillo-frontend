import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Product } from '../../models/product.model';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { WishlistService } from '../../services/wishlist.service';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './product-card.component.html',
  styleUrls: ['./product-card.component.css']
})
export class ProductCardComponent implements OnInit, OnDestroy {

  @Input() product!: Product;
  @Input() showStockQuantity = false;
  @Output() productClick    = new EventEmitter<Product>();
  @Output() quickViewClick  = new EventEmitter<Product>();
  @Output() favoriteToggle  = new EventEmitter<{ product: Product; isFavorite: boolean }>();

  isInCart      = false;
  cartQuantity  = 0;
  addingToCart  = false;

  // ── Wishlist state ─────────────────────────────────────────────────────────
  isFavorite      = false;
  togglingFav     = false;  // previene doble click
  showFavAlert    = false;  // alerta "inicia sesión"
  private favSub?: Subscription;
  private cartSub?: Subscription;

  constructor(
    private cartService:     CartService,
    private authService:     AuthService,
    private wishlistService: WishlistService,
    private router:          Router
  ) {}

  ngOnInit(): void {
    this.updateCartStatus();

    // Suscribirse al estado de la wishlist (reactivo desde el BehaviorSubject)
    this.favSub = this.wishlistService.isInWishlist$(this.product.id)
      .subscribe(inWishlist => {
        this.isFavorite = inWishlist;
      });

    // Suscribirse a cambios en el carrito
    this.cartSub = this.cartService.cartItems$.subscribe(() => {
      this.updateCartStatus();
    });
  }

  ngOnDestroy(): void {
    this.favSub?.unsubscribe();
    this.cartSub?.unsubscribe();
  }

  // ── Ver producto ───────────────────────────────────────────────────────────

  viewProduct(): void {
    this.productClick.emit(this.product);
  }

  quickView(event: Event): void {
    event.stopPropagation();
    this.quickViewClick.emit(this.product);
  }

  // ── Toggle favorito ────────────────────────────────────────────────────────

  toggleFavorite(event: Event): void {
    event.stopPropagation();

    // Verificar autenticación
    if (!this.authService.isAuthenticated()) {
      this.showLoginAlert();
      return;
    }

    if (this.togglingFav) return;
    this.togglingFav = true;

    this.wishlistService.toggle(this.product.id).subscribe({
      next: (inWishlist) => {
        this.favoriteToggle.emit({ product: this.product, isFavorite: inWishlist });
        this.togglingFav = false;
      },
      error: (err) => {
        console.error('[ProductCard] Error en toggle wishlist:', err);
        this.togglingFav = false;
      }
    });
  }

  /** Muestra alerta amigable y redirige al login */
  private showLoginAlert(): void {
    this.showFavAlert = true;
    setTimeout(() => {
      this.showFavAlert = false;
      this.router.navigate(['/login'], {
        queryParams: { returnUrl: this.router.url }
      });
    }, 2000);
  }

  // ── Carrito ────────────────────────────────────────────────────────────────

  toggleCart(): void {
    if (this.addingToCart || !this.product.inStock) return;

    this.authService.isLoggedIn$.subscribe(isLoggedIn => {
      if (!isLoggedIn) {
        this.router.navigate(['/login'], {
          queryParams: { returnUrl: this.router.url }
        });
        return;
      }

      this.addingToCart = true;

      setTimeout(() => {
        if (this.isInCart) {
          this.cartService.removeFromCart(this.product.id);
        } else {
          this.cartService.addToCart(this.product, 1);
        }
        this.addingToCart = false;
      }, 300);
    }).unsubscribe();
  }

  increaseQuantity(): void {
    if (this.cartQuantity < this.product.stockQuantity) {
      this.cartService.updateQuantity(this.product.id, this.cartQuantity + 1);
    }
  }

  decreaseQuantity(): void {
    if (this.cartQuantity > 1) {
      this.cartService.updateQuantity(this.product.id, this.cartQuantity - 1);
    }
  }

  // ── Helpers de vista ───────────────────────────────────────────────────────

  getStars(): boolean[] {
    const stars: boolean[] = [];
    const fullStars = Math.floor(this.product.rating);
    const hasHalfStar = this.product.rating % 1 !== 0;

    for (let i = 0; i < fullStars; i++) stars.push(true);
    if (hasHalfStar && stars.length < 5) stars.push(true);
    while (stars.length < 5) stars.push(false);

    return stars;
  }

  getStockText(): string {
    if (!this.product.inStock) return 'Agotado';
    if (this.product.stockQuantity <= 5) return 'Pocas unidades';
    return 'En stock';
  }

  getBtnText(): string {
    if (this.addingToCart) return 'Agregando...';
    if (!this.product.inStock) return 'Agotado';
    return this.isInCart ? 'En carrito' : 'Agregar al carrito';
  }

  onImageError(event: any): void {
    event.target.src = '/https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_400/v1782840424/Dise%C3%B1o_sin_t%C3%ADtulo_4_xruh6t.png';
  }

  private updateCartStatus(): void {
    this.isInCart     = this.cartService.isInCart(this.product.id);
    this.cartQuantity = this.cartService.getProductQuantityInCart(this.product.id);
  }
}