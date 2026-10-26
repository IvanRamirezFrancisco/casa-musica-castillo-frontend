import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EMPTY, of } from 'rxjs';
import { CatalogoComponent } from './catalogo.component';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { PublicApiService } from '../../services/public-api.service';
import { WishlistService } from '../../services/wishlist.service';
import { ConnectivityService } from '../../services/connectivity.service';
import { SearchService } from '../../services/search.service';
import { VoiceSearchEvent, VoiceSearchService } from '../../services/voice-search.service';
import { CatalogSearchNavService } from '../../services/catalog-search-nav.service';
import { PublicProduct, SpringPage } from '../../models/product.model';

describe('CatalogoComponent', () => {
  let component: CatalogoComponent;
  let fixture: ComponentFixture<CatalogoComponent>;
  let api: jasmine.SpyObj<PublicApiService>;
  const emptyPage: SpringPage<PublicProduct> = {
    content: [], totalElements: 0, totalPages: 0, number: 0, size: 12,
    first: true, last: true, empty: true
  };

  beforeEach(async () => {
    const auth = jasmine.createSpyObj<AuthService>('AuthService', ['getCurrentUser']);
    auth.getCurrentUser.and.returnValue(of(null));
    api = jasmine.createSpyObj<PublicApiService>('PublicApiService', ['getActiveCategories', 'getCatalog']);
    api.getActiveCategories.and.returnValue(of([]));
    api.getCatalog.and.returnValue(of(emptyPage));
    const cart = jasmine.createSpyObj<CartService>('CartService', [], { cartCount$: of(0) });
    const wishlist = jasmine.createSpyObj<WishlistService>('WishlistService', ['isInWishlist', 'toggle']);
    wishlist.isInWishlist.and.returnValue(false);
    const connectivity = jasmine.createSpyObj<ConnectivityService>('ConnectivityService', [],
      { isOnline: true, isOnline$: of(true) });
    const state: VoiceSearchEvent = { status: 'IDLE', transcript: '', isFinal: false };
    const voice = jasmine.createSpyObj<VoiceSearchService>('VoiceSearchService',
      ['isSupported', 'toggleListening', 'stopListening'], { state$: of(state), transcript$: EMPTY });
    voice.isSupported.and.returnValue(false);
    const search = jasmine.createSpyObj<SearchService>('SearchService', ['sanitizeSearchQuery']);
    search.sanitizeSearchQuery.and.callFake(query => query.trim());
    const nav = jasmine.createSpyObj<CatalogSearchNavService>('CatalogSearchNavService',
      ['hasSearchInUrl', 'clearSearch', 'search']);
    await TestBed.configureTestingModule({
      imports: [CatalogoComponent],
      providers: [provideRouter([]),
        { provide: AuthService, useValue: auth }, { provide: PublicApiService, useValue: api },
        { provide: CartService, useValue: cart }, { provide: WishlistService, useValue: wishlist },
        { provide: ConnectivityService, useValue: connectivity }, { provide: SearchService, useValue: search },
        { provide: VoiceSearchService, useValue: voice }, { provide: CatalogSearchNavService, useValue: nav }]
    }).compileComponents();
    fixture = TestBed.createComponent(CatalogoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(api.getActiveCategories).toHaveBeenCalledOnceWith(true);
    expect(api.getCatalog).toHaveBeenCalledTimes(1);
    expect(component.productos).toEqual([]);
    expect(component.loading).toBeFalse();
    expect(component.error).toBeNull();
    expect(component.isLoggedIn).toBeFalse();
  });
});
