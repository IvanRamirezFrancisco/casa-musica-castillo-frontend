import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ProductRecommendation } from '../../../models/product.model';

@Component({
  selector: 'app-product-recommendation-card',
  standalone: true,
  imports: [CommonModule, RouterModule, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="group relative flex flex-col h-full bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-amber-200 transition-all duration-250 overflow-hidden outline-none focus-within:ring-2 focus-within:ring-amber-400">

      <!-- Imagen -->
      <a [routerLink]="['/producto', recommendation.productId]" class="relative block aspect-[4/3] w-full overflow-hidden bg-gray-50 cursor-pointer outline-none">
        <img
          [src]="imageUrl"
          [alt]="recommendation.name"
          (error)="onImageError($event)"
          loading="lazy"
          class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          >
          <!-- Overlay discreto en hover -->
          <div class="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        </a>

        <!-- Contenido -->
        <div class="flex flex-col flex-grow p-4 md:p-5">

          <!-- Categoría -->
          @if (recommendation.categoryName) {
            <span class="text-xs font-medium text-amber-600 mb-1 tracking-wide uppercase">
              {{ recommendation.categoryName }}
            </span>
          }

          <!-- Título -->
          <a [routerLink]="['/producto', recommendation.productId]" class="text-sm md:text-base font-semibold text-gray-800 leading-tight mb-2 line-clamp-2 hover:text-amber-700 transition-colors outline-none">
            {{ recommendation.name }}
          </a>

          <!-- Descripción corta (opcional) -->
          @if (recommendation.description) {
            <p class="text-xs text-gray-500 line-clamp-2 mb-3">
              {{ recommendation.description }}
            </p>
          }

          <!-- Spacer para empujar footer -->
          <div class="flex-grow"></div>

          <!-- Razón de recomendación -->
          <div class="flex items-start gap-1.5 p-2 bg-amber-50/50 rounded-lg mb-3 border border-amber-100/50">
            <span class="material-symbols-outlined text-amber-500 text-[16px] shrink-0 mt-0.5">auto_awesome</span>
            <span class="text-[11px] font-medium text-amber-800/80 leading-snug">
              {{ recommendation.recommendationReason }}
            </span>
          </div>

          <!-- Footer: Precio y Acciones -->
          <div class="flex items-end justify-between mt-auto pt-2 border-t border-gray-50">

            <!-- Precios -->
            <div class="flex flex-col">
              @if (recommendation.hasDiscount) {
                <span class="text-xs text-gray-400 line-through decoration-gray-300">
                  {{ recommendation.regularPrice | currency:'MXN':'symbol':'1.2-2' }}
                </span>
              }
              <span class="text-lg font-bold text-gray-900" [class.text-red-700]="recommendation.hasDiscount">
                {{ recommendation.effectivePrice | currency:'MXN':'symbol':'1.2-2' }}
              </span>
              @if (recommendation.stock > 0) {
                <span class="text-[10px] text-emerald-600 font-medium uppercase tracking-wider mt-0.5">
                  Disponible
                </span>
              }
            </div>

            <!-- Botón de añadir (Solo ícono p/ espacio, o texto en móvil) -->
            @if (recommendation.stock > 0) {
              <button
                (click)="onAddClick($event)"
                [disabled]="addingToCart"
                class="flex items-center justify-center w-10 h-10 md:w-auto md:h-9 md:px-4 bg-gray-900 hover:bg-amber-600 text-white rounded-xl md:rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-500 group/btn"
                [title]="addingToCart ? 'Agregando...' : 'Agregar al carrito'"
                [attr.aria-label]="'Agregar ' + recommendation.name + ' al carrito'"
                >
                @if (!addingToCart) {
                  <span class="material-symbols-outlined text-[20px]">shopping_cart</span>
                }
                @if (addingToCart) {
                  <span class="material-symbols-outlined text-[20px] animate-spin">refresh</span>
                }
                @if (!addingToCart) {
                  <span class="hidden md:inline-block text-sm font-medium ml-1.5">Agregar</span>
                }
              </button>
            }
          </div>

        </div>
      </div>
    `
})
export class ProductRecommendationCardComponent {
  @Input() recommendation!: ProductRecommendation;
  @Input() addingToCart = false;
  @Output() addClick = new EventEmitter<ProductRecommendation>();

  constructor(private router: Router) {}

  get imageUrl(): string {
    return this.recommendation.imageUrl || '/https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_400/v1782840424/Dise%C3%B1o_sin_t%C3%ADtulo_4_xruh6t.png';
  }

  onImageError(event: any): void {
    event.target.src = '/https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_400/v1782840424/Dise%C3%B1o_sin_t%C3%ADtulo_4_xruh6t.png';
  }

  onAddClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.addingToCart && this.recommendation.stock > 0) {
      this.addClick.emit(this.recommendation);
    }
  }
}
