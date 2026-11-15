import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ProductReviewDTO,
  CreateReviewRequest,
  UpdateReviewRequest,
  VoteReviewRequest,
  SellerResponseRequest,
  ReviewStatisticsDTO,
  ReviewsResponse,
  MyReviewsResponse,
  ReviewFilterParams,
  ReviewSortType,
  EligibilityResponse
} from '../models/review.model';

/**
 * Servicio para gestionar reseñas de productos
 * Consume los 18 endpoints de ProductReviewController del backend
 */
@Injectable({
  providedIn: 'root'
})
export class ProductReviewService {
  private readonly API_URL = `${environment.apiUrl}/reviews`;

  constructor(private http: HttpClient) {}

  // ============================================
  // ENDPOINTS PÚBLICOS Y DE USUARIO
  // ============================================

  /**
   * Crear una nueva reseña
   * POST /api/reviews
   * Requiere: USER role
   */
  createReview(request: CreateReviewRequest): Observable<ProductReviewDTO> {
    return this.http.post<ProductReviewDTO>(this.API_URL, request);
  }

  /**
   * Obtener reseñas de un producto con filtros
   * GET /api/reviews/product/{productId}
   * Público
   */
  getProductReviews(
    productId: number,
    filters?: ReviewFilterParams
  ): Observable<ReviewsResponse> {
    let params = new HttpParams();
    
    if (filters) {
      if (filters.rating !== undefined) {
        params = params.set('rating', filters.rating.toString());
      }
      if (filters.verifiedOnly !== undefined) {
        params = params.set('verifiedOnly', filters.verifiedOnly.toString());
      }
      if (filters.sortBy) {
        params = params.set('sortBy', filters.sortBy);
      }
      if (filters.page !== undefined) {
        params = params.set('page', filters.page.toString());
      }
      if (filters.size !== undefined) {
        params = params.set('size', filters.size.toString());
      }
    }

    return this.http.get<ReviewsResponse>(`${this.API_URL}/product/${productId}`, { params });
  }

  /**
   * Obtener estadísticas de reseñas de un producto
   * GET /api/reviews/product/{productId}/statistics
   * Público
   */
  getProductStatistics(productId: number): Observable<ReviewStatisticsDTO> {
    return this.http.get<ReviewStatisticsDTO>(`${this.API_URL}/product/${productId}/statistics`);
  }

  /**
   * Obtener una reseña específica por ID
   * GET /api/reviews/{reviewId}
   * Público
   */
  getReviewById(reviewId: number): Observable<ProductReviewDTO> {
    return this.http.get<ProductReviewDTO>(`${this.API_URL}/${reviewId}`);
  }

  /**
   * Obtener mis reseñas
   * GET /api/reviews/my-reviews
   * Requiere: USER role
   */
  getMyReviews(): Observable<MyReviewsResponse> {
    return this.http.get<MyReviewsResponse>(`${this.API_URL}/my-reviews`);
  }

  /**
   * Verificar la elegibilidad de reseñar un producto
   * GET /api/reviews/product/{productId}/eligibility
   */
  checkEligibility(productId: number): Observable<EligibilityResponse> {
    return this.http.get<EligibilityResponse>(
      `${this.API_URL}/product/${productId}/eligibility`
    );
  }

  /**
   * Actualizar una reseña existente
   * PUT /api/reviews/{reviewId}
   * Requiere: USER role (propietario)
   */
  updateReview(reviewId: number, request: UpdateReviewRequest): Observable<ProductReviewDTO> {
    return this.http.put<ProductReviewDTO>(`${this.API_URL}/${reviewId}`, request);
  }

  /**
   * Eliminar una reseña
   * DELETE /api/reviews/{reviewId}
   * Requiere: USER role (propietario) o ADMIN
   */
  deleteReview(reviewId: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${reviewId}`);
  }

  /**
   * Votar si una reseña es útil o no
   * POST /api/reviews/{reviewId}/vote
   * Requiere: USER role
   */
  voteReview(reviewId: number, request: VoteReviewRequest): Observable<ProductReviewDTO> {
    return this.http.post<ProductReviewDTO>(`${this.API_URL}/${reviewId}/vote`, request);
  }

  /**
   * Cambiar el voto de una reseña
   * PUT /api/reviews/{reviewId}/vote
   * Requiere: USER role
   */
  updateVote(reviewId: number, request: VoteReviewRequest): Observable<ProductReviewDTO> {
    return this.http.put<ProductReviewDTO>(`${this.API_URL}/${reviewId}/vote`, request);
  }

  /**
   * Remover voto de una reseña
   * DELETE /api/reviews/{reviewId}/vote
   * Requiere: USER role
   */
  removeVote(reviewId: number): Observable<ProductReviewDTO> {
    return this.http.delete<ProductReviewDTO>(`${this.API_URL}/${reviewId}/vote`);
  }

  // ============================================
  // ENDPOINTS DE ADMINISTRACIÓN Y MODERACIÓN
  // ============================================

  /**
   * Obtener reseñas pendientes de aprobación
   * GET /api/reviews/pending
   * Requiere: ADMIN role
   */
  getPendingReviews(page: number = 0, size: number = 20): Observable<ReviewsResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    
    return this.http.get<ReviewsResponse>(`${this.API_URL}/pending`, { params });
  }

  /**
   * Aprobar una reseña
   * POST /api/reviews/{reviewId}/approve
   * Requiere: ADMIN role
   */
  approveReview(reviewId: number): Observable<ProductReviewDTO> {
    return this.http.post<ProductReviewDTO>(`${this.API_URL}/${reviewId}/approve`, {});
  }

  /**
   * Rechazar una reseña
   * POST /api/reviews/{reviewId}/reject
   * Requiere: ADMIN role
   */
  rejectReview(reviewId: number): Observable<ProductReviewDTO> {
    return this.http.post<ProductReviewDTO>(`${this.API_URL}/${reviewId}/reject`, {});
  }

  /**
   * Agregar respuesta del vendedor a una reseña
   * POST /api/reviews/{reviewId}/seller-response
   * Requiere: ADMIN role
   */
  addSellerResponse(reviewId: number, request: SellerResponseRequest): Observable<ProductReviewDTO> {
    return this.http.post<ProductReviewDTO>(`${this.API_URL}/${reviewId}/seller-response`, request);
  }

  /**
   * Actualizar respuesta del vendedor
   * PUT /api/reviews/{reviewId}/seller-response
   * Requiere: ADMIN role
   */
  updateSellerResponse(reviewId: number, request: SellerResponseRequest): Observable<ProductReviewDTO> {
    return this.http.put<ProductReviewDTO>(`${this.API_URL}/${reviewId}/seller-response`, request);
  }

  /**
   * Eliminar respuesta del vendedor
   * DELETE /api/reviews/{reviewId}/seller-response
   * Requiere: ADMIN role
   */
  deleteSellerResponse(reviewId: number): Observable<ProductReviewDTO> {
    return this.http.delete<ProductReviewDTO>(`${this.API_URL}/${reviewId}/seller-response`);
  }

  // ============================================
  // MÉTODOS HELPER
  // ============================================

  /**
   * Calcular porcentaje de cada rating
   */
  calculateRatingPercentages(stats: ReviewStatisticsDTO): { [key: number]: number } {
    const total = stats.totalReviews;
    if (total === 0) return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    return {
      5: (stats.fiveStarCount / total) * 100,
      4: (stats.fourStarCount / total) * 100,
      3: (stats.threeStarCount / total) * 100,
      2: (stats.twoStarCount / total) * 100,
      1: (stats.oneStarCount / total) * 100
    };
  }

  /**
   * Formatear rating para mostrar (ej: 4.5 estrellas)
   */
  formatRating(rating: number): string {
    return rating.toFixed(1);
  }

  /**
   * Obtener clase CSS según el rating
   */
  getRatingClass(rating: number): string {
    if (rating >= 4.5) return 'excellent';
    if (rating >= 3.5) return 'good';
    if (rating >= 2.5) return 'average';
    return 'poor';
  }
}
