import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { CouponService } from '../../../services/coupon.service';
import {
  CouponDTO,
  CreateCouponRequest,
  DiscountType,
  CouponStatsDTO,
  CouponListResponse
} from '../../../models/cart.model';

/**
 * Componente para gestión completa de cupones (CRUD)
 * Funcionalidades: Crear, Listar, Editar, Desactivar, Ver Estadísticas
 */
@Component({
  selector: 'app-admin-coupons',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-coupons.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./admin-coupons.component.css']
})
export class AdminCouponsComponent implements OnInit, OnDestroy {
  private couponService = inject(CouponService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  // Estado del componente
  coupons: CouponDTO[] = [];
  loading = false;
  error: string | null = null;
  
  // Paginación
  currentPage = 0;
  pageSize = 10;
  totalCoupons = 0;
  totalPages = 0;

  // Modal de creación/edición
  showModal = false;
  editMode = false;
  currentCoupon: Partial<CreateCouponRequest> & { id?: number } = this.getEmptyCoupon();

  // Estadísticas
  selectedCouponStats: CouponStatsDTO | null = null;
  showStatsModal = false;

  // Enums para el template
  DiscountType = DiscountType;
  discountTypes = Object.values(DiscountType);

  ngOnInit(): void {
    this.loadCoupons();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Cargar lista de cupones con paginación
   */
  loadCoupons(): void {
    this.loading = true;
    this.error = null;

    this.couponService.getAllCoupons(this.currentPage, this.pageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: CouponListResponse) => {
          this.coupons = response.coupons;
          this.totalCoupons = response.totalCoupons;
          this.totalPages = response.totalPages;
          this.loading = false;
          console.log('✅ Cupones cargados:', this.coupons.length);
        },
        error: (err) => {
          this.error = 'Error al cargar cupones. Por favor, verifica la consola para más detalles.';
          this.loading = false;
          console.error('❌ Error completo:', err);
          console.error('❌ Status:', err.status);
          console.error('❌ Message:', err.message);
          console.error('❌ Error body:', err.error);
        }
      });
  }

  /**
   * Abrir modal para crear nuevo cupón
   */
  openCreateModal(): void {
    this.editMode = false;
    this.currentCoupon = this.getEmptyCoupon();
    this.showModal = true;
  }

  /**
   * Abrir modal para editar cupón existente
   */
  openEditModal(coupon: CouponDTO): void {
    this.editMode = true;
    this.currentCoupon = {
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minimumPurchase: coupon.minimumPurchase,
      maximumDiscount: coupon.maximumDiscount,
      validFrom: coupon.validFrom.split('T')[0], // Formato para input date
      validUntil: coupon.validUntil.split('T')[0],
      usageLimit: coupon.usageLimit,
      usageLimitPerUser: coupon.usageLimitPerUser,
      firstPurchaseOnly: coupon.firstPurchaseOnly,
      id: coupon.id // Guardar ID para edición
    };
    this.showModal = true;
  }

  /**
   * Cerrar modal
   */
  closeModal(): void {
    this.showModal = false;
    this.currentCoupon = this.getEmptyCoupon();
  }

  /**
   * Guardar cupón (crear o editar)
   */
  saveCoupon(): void {
    // Validaciones
    if (!this.validateCoupon()) {
      return;
    }

    this.loading = true;

    const request: CreateCouponRequest = {
      code: this.currentCoupon.code!.toUpperCase(),
      description: this.currentCoupon.description!,
      discountType: this.currentCoupon.discountType!,
      discountValue: this.currentCoupon.discountValue!,
      minimumPurchase: this.currentCoupon.minimumPurchase || undefined,
      maximumDiscount: this.currentCoupon.maximumDiscount || undefined,
      validFrom: this.currentCoupon.validFrom!,
      validUntil: this.currentCoupon.validUntil!,
      usageLimit: this.currentCoupon.usageLimit || undefined,
      usageLimitPerUser: this.currentCoupon.usageLimitPerUser || undefined,
      firstPurchaseOnly: this.currentCoupon.firstPurchaseOnly || false
    };

    if (this.editMode && this.currentCoupon.id) {
      // Editar cupón existente
      this.couponService.updateCoupon(this.currentCoupon.id, request)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.loading = false;
            this.closeModal();
            this.loadCoupons();
            this.showSuccess('Cupón actualizado exitosamente');
          },
          error: (err) => {
            this.loading = false;
            this.showError(err.error?.message || 'Error al actualizar cupón');
          }
        });
    } else {
      // Crear nuevo cupón
      this.couponService.createCoupon(request)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.loading = false;
            this.closeModal();
            this.loadCoupons();
            this.showSuccess('Cupón creado exitosamente');
          },
          error: (err) => {
            this.loading = false;
            this.showError(err.error?.message || 'Error al crear cupón');
          }
        });
    }
  }

  /**
   * Desactivar cupón
   */
  deactivateCoupon(coupon: CouponDTO): void {
    if (!confirm(`¿Desactivar el cupón "${coupon.code}"?`)) {
      return;
    }

    this.couponService.deactivateCoupon(coupon.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadCoupons();
          this.showSuccess('Cupón desactivado');
        },
        error: (err) => {
          this.showError(err.error?.message || 'Error al desactivar cupón');
        }
      });
  }

  /**
   * Ver estadísticas del cupón
   */
  viewStats(coupon: CouponDTO): void {
    this.couponService.getCouponStats(coupon.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stats) => {
          this.selectedCouponStats = stats;
          this.showStatsModal = true;
        },
        error: (err) => {
          this.showError('Error al cargar estadísticas');
        }
      });
  }

  /**
   * Cerrar modal de estadísticas
   */
  closeStatsModal(): void {
    this.showStatsModal = false;
    this.selectedCouponStats = null;
  }

  /**
   * Cambiar página
   */
  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.loadCoupons();
    }
  }

  /**
   * Validar formulario de cupón
   */
  private validateCoupon(): boolean {
    if (!this.currentCoupon.code?.trim()) {
      this.showError('El código es requerido');
      return false;
    }

    if (!this.currentCoupon.description?.trim()) {
      this.showError('La descripción es requerida');
      return false;
    }

    if (!this.currentCoupon.discountType) {
      this.showError('El tipo de descuento es requerido');
      return false;
    }

    if (!this.currentCoupon.discountValue || this.currentCoupon.discountValue <= 0) {
      this.showError('El valor del descuento debe ser mayor a 0');
      return false;
    }

    if (this.currentCoupon.discountType === DiscountType.PERCENTAGE && this.currentCoupon.discountValue > 100) {
      this.showError('El porcentaje no puede ser mayor a 100');
      return false;
    }

    if (!this.currentCoupon.validFrom) {
      this.showError('La fecha de inicio es requerida');
      return false;
    }

    if (!this.currentCoupon.validUntil) {
      this.showError('La fecha de fin es requerida');
      return false;
    }

    if (new Date(this.currentCoupon.validFrom) >= new Date(this.currentCoupon.validUntil)) {
      this.showError('La fecha de fin debe ser posterior a la fecha de inicio');
      return false;
    }

    return true;
  }

  /**
   * Obtener cupón vacío
   */
  private getEmptyCoupon(): Partial<CreateCouponRequest> {
    return {
      code: '',
      description: '',
      discountType: DiscountType.PERCENTAGE,
      discountValue: 0,
      minimumPurchase: undefined,
      maximumDiscount: undefined,
      validFrom: '',
      validUntil: '',
      usageLimit: undefined,
      usageLimitPerUser: 1,
      firstPurchaseOnly: false
    };
  }

  /**
   * Formatear descuento para mostrar
   */
  formatDiscount(coupon: CouponDTO): string {
    return this.couponService.formatDiscount(coupon);
  }

  /**
   * Obtener clase CSS según estado del cupón
   */
  getCouponStatusClass(coupon: CouponDTO): string {
    return this.couponService.getCouponStatusClass(coupon);
  }

  /**
   * Formatear fecha para mostrar
   */
  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Mostrar mensaje de éxito
   */
  private showSuccess(message: string): void {
    console.log('✅ SUCCESS:', message);
    alert(message); // TODO: Reemplazar con toast notification
  }

  /**
   * Mostrar mensaje de error
   */
  private showError(message: string): void {
    console.error('❌ ERROR:', message);
    this.error = message;
    setTimeout(() => this.error = null, 5000);
  }
}
