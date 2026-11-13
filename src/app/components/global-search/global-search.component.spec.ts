import { provideZoneChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import type { Event as RouterEvent } from '@angular/router';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { GlobalSearchComponent } from './global-search.component';
import { PublicProduct } from '../../models/product.model';
import { SearchResult, SearchService } from '../../services/search.service';
import { PublicApiService } from '../../services/public-api.service';
import { VoiceSearchEvent, VoiceSearchService } from '../../services/voice-search.service';
import { ConnectivityService } from '../../services/connectivity.service';
import { CatalogSearchNavService } from '../../services/catalog-search-nav.service';

function product(id: number, name = 'Guitarra sintética'): PublicProduct {
  return {
    id, sku: 'TEST-' + id, name, description: null, detailedDescription: null,
    price: 100, discountPrice: null, stock: 2,
    imageUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
    images: [], category: null, brand: null, attributes: [], model: null,
    weight: null, dimensions: null, featured: false, averageRating: 0, reviewCount: 0
  };
}

function result(overrides: Partial<SearchResult> = {}): SearchResult {
  return { products: [], categories: [], brands: [], totalResults: 0, executionTime: 1, ...overrides };
}

describe('GlobalSearchComponent', () => {
  let component: GlobalSearchComponent;
  let fixture: ComponentFixture<GlobalSearchComponent>;
  let search: jasmine.SpyObj<SearchService>;
  let voice: jasmine.SpyObj<VoiceSearchService>;
  let catalog: jasmine.SpyObj<CatalogSearchNavService>;
  let router: jasmine.SpyObj<Router>;
  let online: BehaviorSubject<boolean>;
  let voiceState: BehaviorSubject<VoiceSearchEvent>;
  let transcripts: Subject<{ transcript: string; isFinal: boolean; sourceId?: string }>;
  let routerEvents: Subject<RouterEvent>;

  beforeEach(async () => {
    online = new BehaviorSubject(true);
    voiceState = new BehaviorSubject<VoiceSearchEvent>({ status: 'IDLE', transcript: '', isFinal: false });
    transcripts = new Subject();
    routerEvents = new Subject<RouterEvent>();
    const connectivity = jasmine.createSpyObj<ConnectivityService>('ConnectivityService', [], {
      isOnline: true, isOnline$: online.asObservable()
    });
    Object.defineProperty(connectivity, 'isOnline', { get: () => online.value });
    voice = jasmine.createSpyObj<VoiceSearchService>('VoiceSearchService',
      ['isSupported', 'toggleListening', 'stopListening'],
      { state$: voiceState.asObservable(), transcript$: transcripts.asObservable() });
    voice.isSupported.and.returnValue(true);
    router = jasmine.createSpyObj<Router>('Router', ['navigate'], { url: '/home', events: routerEvents.asObservable() });
    router.navigate.and.resolveTo(true);
    catalog = jasmine.createSpyObj<CatalogSearchNavService>('CatalogSearchNavService',
      ['search', 'filterBy', 'isOnCatalog', 'getSearchFromUrl', 'hasSearchInUrl', 'clearSearch']);
    catalog.search.and.resolveTo(true);
    catalog.filterBy.and.resolveTo(true);
    catalog.clearSearch.and.resolveTo(true);
    catalog.isOnCatalog.and.returnValue(false);
    catalog.hasSearchInUrl.and.returnValue(false);
    catalog.getSearchFromUrl.and.returnValue('');
    search = jasmine.createSpyObj<SearchService>('SearchService', [
      'searchProducts', 'getSearchHistory', 'analyzeQuery', 'sanitizeSearchQuery',
      'saveToSearchHistory', 'removeFromSearchHistory', 'clearSearchHistory', 'prefetchCategories'
    ]);
    search.getSearchHistory.and.returnValue(['historial sintético']);
    search.searchProducts.and.returnValue(of(result()));
    // Reuse the real pure normalization API; all network/storage operations remain mocked.
    const publicApi = jasmine.createSpyObj<PublicApiService>('PublicApiService', ['getActiveCategories']);
    const normalization = new SearchService(publicApi, connectivity);
    search.analyzeQuery.and.callFake(query => normalization.analyzeQuery(query));
    search.sanitizeSearchQuery.and.callFake(query => normalization.sanitizeSearchQuery(query));

    await TestBed.configureTestingModule({
      imports: [GlobalSearchComponent],
      providers: [
        provideZoneChangeDetection(),
        { provide: SearchService, useValue: search },
        { provide: VoiceSearchService, useValue: voice },
        { provide: ConnectivityService, useValue: connectivity },
        { provide: CatalogSearchNavService, useValue: catalog },
        { provide: Router, useValue: router }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(GlobalSearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    online.complete(); voiceState.complete(); transcripts.complete(); routerEvents.complete();
  });

  function typeQuery(value: string): void {
    const input = component.searchInput.nativeElement;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function key(value: string): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key: value, cancelable: true });
    component.handleKeyboardNavigation(event);
    return event;
  }

  function loadProducts(): void {
    search.searchProducts.and.returnValue(of(result({ products: [product(1), product(2)], totalResults: 2 })));
    typeQuery('guitarra');
    tick(300);
  }

  it('creates the real template with synchronous history and current providers', () => {
    expect(component).toBeTruthy();
    expect(component.recentSearches).toEqual(['historial sintético']);
    expect(component.voiceSupported).toBeTrue();
    expect(component.searchInput.nativeElement.getAttribute('role')).toBe('combobox');
  });

  it('does not search with fewer than two characters', fakeAsync(() => {
    typeQuery('a'); tick(300);
    expect(search.searchProducts).not.toHaveBeenCalled();
    expect(component.isLoading).toBeFalse();
    expect(component.searchResults).toEqual([]);
  }));

  it('waits exactly 300 ms and trims the query before requesting results', fakeAsync(() => {
    const response = new Subject<SearchResult>();
    search.searchProducts.and.returnValue(response);
    typeQuery('  gui  ');
    expect(component.isLoading).toBeTrue();
    tick(299);
    expect(search.searchProducts).not.toHaveBeenCalled();
    tick(1);
    expect(search.searchProducts).toHaveBeenCalledOnceWith('gui');
    expect(component.isLoading).toBeTrue();
    response.next(result({ products: [product(1)], totalResults: 1 }));
    response.complete();
    expect(component.searchResults).toEqual([product(1)]);
    expect(component.totalResults).toBe(1);
    expect(component.isLoading).toBeFalse();
    expect(component.noResults).toBeFalse();
  }));

  it('deduplicates repeated queries', fakeAsync(() => {
    typeQuery('guitarra'); tick(300);
    typeQuery('guitarra'); tick(300);
    expect(search.searchProducts).toHaveBeenCalledTimes(1);
  }));

  it('shows the empty state only for a successful search without matches', fakeAsync(() => {
    typeQuery('inexistente'); tick(300); fixture.detectChanges();
    expect(component.searchResults).toEqual([]);
    expect(component.noResults).toBeTrue();
    expect(component.hasSearchError).toBeFalse();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.textContent).toContain('No encontramos resultados');
  }));

  it('limits visible products while preserving totals and grouped matches', fakeAsync(() => {
    const products = Array.from({ length: 7 }, (_, i) => product(i + 1));
    const category = { id: 10, name: 'Cuerdas', description: null, imageUrl: null,
      parentId: null, parentName: null, activeProductCount: 7 };
    const brand = { id: 20, name: 'Marca sintética', logoUrl: null };
    search.searchProducts.and.returnValue(of(result({ products, categories: [category], brands: [brand], totalResults: 7 })));
    typeQuery('guitarra'); tick(300);
    expect(component.searchResults).toEqual(products.slice(0, 5));
    expect(component.totalResults).toBe(7);
    expect(component.categoryMatches).toEqual([category]);
    expect(component.brandMatches).toEqual([brand]);
    expect(component.navigableItems.map(item => item.type)).toEqual([
      'product', 'product', 'product', 'product', 'product', 'category', 'brand', 'view-all'
    ]);
  }));

  it('distinguishes an unavailable server from no results', fakeAsync(() => {
    search.searchProducts.and.returnValue(of(result({ serverUnavailable: true })));
    typeQuery('guitarra'); tick(300);
    expect(component.isServerUnavailable).toBeTrue();
    expect(component.noResults).toBeFalse();
    expect(component.isLoading).toBeFalse();
  }));

  it('does not request the service while offline', fakeAsync(() => {
    online.next(false);
    typeQuery('guitarra'); tick(300);
    expect(search.searchProducts).not.toHaveBeenCalled();
    expect(component.isOfflineState).toBeTrue();
    expect(component.noResults).toBeFalse();
    expect(component.isLoading).toBeFalse();
  }));

  it('retries the current query when connectivity returns', fakeAsync(() => {
    online.next(false); typeQuery('guitarra'); tick(300);
    search.searchProducts.and.returnValue(of(result({ products: [product(1)], totalResults: 1 })));
    online.next(true);
    expect(search.searchProducts).toHaveBeenCalledOnceWith('guitarra');
    expect(component.isOfflineState).toBeFalse();
    expect(component.searchResults).toEqual([product(1)]);
  }));

  it('uses the current controlled error state when the request fails', fakeAsync(() => {
    search.searchProducts.and.returnValue(throwError(() => new Error('Synthetic transport failure')));
    typeQuery('guitarra'); tick(300); fixture.detectChanges();
    expect(component.isLoading).toBeFalse();
    expect(component.hasSearchError).toBeTrue();
    expect(component.noResults).toBeFalse();
    expect(component.searchResults).toEqual([]);
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('El buscador no está disponible temporalmente');
    expect(host.textContent).not.toContain('Synthetic transport failure');
  }));

  it('cancels an in-flight request when clearing the search', fakeAsync(() => {
    const response = new Subject<SearchResult>();
    search.searchProducts.and.returnValue(response);
    typeQuery('guitarra'); tick(300);
    component.clearSearch();
    response.next(result({ products: [product(1)], totalResults: 1 }));
    response.complete(); tick(300);
    expect(component.searchQuery).toBe('');
    expect(component.searchResults).toEqual([]);
    expect(component.isLoading).toBeFalse();
  }));

  it('moves selectedIndex with arrows and respects both bounds', fakeAsync(() => {
    loadProducts();
    expect(key('ArrowDown').defaultPrevented).toBeTrue();
    expect(component.selectedIndex).toBe(0);
    key('ArrowDown'); expect(component.selectedIndex).toBe(1);
    key('ArrowDown'); key('ArrowDown'); expect(component.selectedIndex).toBe(2);
    key('ArrowUp'); expect(component.selectedIndex).toBe(1);
    key('ArrowUp'); key('ArrowUp'); key('ArrowUp');
    expect(component.selectedIndex).toBe(-1);
    expect(component.activeDescendantId).toBeNull();
  }));

  it('activates the selected product on Enter', fakeAsync(() => {
    loadProducts();
    spyOn(component.searchExecuted, 'emit');
    key('ArrowDown'); key('Enter');
    expect(router.navigate).toHaveBeenCalledOnceWith(['/producto', 1]);
    expect(search.saveToSearchHistory).toHaveBeenCalledWith('guitarra');
    expect(component.searchExecuted.emit).toHaveBeenCalledTimes(1);
    expect(component.showDropdown).toBeFalse();
    expect(component.selectedIndex).toBe(-1);
  }));

  it('navigates immediately on Enter without waiting for autocomplete', fakeAsync(() => {
    spyOn(component.searchExecuted, 'emit');
    typeQuery('guitarra'); key('Enter'); tick(300);
    expect(catalog.search).toHaveBeenCalledOnceWith('guitarra');
    expect(search.searchProducts).not.toHaveBeenCalled();
    expect(component.searchExecuted.emit).toHaveBeenCalledTimes(1);
    expect(component.showDropdown).toBeFalse();
  }));

  it('activates a selected history item through the catalog navigation service', fakeAsync(() => {
    component.onSearchFocus(); key('ArrowDown'); key('Enter'); tick(300);
    expect(catalog.search).toHaveBeenCalledOnceWith('historial sintético');
    expect(search.searchProducts).not.toHaveBeenCalled();
  }));

  it('closes and blurs the dropdown on Escape', () => {
    component.searchInput.nativeElement.focus();
    component.selectedIndex = 0;
    expect(key('Escape').defaultPrevented).toBeTrue();
    expect(component.showDropdown).toBeFalse();
    expect(component.selectedIndex).toBe(-1);
    expect(document.activeElement).not.toBe(component.searchInput.nativeElement);
  });

  it('stops voice listening on Escape before closing the dropdown', () => {
    component.onSearchFocus();
    voiceState.next({ status: 'LISTENING', transcript: '', isFinal: false, sourceId: component.instanceId });
    key('Escape');
    expect(voice.stopListening).toHaveBeenCalledOnceWith(component.instanceId);
    expect(component.showDropdown).toBeTrue();
  });

  it('clears text/results/selection and restores history and focus', fakeAsync(() => {
    loadProducts(); component.selectedIndex = 1;
    spyOn(component.searchExecuted, 'emit');
    component.clearSearch(); tick(300);
    expect(component.searchQuery).toBe('');
    expect(component.searchResults).toEqual([]);
    expect(component.categoryMatches).toEqual([]);
    expect(component.brandMatches).toEqual([]);
    expect(component.selectedIndex).toBe(-1);
    expect(component.navigableItems[0].type).toBe('history');
    expect(document.activeElement).toBe(component.searchInput.nativeElement);
    expect(component.showDropdown).toBeTrue();
    expect(component.searchExecuted.emit).not.toHaveBeenCalled();
    expect(catalog.clearSearch).not.toHaveBeenCalled();
  }));

  it('delegates removal of the URL search only when catalog search is active', fakeAsync(() => {
    catalog.isOnCatalog.and.returnValue(true);
    catalog.hasSearchInUrl.and.returnValue(true);
    component.clearSearch(); tick(300);
    expect(catalog.clearSearch).toHaveBeenCalledTimes(1);
    catalog.clearSearch.calls.reset();
    catalog.hasSearchInUrl.and.returnValue(false);
    component.clearSearch(); tick(300);
    expect(catalog.clearSearch).not.toHaveBeenCalled();
  }));

  it('prefetches categories on focus only while online', () => {
    component.onSearchFocus();
    expect(search.prefetchCategories).toHaveBeenCalledTimes(1);
    search.prefetchCategories.calls.reset(); online.next(false);
    component.onSearchFocus();
    expect(search.prefetchCategories).not.toHaveBeenCalled();
  });

  it('ignores other voice instances and navigates only on its final transcript', fakeAsync(() => {
    transcripts.next({ transcript: 'Otra instancia', isFinal: true, sourceId: component.instanceId + '-other' });
    expect(component.searchQuery).toBe('');
    transcripts.next({ transcript: 'gui', isFinal: false, sourceId: component.instanceId });
    expect(component.searchQuery).toBe('gui');
    expect(catalog.search).not.toHaveBeenCalled();
    transcripts.next({ transcript: 'Guitarra', isFinal: true, sourceId: component.instanceId }); tick(300);
    expect(catalog.search).toHaveBeenCalledOnceWith('Guitarra');
    expect(search.searchProducts).not.toHaveBeenCalled();
  }));

  it('closes on navigation and synchronizes input from the current catalog URL', () => {
    component.onSearchFocus(); component.selectedIndex = 0;
    routerEvents.next(new NavigationStart(1, '/catalogo'));
    expect(component.showDropdown).toBeFalse();
    expect(component.selectedIndex).toBe(-1);
    catalog.isOnCatalog.and.returnValue(true);
    catalog.getSearchFromUrl.and.returnValue('bajo');
    routerEvents.next(new NavigationEnd(1, '/catalogo', '/catalogo?search=bajo'));
    expect(component.searchQuery).toBe('bajo');
    expect(component.searchResults).toEqual([]);
  });

  it('highlights a matching fragment using the explicit query', () => {
    expect(component.getHighlightedParts('Guitarra Acústica', 'guit')).toEqual([
      { text: 'Guit', isMatch: true }, { text: 'arra Acústica', isMatch: false }
    ]);
  });

  it('highlights without case or accent differences', () => {
    expect(component.getHighlightedParts('Guitarra Acústica', 'ACÚSTICA')).toEqual([
      { text: 'Guitarra ', isMatch: false }, { text: 'Acústica', isMatch: true }
    ]);
  });

  it('leaves unmatched text unchanged', () => {
    expect(component.getHighlightedParts('Guitarra', 'trompeta')).toEqual([{ text: 'Guitarra', isMatch: false }]);
  });

  it('handles empty text', () => {
    expect(component.getHighlightedParts('', 'guitarra')).toEqual([]);
  });

  it('handles an empty query', () => {
    expect(component.getHighlightedParts('Guitarra', '')).toEqual([{ text: 'Guitarra', isMatch: false }]);
  });

  it('treats regex metacharacters as normalized text, not a regular expression', () => {
    expect(() => component.getHighlightedParts('a*b producto', 'a*b')).not.toThrow();
    expect(component.getHighlightedParts('a*b producto', 'a*b')).toEqual([{ text: 'a*b producto', isMatch: false }]);
  });

  it('renders an ordinary product highlight across change detection', fakeAsync(() => {
    search.searchProducts.and.returnValue(of(result({ products: [product(1, 'Guitarra Acústica')], totalResults: 1 })));
    typeQuery('guitarra'); tick(300); fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('.product-name mark')?.textContent).toBe('Guitarra');
    expect(host.querySelector('.product-name')?.textContent).toContain('Acústica');
  }));

  it('renders product markup as text while highlighting safely', fakeAsync(() => {
    search.searchProducts.and.returnValue(of(result({ products: [product(1, '<b>Guitarra</b>')], totalResults: 1 })));
    typeQuery('guitarra'); tick(300); fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const name = host.querySelector('.product-name');
    expect(name?.textContent).toMatch(/^\s*<b>\s*Guitarra\s*<\/b>\s*$/);
    expect(name?.querySelector('b')).toBeNull();
    expect(name?.querySelector('mark')?.textContent).toBe('Guitarra');
  }));

  it('keeps repeated fragments stable and updates them when the query changes', fakeAsync(() => {
    search.searchProducts.and.returnValue(of(result({ products: [product(1, 'Guitarra Guitarra')], totalResults: 1 })));
    typeQuery('guitarra'); tick(300); fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const firstMarks = Array.from(host.querySelectorAll('.product-name mark'));
    expect(firstMarks.length).toBe(2);
    expect(firstMarks.map(mark => mark.textContent)).toEqual(['Guitarra', 'Guitarra']);
    fixture.detectChanges();
    const nextMarks = Array.from(host.querySelectorAll('.product-name mark'));
    expect(nextMarks[0]).toBe(firstMarks[0]);
    expect(nextMarks[1]).toBe(firstMarks[1]);
    typeQuery('trompeta'); tick(300); fixture.detectChanges();
    expect(host.querySelectorAll('.product-name mark').length).toBe(0);
    expect(host.querySelector('.product-name')?.textContent).toContain('Guitarra Guitarra');
  }));

  it('renders a script payload as literal text without creating a script element', fakeAsync(() => {
    search.searchProducts.and.returnValue(of(result({ products: [product(1, '<script>alert(1)</script>')], totalResults: 1 })));
    typeQuery('alert'); tick(300); fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const name = host.querySelector('.product-name');
    expect(name?.textContent?.replace(/\s+/g, '')).toBe('<script>alert(1)</script>');
    expect(name?.querySelector('script')).toBeNull();
    expect(name?.querySelector('mark')?.textContent).toBe('alert');
  }));

});
