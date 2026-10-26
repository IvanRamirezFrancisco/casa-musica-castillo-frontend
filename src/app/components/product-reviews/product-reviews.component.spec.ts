import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProductReviewsComponent } from './product-reviews.component';
import { AuthService } from '../../services/auth.service';
import { ProductReviewService } from '../../services/product-review.service';
import { PublicProduct } from '../../models/product.model';

describe('ProductReviewsComponent', () => {
  let component: ProductReviewsComponent;
  let fixture: ComponentFixture<ProductReviewsComponent>;
  let reviews: jasmine.SpyObj<ProductReviewService>;
  const product: PublicProduct = {
    id: 1, sku: 'TEST-REVIEW-1', name: 'Guitarra de prueba', description: null,
    detailedDescription: null, price: 100, discountPrice: null, stock: 2,
    imageUrl: null, images: [], category: null, brand: null, attributes: [],
    model: null, weight: null, dimensions: null, featured: false,
    averageRating: 0, reviewCount: 0
  };

  beforeEach(async () => {
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
    expect(component.statistics?.averageRating).toBe(0);
    expect(component.statistics?.totalReviews).toBe(0);
    expect(component.loading).toBeFalse();
    expect(reviews.getProductStatistics).not.toHaveBeenCalled();
    expect(reviews.getProductReviews).not.toHaveBeenCalled();
    expect(reviews.checkEligibility).not.toHaveBeenCalled();
  });
});
