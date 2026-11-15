import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EMPTY, of } from 'rxjs';
import { MainHeaderComponent } from './main-header.component';
import { GlobalSearchComponent } from '../global-search/global-search.component';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { WishlistService } from '../../services/wishlist.service';

// Search has its own integration suite; isolate the header using its public bindings.
@Component({ selector: 'app-global-search', standalone: true, template: '' })
class GlobalSearchStubComponent {
  @Input() autoFocus = false;
  @Output() searchActiveChange = new EventEmitter<boolean>();
  @Output() searchExecuted = new EventEmitter<void>();
}

describe('MainHeaderComponent', () => {
  let component: MainHeaderComponent;
  let fixture: ComponentFixture<MainHeaderComponent>;

  beforeEach(async () => {
    const auth = jasmine.createSpyObj<AuthService>('AuthService', ['getCurrentUser', 'isAdmin', 'isSuperAdmin']);
    auth.getCurrentUser.and.returnValue(of(null));
    auth.isAdmin.and.returnValue(false);
    auth.isSuperAdmin.and.returnValue(false);
    const cart = jasmine.createSpyObj<CartService>('CartService', [],
      { cartCount$: of(2), addToCartAnimation$: EMPTY });
    const wishlist = jasmine.createSpyObj<WishlistService>('WishlistService', [], { wishlistCount$: of(3) });
    await TestBed.configureTestingModule({
      imports: [MainHeaderComponent],
      providers: [provideRouter([]),
        { provide: AuthService, useValue: auth }, { provide: CartService, useValue: cart },
        { provide: WishlistService, useValue: wishlist }]
    }).overrideComponent(MainHeaderComponent, {
      remove: { imports: [GlobalSearchComponent] }, add: { imports: [GlobalSearchStubComponent] }
    }).compileComponents();
    fixture = TestBed.createComponent(MainHeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.cartItemCount).toBe(2);
    expect(component.wishlistCount).toBe(3);
    expect(component.isLoggedIn).toBeFalse();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('app-global-search')).not.toBeNull();
    expect(element.querySelector('button[title="Iniciar sesión"]')).not.toBeNull();
  });
});
