import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
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
  templateUrl: './product-reviews.component.html'
})
export class ProductReviewsComponent implements OnInit, OnDestroy {
  @Input() product!: PublicProduct;

  private destroy$ = new Subject<void>();

  // Estado
  isLoggedIn = false;
  loading = true;
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
    this.newReview.productId = this.product.id;
    
    this.authService.getCurrentUser().pipe(takeUntil(this.destroy$)).subscribe(user => {
      this.isLoggedIn = !!user;
      this.checkEligibility();
    });

    this.loadStatistics();
    this.loadReviews();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // --- Carga de datos ---
  
  loadStatistics(): void {
    this.reviewService.getProductStatistics(this.product.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stats) => {
          this.statistics = stats;
        },
        error: (err) => {
          console.error('Error cargando estadísticas', err);
        }
      });
  }

  loadReviews(append = false): void {
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
        error: (err) => {
          console.error('Error cargando reseñas', err);
          this.error = 'No se pudieron cargar las reseñas.';
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
