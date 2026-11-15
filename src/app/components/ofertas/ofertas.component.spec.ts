import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { OfertasComponent } from './ofertas.component';
import { AuthService } from '../../services/auth.service';
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';

describe('OfertasComponent', () => {
  let component: OfertasComponent;
  let fixture: ComponentFixture<OfertasComponent>;
  let products: jasmine.SpyObj<ProductService>;

  beforeEach(async () => {
    const auth = jasmine.createSpyObj<AuthService>('AuthService', ['getCurrentUser']);
    auth.getCurrentUser.and.returnValue(of(null));
    products = jasmine.createSpyObj<ProductService>('ProductService', ['getDiscountedProducts']);
    products.getDiscountedProducts.and.returnValue(of([]));
    const cart = jasmine.createSpyObj<CartService>('CartService', [], { cartCount$: of(0) });
    await TestBed.configureTestingModule({
      imports: [OfertasComponent],
      providers: [provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: ProductService, useValue: products },
        { provide: CartService, useValue: cart }]
    }).compileComponents();
    fixture = TestBed.createComponent(OfertasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(products.getDiscountedProducts).toHaveBeenCalledTimes(1);
    expect(component.ofertas).toEqual([]);
    expect(component.loading).toBeFalse();
    expect(component.isLoggedIn).toBeFalse();
  });
});
