// ============================================
// PRODUCT REVIEW MODELS - Fase 2 E-Commerce
// ============================================

export interface ProductReviewDTO {
  id: number;
  productId: number;
  productName?: string;
  userId: number;
  userName: string;
  userAvatar?: string;
  rating: number;
  title: string;
  comment: string;
  status: ReviewStatus;
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  notHelpfulCount: number;
  userVote?: VoteType;
  sellerResponse?: string;
  sellerResponseDate?: string;
  images?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateReviewRequest {
  productId: number;
  rating: number;
  title: string;
  comment: string;
  images?: string[];
}

export interface UpdateReviewRequest {
  rating: number;
  title: string;
  comment: string;
  images?: string[];
}

export interface VoteReviewRequest {
  isHelpful: boolean;
}

export interface SellerResponseRequest {
  response: string;
}

export interface ReviewStatisticsDTO {
  productId: number;
  averageRating: number;
  totalReviews: number;
  verifiedPurchaseCount: number;
  fiveStarCount: number;
  fourStarCount: number;
  threeStarCount: number;
  twoStarCount: number;
  oneStarCount: number;
  ratingDistribution: RatingDistribution;
  recommendationPercentage: number;
}

export interface RatingDistribution {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

export interface ReviewFilterParams {
  rating?: number;
  verifiedOnly?: boolean;
  sortBy?: ReviewSortType;
  page?: number;
  size?: number;
}

export enum ReviewStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export enum ReviewSortType {
  RECENT = 'RECENT',
  HELPFUL = 'HELPFUL',
  RATING_HIGH = 'RATING_HIGH',
  RATING_LOW = 'RATING_LOW'
}

export enum VoteType {
  HELPFUL = 'HELPFUL',
  NOT_HELPFUL = 'NOT_HELPFUL'
}

// ============================================
// RESPONSE TYPES
// ============================================

export interface ReviewsResponse {
  reviews: ProductReviewDTO[];
  statistics: ReviewStatisticsDTO;
  totalElements: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export interface MyReviewsResponse {
  reviews: ProductReviewDTO[];
  totalReviews: number;
}

export interface EligibilityResponse {
  canReview: boolean;
  hasPurchased: boolean;
  alreadyReviewed: boolean;
  reviewId?: number;
  reviewStatus?: string;
}
