import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';

import { CartService } from '../../services/cart.service';
import { Subscription } from 'rxjs';

interface ToastNotification {
  id: string;
  productName: string;
  productImage: string;
  show: boolean;
}

@Component({
  selector: 'app-cart-toast',
  standalone: true,
  imports: [],
  template: `
    <div class="toast-container">
      @for (toast of toasts; track toast) {
        <div
          class="toast-notification"
          [class.show]="toast.show">
          <div class="toast-content">
            <img [src]="toast.productImage" [alt]="toast.productName" class="toast-image" />
            <div class="toast-text">
              <span class="material-symbols-outlined toast-icon">check_circle</span>
              <div>
                <p class="toast-title">¡Agregado al carrito!</p>
                <p class="toast-product">{{ toast.productName }}</p>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .toast-container {
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .toast-notification {
      background: linear-gradient(135deg, #4caf50, #45a049);
      color: white;
      padding: 1rem 1.2rem;
      border-radius: 12px;
      box-shadow: 0 8px 25px rgba(76, 175, 80, 0.4);
      min-width: 320px;
      opacity: 0;
      transform: translateX(400px);
      transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    }

    .toast-notification.show {
      opacity: 1;
      transform: translateX(0);
    }

    .toast-content {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .toast-image {
      width: 50px;
      height: 50px;
      object-fit: contain;
      background: white;
      border-radius: 8px;
      padding: 5px;
    }

    .toast-text {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex: 1;
    }

    .toast-icon {
      font-size: 1.5rem;
      color: white;
    }

    .toast-title {
      font-weight: 700;
      font-size: 0.95rem;
      margin: 0;
      margin-bottom: 0.2rem;
    }

    .toast-product {
      font-size: 0.85rem;
      margin: 0;
      opacity: 0.95;
      font-weight: 500;
    }

    @media (max-width: 768px) {
      .toast-container {
        right: 10px;
        left: 10px;
        top: 70px;
      }

      .toast-notification {
        min-width: auto;
      }
    }
  `]
})
export class CartToastComponent implements OnInit, OnDestroy {
  toasts: ToastNotification[] = [];
  private subscription: Subscription = new Subscription();

  constructor(private cartService: CartService) {}

  ngOnInit(): void {
    this.subscription.add(
      this.cartService.addToCartAnimation$.subscribe(animation => {
        this.showToast(animation.productName, animation.productImage);
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  private showToast(productName: string, productImage: string): void {
    const id = `toast-${Date.now()}`;
    const toast: ToastNotification = {
      id,
      productName,
      productImage,
      show: false
    };

    this.toasts.push(toast);

    // Mostrar toast con delay para trigger de animación
    setTimeout(() => {
      const index = this.toasts.findIndex(t => t.id === id);
      if (index > -1) {
        this.toasts[index].show = true;
      }
    }, 50);

    // Ocultar y remover después de 3 segundos
    setTimeout(() => {
      const index = this.toasts.findIndex(t => t.id === id);
      if (index > -1) {
        this.toasts[index].show = false;
        
        // Remover del array después de la animación de salida
        setTimeout(() => {
          this.toasts = this.toasts.filter(t => t.id !== id);
        }, 400);
      }
    }, 3000);
  }
}
