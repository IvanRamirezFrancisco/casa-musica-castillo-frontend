import { Component, Input, OnInit, OnChanges, SimpleChanges, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ProductReviewService } from '../../services/product-review.service';
import { PublicProduct } from '../../models/product.model';
import {
  ProductReviewDTO,
  ReviewStatisticsDTO,
  EligibilityResponse,
  CreateReviewRequest,
  ReviewSortType
} from '../../models/review.model';
import { RouterModule, Router } from '@angular/router';

@Component({
  selector: 'app-product-reviews',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './product-reviews.component.html'
})
export class ProductReviewsComponent implements OnInit, OnChanges, OnDestroy {
  @Input() product!: PublicProduct;

  private destroy$ = new Subject<void>();
  private initializedProductId: number | null = null;

  // Estado
  isLoggedIn = false;
  loading = false;
  error: string | null = null;
  
  // Datos
  reviews: ProductReviewDTO[] = [];
  statistics: ReviewStatisticsDTO | null = null;
  eligibility: EligibilityResponse | null = null;
  totalReviews = 0;
  
  // Paginación
  currentPage = 0;
  pageSize = 5;
  hasMore = false;

  // Formulario
  showReviewForm = false;
  submitting = false;
  newReview: CreateReviewRequest = {
    productId: 0,
    rating: 0,
    title: '',
    comment: ''
  };

  constructor(
    private authService: AuthService,
    private reviewService: ProductReviewService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.authService.getCurrentUser().pipe(takeUntil(this.destroy$)).subscribe(user => {
      this.isLoggedIn = !!user;
      if (this.product?.id) {
        this.checkEligibility();
      }
    });

    if (this.product?.id) {
      this.initForProduct(this.product);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['product'] && this.product?.id && this.product.id !== this.initializedProductId) {
      this.initForProduct(this.product);
      if (this.isLoggedIn) {
        this.checkEligibility();
      }
    }
  }

  private initForProduct(product: PublicProduct): void {
    this.initializedProductId = product.id;
    this.newReview.productId = product.id;
    this.showReviewForm = false;
    this.error = null;
    this.reviews = [];
    this.currentPage = 0;
    this.hasMore = false;
    this.totalReviews = product.reviewCount ?? 0;

    // Sembrar estadísticas base desde el DTO del producto inmediatamente (0 ms)
    this.statistics = {
      productId: product.id,
      averageRating: product.averageRating ?? 0,
      totalReviews: product.reviewCount ?? 0,
      verifiedPurchaseCount: 0,
      fiveStarCount: 0,
      fourStarCount: 0,
      threeStarCount: 0,
      twoStarCount: 0,
      oneStarCount: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      recommendationPercentage: 0
    };

    // Si el producto tiene 0 reseñas registradas o estamos sin conexión, evitamos llamadas HTTP innecesarias
    const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
    if ((product.reviewCount ?? 0) > 0 && isOnline) {
      this.loadStatistics();
      this.loadReviews();
    } else {
      this.loading = false;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // --- Carga de datos ---
  
  loadStatistics(): void {
    if (!this.product?.id) return;
    this.reviewService.getProductStatistics(this.product.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stats) => {
          this.statistics = stats;
        },
        error: () => {
          // Degradación silenciosa: se conserva el resumen sembrado desde product
        }
      });
  }

  loadReviews(append = false): void {
    if (!this.product?.id) return;
    if (!append) {
      this.loading = true;
      this.currentPage = 0;
    }
    
    this.reviewService.getProductReviews(this.product.id, { page: this.currentPage, size: this.pageSize, sortBy: ReviewSortType.RECENT })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (append) {
            this.reviews = [...this.reviews, ...response.reviews];
          } else {
            this.reviews = response.reviews;
          }
          this.totalReviews = response.totalElements;
          this.hasMore = this.reviews.length < this.totalReviews;
          this.loading = false;
        },
        error: () => {
          // Degradación silenciosa sin bloquear el detalle de producto
          this.error = null;
          this.loading = false;
        }
      });
  }

  loadMore(): void {
    if (!this.hasMore) return;
    this.currentPage++;
    this.loadReviews(true);
  }

  checkEligibility(): void {
    if (!this.isLoggedIn) {
      this.eligibility = null;
      return;
    }
    this.reviewService.checkEligibility(this.product.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (eligibility) => {
          this.eligibility = eligibility;
        },
        error: (err) => {
          console.error('Error validando elegibilidad', err);
        }
      });
  }

  // --- Formulario ---
  
  toggleReviewForm(): void {
    if (!this.isLoggedIn) {
      this.router.navigate(['/login'], {
        queryParams: { returnUrl: `/producto/${this.product.id}` }
      });
      return;
    }
    this.showReviewForm = !this.showReviewForm;
    if (this.showReviewForm) {
      this.newReview = {
        productId: this.product.id,
        rating: 0,
        title: '',
        comment: ''
      };
    }
  }

  setRating(stars: number): void {
    this.newReview.rating = stars;
  }

  submitReview(): void {
    if (!this.isValidReview()) return;
    
    this.submitting = true;
    this.reviewService.createReview(this.newReview)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.submitting = false;
          this.showReviewForm = false;
          // Actualizar elegibilidad y recargar
          this.checkEligibility();
          alert('¡Gracias por tu reseña! Ha sido enviada y pronto será validada.');
          this.loadStatistics();
          this.loadReviews();
        },
        error: (err) => {
          this.submitting = false;
          console.error('Error enviando reseña', err);
          alert('Ocurrió un error al enviar la reseña. Inténtalo de nuevo.');
        }
      });
  }

  isValidReview(): boolean {
    return this.newReview.rating > 0 && 
           this.newReview.title.trim().length >= 3 && 
           this.newReview.comment.trim().length >= 10;
  }

  // --- Helper visuales ---
  
  getStars(rating: number): boolean[] {
    return Array(5).fill(false).map((_, i) => i < Math.round(rating));
  }

  getRatingBarPercent(stars: number): number {
    if (!this.statistics || this.statistics.totalReviews === 0) return 0;
    const countMap: any = {
      5: this.statistics.fiveStarCount,
      4: this.statistics.fourStarCount,
      3: this.statistics.threeStarCount,
      2: this.statistics.twoStarCount,
      1: this.statistics.oneStarCount
    };
    const count = countMap[stars] || 0;
    return Math.round((count / this.statistics.totalReviews) * 100);
  }
}
