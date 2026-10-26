import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ShoppingCartService } from '../../../services/shopping-cart.service';
import { ShoppingCartDTO, CartItemDTO } from '../../../models/cart.model';

interface AbandonedCart {
  cart: ShoppingCartDTO;
  daysSinceLastUpdate: number;
  totalValue: number;
  itemCount: number;
}

interface CartFilters {
  minValue?: number;
  minDays?: number;
  sortBy?: 'date' | 'value' | 'items';
}

@Component({
  selector: 'app-admin-abandoned-carts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-abandoned-carts.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./admin-abandoned-carts.component.css']
})
export class AdminAbandonedCartsComponent implements OnInit {
  abandonedCarts: AbandonedCart[] = [];
  currentPage: number = 0;
  pageSize: number = 10;
  totalPages: number = 0;
  totalElements: number = 0;
  isLoading: boolean = false;
  error: string | null = null;

  // Modal states
  showDetailsModal: boolean = false;
  selectedCart: AbandonedCart | null = null;

  // Filters
  filters: CartFilters = {};
  minValueFilter: number | '' = '';
  minDaysFilter: number = 1;
  sortByFilter: 'date' | 'value' | 'items' = 'date';

  // Stats
  totalAbandonedValue: number = 0;
  averageCartValue: number = 0;

  constructor(private cartService: ShoppingCartService) {}

  ngOnInit(): void {
    // FASE 1 - Carrito - 2026-05-15
    // TODO Fase futura: implementar endpoint backend GET /api/admin/carts/abandoned o equivalente.
    // El endpoint GET /api/cart/abandoned NO existe en el backend actual.
    // La carga real está deshabilitada para evitar llamadas a un endpoint inexistente.
    // Cuando el backend implemente el endpoint, descomentar: this.loadAbandonedCarts();
    this.isLoading = false;
    this.error = 'PENDING_BACKEND';
  }

  loadAbandonedCarts(): void {
    // FASE 1 - Carrito - 2026-05-15
    // TODO Fase futura: habilitar esta llamada cuando exista el endpoint en el backend.
    // El endpoint GET /api/cart/abandoned actualmente no existe.
    // Se deja el método completo para una migración futura sencilla.
    this.isLoading = true;
    this.error = 'PENDING_BACKEND';
    this.isLoading = false;
  }

  transformToAbandonedCart(cart: ShoppingCartDTO): AbandonedCart {
    const lastUpdate = new Date(cart.updatedAt || cart.createdAt);
    const now = new Date();
    const daysSinceLastUpdate = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
    const totalValue = cart.total || 0;
    const itemCount = cart.items?.length || 0;

    return {
      cart,
      daysSinceLastUpdate,
      totalValue,
      itemCount
    };
  }

  applyClientFilters(carts: AbandonedCart[]): AbandonedCart[] {
    let filtered = [...carts];

    // Filter by minimum value
    if (this.minValueFilter !== '' && this.minValueFilter > 0) {
      filtered = filtered.filter(c => c.totalValue >= (this.minValueFilter as number));
    }

    // Sort
    switch (this.sortByFilter) {
      case 'date':
        filtered.sort((a, b) => b.daysSinceLastUpdate - a.daysSinceLastUpdate);
        break;
      case 'value':
        filtered.sort((a, b) => b.totalValue - a.totalValue);
        break;
      case 'items':
        filtered.sort((a, b) => b.itemCount - a.itemCount);
        break;
    }

    return filtered;
  }

  calculateStats(): void {
    if (this.abandonedCarts.length === 0) {
      this.totalAbandonedValue = 0;
      this.averageCartValue = 0;
      return;
    }

    this.totalAbandonedValue = this.abandonedCarts.reduce((sum, cart) => sum + cart.totalValue, 0);
    this.averageCartValue = this.totalAbandonedValue / this.abandonedCarts.length;
  }

  openDetailsModal(abandonedCart: AbandonedCart): void {
    this.selectedCart = abandonedCart;
    this.showDetailsModal = true;
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedCart = null;
  }

  sendReminderEmail(abandonedCart: AbandonedCart): void {
    // TODO: Implement email reminder functionality
    // This would require a backend endpoint to send emails
    alert(`Funcionalidad de envío de correo para el usuario ${abandonedCart.cart.userId} (pendiente de implementación en el backend)`);
  }

  deleteCart(cartId: number): void {
    if (!confirm('¿Estás seguro de que quieres eliminar este carrito? Esta acción no se puede deshacer.')) {
      return;
    }

    // Note: clearCart requires userId, but we can't clear other users' carts directly
    // This would require a backend admin endpoint
    alert('Esta funcionalidad requiere un endpoint de administración en el backend para eliminar carritos de otros usuarios.');
  }

  exportToCSV(): void {
    if (this.abandonedCarts.length === 0) {
      alert('No hay datos para exportar.');
      return;
    }

    const csvContent = this.generateCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `carritos_abandonados_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  generateCSV(): string {
    const headers = ['ID Carrito', 'ID Usuario', 'Items', 'Valor Total', 'Días Abandonado', 'Última Modificación'];
    const rows = this.abandonedCarts.map(ac => [
      ac.cart.id,
      ac.cart.userId || 'N/A',
      ac.itemCount,
      `$${ac.totalValue.toFixed(2)}`,
      ac.daysSinceLastUpdate,
      new Date(ac.cart.updatedAt || ac.cart.createdAt).toLocaleDateString('es-ES')
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
  }

  // Filter methods
  applyFilters(): void {
    this.currentPage = 0;
    this.loadAbandonedCarts();
  }

  resetFilters(): void {
    this.minValueFilter = '';
    this.minDaysFilter = 1;
    this.sortByFilter = 'date';
    this.currentPage = 0;
    this.loadAbandonedCarts();
  }

  // Pagination
  nextPage(): void {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
      this.loadAbandonedCarts();
    }
  }

  previousPage(): void {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.loadAbandonedCarts();
    }
  }

  // Helper methods
  formatCurrency(amount: number): string {
    return `$${amount.toFixed(2)}`;
  }

  formatDate(date: Date | string): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getDaysLabel(days: number): string {
    if (days === 1) return '1 día';
    if (days < 7) return `${days} días`;
    if (days < 30) return `${Math.floor(days / 7)} semanas`;
    return `${Math.floor(days / 30)} meses`;
  }

  getDaysClass(days: number): string {
    if (days < 3) return 'days-recent';
    if (days < 7) return 'days-medium';
    return 'days-old';
  }

  getValueClass(value: number): string {
    if (value < 50) return 'value-low';
    if (value < 200) return 'value-medium';
    return 'value-high';
  }

  getCartItemImage(item: CartItemDTO): string {
    return item.productImage || '/assets/images/placeholder-product.png';
  }

  truncateText(text: string, maxLength: number): string {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }
}
