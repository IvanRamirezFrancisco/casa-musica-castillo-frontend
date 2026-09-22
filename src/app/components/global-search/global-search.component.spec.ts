import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { GlobalSearchComponent } from './global-search.component';
import { SearchService, SearchResult } from '../../services/search.service';
import { of, throwError } from 'rxjs';
import { Router } from '@angular/router';

describe('GlobalSearchComponent', () => {
  let component: GlobalSearchComponent;
  let fixture: ComponentFixture<GlobalSearchComponent>;
  let searchServiceSpy: jasmine.SpyObj<SearchService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    searchServiceSpy = jasmine.createSpyObj('SearchService', ['search', 'getSearchHistory']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    searchServiceSpy.getSearchHistory.and.returnValue(of(['historial 1']));

    await TestBed.configureTestingModule({
      imports: [GlobalSearchComponent],
      providers: [
        { provide: SearchService, useValue: searchServiceSpy },
        { provide: Router, useValue: routerSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GlobalSearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debería crearse el componente', () => {
    expect(component).toBeTruthy();
  });

  it('no debería buscar con menos de dos caracteres', fakeAsync(() => {
    const event = { target: { value: 'a' } } as any;
    component.onSearchInput(event);
    tick(400);
    expect(searchServiceSpy.search).not.toHaveBeenCalled();
    expect(component.isSearching).toBeFalse();
  }));

  it('debería ejecutar la búsqueda después del debounce (400ms) con más de 2 caracteres', fakeAsync(() => {
    const dummyResult: SearchResult = {
      products: [{ id: 1, name: 'Guitarra', price: 100 } as any],
      query: 'gui',
      totalResults: 1,
      executionTime: 10
    };
    searchServiceSpy.search.and.returnValue(of(dummyResult));

    const event = { target: { value: 'gui' } } as any;
    component.onSearchInput(event);
    
    // Antes del debounce
    expect(searchServiceSpy.search).not.toHaveBeenCalled();
    
    // Después del debounce
    tick(400);
    expect(searchServiceSpy.search).toHaveBeenCalledWith('gui');
    expect(component.searchResults.length).toBe(1);
    expect(component.hasSearched).toBeTrue();
  }));

  it('debería manejar el estado sin resultados', fakeAsync(() => {
    const dummyResult: SearchResult = {
      products: [],
      query: 'inexistente',
      totalResults: 0,
      executionTime: 5
    };
    searchServiceSpy.search.and.returnValue(of(dummyResult));

    component.onSearchInput({ target: { value: 'inexistente' } } as any);
    tick(400);

    expect(component.searchResults.length).toBe(0);
    expect(component.noResults).toBeTrue();
  }));

  it('debería manejar error simulado en la búsqueda', fakeAsync(() => {
    searchServiceSpy.search.and.returnValue(throwError(() => new Error('Network error')));
    
    component.onSearchInput({ target: { value: 'error' } } as any);
    tick(400);

    expect(component.isSearching).toBeFalse();
    expect(component.noResults).toBeTrue();
    expect(component.searchResults.length).toBe(0);
  }));

  it('debería manejar las flechas ArrowDown y ArrowUp (Teclado ARIA)', () => {
    component.showDropdown = true;
    component.hasSearched = true;
    component.searchResults = [
      { id: 1, name: 'A' } as any,
      { id: 2, name: 'B' } as any
    ];

    // Simular setTimeout interior de scrollIntoView
    spyOn(window, 'setTimeout').and.callFake((fn: any) => fn());

    const eventDown = new KeyboardEvent('keydown', { key: 'ArrowDown' });
    component.onKeyDown(eventDown);
    expect(component.activeIndex).toBe(0);

    component.onKeyDown(eventDown);
    expect(component.activeIndex).toBe(1);

    const eventUp = new KeyboardEvent('keydown', { key: 'ArrowUp' });
    component.onKeyDown(eventUp);
    expect(component.activeIndex).toBe(0);
  });

  it('debería limpiar el campo y emitir estado cerrado', () => {
    spyOn(component.searchActiveChange, 'emit');
    component.searchQuery = 'test';
    component.hasSearched = true;
    
    component.clearSearch();
    
    expect(component.searchQuery).toBe('');
    expect(component.searchResults.length).toBe(0);
    expect(component.showDropdown).toBeFalse();
    expect(component.searchActiveChange.emit).toHaveBeenCalledWith(false);
  });
  
  it('debería aplicar resaltado seguro usando getHighlightedParts en lugar de [innerHTML]', () => {
    component.searchQuery = 'guit';
    const parts = component.getHighlightedParts('Guitarra Acústica');
    
    expect(parts.length).toBeGreaterThan(0);
    // Guit debe estar en match
    const matchPart = parts.find(p => p.text.toLowerCase() === 'guit');
    expect(matchPart?.isMatch).toBeTrue();
  });
  
  it('debería manejar caracteres especiales regex sin lanzar error', () => {
    component.searchQuery = 'a*b';
    expect(() => {
      component.getHighlightedParts('a*b producto');
    }).not.toThrow();
    
    const parts = component.getHighlightedParts('a*b producto');
    expect(parts[0].text).toBe('a*b');
    expect(parts[0].isMatch).toBeTrue();
  });
});
