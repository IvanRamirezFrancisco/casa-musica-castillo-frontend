import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { WishlistService } from '../../services/wishlist.service';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { WishlistItem } from '../../models/wishlist.model';

type SortOption = 'date' | 'price_asc' | 'price_desc' | 'name';

@Component({
  selector: 'app-wishlist',
  standalone: true,
  imports: [CommonModule, RouterModule, CurrencyPipe, DatePipe],
  templateUrl: './wishlist.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./wishlist.component.css']
})
export class WishlistComponent implements OnInit, OnDestroy {

  items: WishlistItem[] = [];
  loading = true;
  error: string | null = null;

  // Estado de acciones individuales
  movingToCart   = new Set<number>();  // wishlistIds en proceso
  removingItem   = new Set<number>();
  successMessage: string | null = null;
  errorMessage:   string | null = null;

  // Ordenación
  sortBy: SortOption = 'date';
  sortOptions: { value: SortOption; label: string }[] = [
    { value: 'date',       label: 'Más recientes' },
    { value: 'price_asc',  label: 'Precio: menor a mayor' },
    { value: 'price_desc', label: 'Precio: mayor a menor' },
    { value: 'name',       label: 'Nombre A → Z' }
  ];

  private subs = new Subscription();

  constructor(
    private wishlistService: WishlistService,
    private cartService:     CartService,
    private authService:     AuthService,
    private router:          Router
  ) {}

  ngOnInit(): void {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/wishlist' } });
      return;
    }

    this.subs.add(
      this.wishlistService.wishlistItems$.subscribe(items => {
        this.items   = this.applySorting(items);
        this.loading = false;
      })
    );

    // Forzar carga desde el backend
    this.wishlistService.getWishlist().subscribe({
      error: () => {
        this.error   = 'No se pudo cargar tu lista de deseos.';
        this.loading = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  get sortedItems(): WishlistItem[] {
    return this.applySorting(this.items);
  }

  get inStockCount(): number {
    return this.items.filter(i => i.inStock).length;
  }

  get priceDropCount(): number {
    return this.items.filter(i => i.priceDropped).length;
  }

  get totalValue(): number {
    return this.items.reduce((acc, i) => acc + i.currentPrice, 0);
  }

  private applySorting(items: WishlistItem[]): WishlistItem[] {
    const list = [...items];
    switch (this.sortBy) {
      case 'price_asc':  return list.sort((a, b) => a.currentPrice - b.currentPrice);
      case 'price_desc': return list.sort((a, b) => b.currentPrice - a.currentPrice);
      case 'name':       return list.sort((a, b) => a.productName.localeCompare(b.productName));
      default:           return list.sort((a, b) =>
        new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
      );
    }
  }

  // ── Acciones ──────────────────────────────────────────────────────────────

  onSortChange(value: string): void {
    this.sortBy = value as SortOption;
  }

  /** Quitar un item de la wishlist */
  removeItem(item: WishlistItem): void {
    if (this.removingItem.has(item.wishlistId)) return;
    this.removingItem.add(item.wishlistId);

    this.wishlistService.removeByWishlistId(item.wishlistId, item.productId).subscribe({
      next: () => {
        this.removingItem.delete(item.wishlistId);
        this.showSuccess('Producto eliminado de tus favoritos');
      },
      error: (err) => {
        this.removingItem.delete(item.wishlistId);
        this.showError('No se pudo eliminar el producto. Intenta de nuevo.');
        console.error(err);
      }
    });
  }

  /** Mover un item al carrito usando sp_move_wishlist_to_cart */
  moveToCart(item: WishlistItem): void {
    if (!item.inStock || this.movingToCart.has(item.wishlistId)) return;
    this.movingToCart.add(item.wishlistId);

    this.wishlistService.moveToCart(item.wishlistId, item.productId).subscribe({
      next: () => {
        this.movingToCart.delete(item.wishlistId);
        this.showSuccess(`"${item.productName}" agregado al carrito`);
      },
      error: (err) => {
        this.movingToCart.delete(item.wishlistId);
        this.showError('No se pudo agregar al carrito. Intenta de nuevo.');
        console.error(err);
      }
    });
  }

  /** Mover todos los items en stock al carrito */
  moveAllToCart(): void {
    this.wishlistService.moveAllToCart().subscribe({
      next: (res: any) => {
        this.showSuccess(`${res.movedItems ?? 0} productos movidos al carrito`);
      },
      error: () => this.showError('Error al mover productos al carrito')
    });
  }

  /** Navegar al detalle de un producto */
  goToProduct(item: WishlistItem): void {
    this.router.navigate(['/producto', item.productId]);
  }

  isMovingToCart(wishlistId: number): boolean {
    return this.movingToCart.has(wishlistId);
  }

  isRemoving(wishlistId: number): boolean {
    return this.removingItem.has(wishlistId);
  }

  getImageUrl(item: WishlistItem): string {
    return item.productImage || '/https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_400/v1782840424/Dise%C3%B1o_sin_t%C3%ADtulo_4_xruh6t.png';
  }

  onImageError(event: any): void {
    event.target.src = '/https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_400/v1782840424/Dise%C3%B1o_sin_t%C3%ADtulo_4_xruh6t.png';
  }

  getPriorityLabel(priority: number): string {
    return { 1: 'Baja', 2: 'Media', 3: 'Alta' }[priority] ?? 'Media';
  }

  getPriorityClass(priority: number): string {
    return { 1: 'low', 2: 'medium', 3: 'high' }[priority] ?? 'medium';
  }

  // ── Mensajes ──────────────────────────────────────────────────────────────

  private showSuccess(msg: string): void {
    this.successMessage = msg;
    this.errorMessage   = null;
    setTimeout(() => { this.successMessage = null; }, 3500);
  }

  private showError(msg: string): void {
    this.errorMessage   = msg;
    this.successMessage = null;
    setTimeout(() => { this.errorMessage = null; }, 4000);
  }
}
