import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProductReviewsComponent } from './product-reviews.component';
import { AuthService } from '../../services/auth.service';
import { ProductReviewService } from '../../services/product-review.service';
import { PublicProduct } from '../../models/product.model';
import { ProductReviewDTO, ReviewStatus } from '../../models/review.model';

describe('ProductReviewsComponent', () => {
  let component: ProductReviewsComponent;
  let fixture: ComponentFixture<ProductReviewsComponent>;
  let reviews: jasmine.SpyObj<ProductReviewService>;
  let warnings: jasmine.Spy<typeof console.warn>;
  const product: PublicProduct = {
    id: 1, sku: 'TEST-REVIEW-1', name: 'Guitarra de prueba', description: null,
    detailedDescription: null, price: 100, discountPrice: null, stock: 2,
    imageUrl: null, images: [], category: null, brand: null, attributes: [],
    model: null, weight: null, dimensions: null, featured: false,
    averageRating: 0, reviewCount: 0
  };

  beforeEach(async () => {
    warnings = spyOn(console, 'warn').and.callThrough();
    const auth = jasmine.createSpyObj<AuthService>('AuthService', ['getCurrentUser']);
    auth.getCurrentUser.and.returnValue(of(null));
    reviews = jasmine.createSpyObj<ProductReviewService>('ProductReviewService',
      ['getProductStatistics', 'getProductReviews', 'checkEligibility']);
    await TestBed.configureTestingModule({
      imports: [ProductReviewsComponent],
      providers: [provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: ProductReviewService, useValue: reviews }]
    }).compileComponents();
    fixture = TestBed.createComponent(ProductReviewsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('product', product);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('article').length).toBe(0);
    expect(component.statistics?.averageRating).toBe(0);
    expect(component.statistics?.totalReviews).toBe(0);
    expect(component.loading).toBeFalse();
    expect(reviews.getProductStatistics).not.toHaveBeenCalled();
    expect(reviews.getProductReviews).not.toHaveBeenCalled();
    expect(reviews.checkEligibility).not.toHaveBeenCalled();
  });

  afterEach(() => {
    const duplicateKeyWarnings = warnings.calls.allArgs().flat()
      .filter(value => typeof value === 'string' && value.includes('NG0955'));
    expect(duplicateKeyWarnings).toEqual([]);
  });

  for (const { rating, filled } of [
    { rating: 0, filled: 0 }, { rating: 1, filled: 1 },
    { rating: 2.4, filled: 2 }, { rating: 2.5, filled: 3 }, { rating: 5, filled: 5 }
  ]) {
    it('renders five summary stars for rating ' + rating + ' without duplicate keys', () => {
      component.statistics = { ...component.statistics!, averageRating: rating };
      fixture.detectChanges();
      const element: HTMLElement = fixture.nativeElement;
      const stars = Array.from(element.querySelectorAll('span.text-3xl'));
      expect(stars.length).toBe(5);
      stars.forEach((star, index) => {
        expect(star.textContent?.trim()).toBe('★');
        expect(star.classList.contains('text-amber-400')).toBe(index < filled);
        expect(star.classList.contains('text-gray-200')).toBe(index >= filled);
      });
    });
  }

  it('preserves summary star nodes across rating changes and repeated detection', () => {
    const element: HTMLElement = fixture.nativeElement;
    const initialStars = Array.from(element.querySelectorAll('span.text-3xl'));
    for (const rating of [5, 2, 0]) {
      component.statistics = { ...component.statistics!, averageRating: rating };
      fixture.detectChanges();
      fixture.detectChanges();
      const stars = Array.from(element.querySelectorAll('span.text-3xl'));
      expect(stars.length).toBe(5);
      stars.forEach((star, index) => {
        expect(star).toBe(initialStars[index]);
        expect(star.classList.contains('text-amber-400')).toBe(index < rating);
      });
    }
  });

  it('renders review content and preserves its five star positions as the rating changes', () => {
    const review: ProductReviewDTO = {
      id: 1, productId: product.id, userId: 2, userName: 'Cliente de prueba',
      rating: 0, title: 'Reseña sintética', comment: 'Comentario de prueba del instrumento.',
      status: ReviewStatus.APPROVED, isVerifiedPurchase: true, helpfulCount: 0, notHelpfulCount: 0,
      createdAt: '2026-01-01T12:00:00Z', updatedAt: '2026-01-01T12:00:00Z'
    };
    component.reviews = [review];
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const initialStars = Array.from(element.querySelectorAll('article span.text-base'));
    expect(element.querySelectorAll('article').length).toBe(1);
    expect(element.querySelector('article')?.textContent).toContain(review.userName);
    expect(element.querySelector('article')?.textContent).toContain(review.title);
    expect(element.querySelector('article')?.textContent).toContain(review.comment);
    for (const rating of [0, 3, 5]) {
      review.rating = rating;
      fixture.detectChanges();
      fixture.detectChanges();
      const stars = Array.from(element.querySelectorAll('article span.text-base'));
      expect(stars.length).toBe(5);
      stars.forEach((star, index) => {
        expect(star).toBe(initialStars[index]);
        expect(star.textContent?.trim()).toBe('★');
        expect(star.classList.contains('text-amber-400')).toBe(index < rating);
        expect(star.classList.contains('text-gray-300')).toBe(index >= rating);
      });
    }
  });
});
