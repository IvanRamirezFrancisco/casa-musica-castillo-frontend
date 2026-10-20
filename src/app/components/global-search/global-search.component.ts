import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  ElementRef,
  ViewChild,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationStart, NavigationEnd } from '@angular/router';
import { Subject, Subscription, of } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  filter,
  takeUntil,
} from 'rxjs/operators';
import { CatalogSearchNavService } from '../../services/catalog-search-nav.service';
import {
  SearchService,
  SearchResult,
  SearchBrandMatch,
} from '../../services/search.service';
import { PublicCategory, PublicProduct } from '../../models/product.model';
import {
  VoiceSearchService,
  VoiceSearchEvent,
} from '../../services/voice-search.service';
import { ConnectivityService } from '../../services/connectivity.service';

export interface NavigableSearchItem {
  type: 'history' | 'suggestion' | 'product' | 'category' | 'brand' | 'view-all';
  id: string;
  label: string;
  product?: PublicProduct;
  category?: PublicCategory;
  brand?: SearchBrandMatch;
  query?: string;
}

@Component({
  selector: 'app-global-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './global-search.component.html',
  styleUrls: ['./global-search.component.css'],
})
export class GlobalSearchComponent implements OnInit, OnDestroy {
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  @Input() placeholder = 'Buscar instrumentos, marcas, modelos...';
  @Input() autoFocus = false;
  @Output() searchExecuted = new EventEmitter<void>();
  @Output() searchActiveChange = new EventEmitter<boolean>();

  private static nextId = 1;
  readonly instanceId = `global-search-${GlobalSearchComponent.nextId++}`;
  readonly inputId = `${this.instanceId}-input`;
  readonly listboxId = `${this.instanceId}-listbox`;

  searchQuery = '';
  searchResults: PublicProduct[] = [];
  categoryMatches: PublicCategory[] = [];
  brandMatches: SearchBrandMatch[] = [];
  recentSearches: string[] = [];
  popularSuggestions: string[] = [
    'Guitarra acústica',
    'Yamaha',
    'Jarana huasteca',
    'Micrófono',
    'Cuerdas',
  ];

  isLoading = false;
  showDropdown = false;
  noResults = false;
  isOfflineState = false;
  isServerUnavailable = false;
  hasSearchError = false;
  totalResults = 0;
  suggestedTerm: string | null = null;
  effectiveQuery = '';

  selectedIndex = -1;
  navigableItems: NavigableSearchItem[] = [];

  voiceSupported = false;
  voiceState: VoiceSearchEvent = {
    status: 'IDLE',
    transcript: '',
    isFinal: false,
  };

  private searchSubject = new Subject<string>();
  private cancelSearch$ = new Subject<void>();
  private searchSubscription?: Subscription;
  private voiceStateSub?: Subscription;
  private voiceTranscriptSub?: Subscription;
  private routerSub?: Subscription;
  private connectivitySub?: Subscription;

  readonly MAX_PRODUCTS_DISPLAYED = 5;

  constructor(
    private searchService: SearchService,
    private voiceSearchService: VoiceSearchService,
    private connectivityService: ConnectivityService,
    private catalogNav: CatalogSearchNavService,
    private router: Router,
    private elementRef: ElementRef
  ) {}

  ngOnInit(): void {
    this.voiceSupported = this.voiceSearchService.isSupported();
    this.recentSearches = this.searchService.getSearchHistory();
    this.rebuildNavigableItems();

    // Pipeline reactivo con debounce de 300ms (rango 250-350ms), distinctUntilChanged y switchMap
    this.searchSubscription = this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((query) => {
          const trimmed = query.trim();
          if (trimmed.length < 2) {
            return of(null);
          }

          if (!this.connectivityService.isOnline) {
            this.isLoading = false;
            return of({
              products: [],
              categories: [],
              brands: [],
              totalResults: 0,
              executionTime: 0,
              offline: true,
              serverUnavailable: false,
            } as SearchResult);
          }

          this.isLoading = true;
          this.noResults = false;
          this.isOfflineState = false;
          this.isServerUnavailable = false;
          this.hasSearchError = false;
          return this.searchService
            .searchProducts(trimmed)
            .pipe(takeUntil(this.cancelSearch$));
        })
      )
      .subscribe({
        next: (result: SearchResult | null) => {
          this.isLoading = false;

          if (result === null) {
            this.resetResultData();
            this.rebuildNavigableItems();
            return;
          }

          this.isOfflineState = !!result.offline;
          this.isServerUnavailable = !!result.serverUnavailable;
          this.hasSearchError = false;
          this.suggestedTerm = result.suggestedTerm || null;
          this.effectiveQuery = result.effectiveQuery || this.searchQuery.trim();

          this.searchResults = (result.products || []).slice(
            0,
            this.MAX_PRODUCTS_DISPLAYED
          );
          this.categoryMatches = result.categories || [];
          this.brandMatches = result.brands || [];
          this.totalResults = result.totalResults || 0;

          const hasAnyMatch =
            this.searchResults.length > 0 ||
            this.categoryMatches.length > 0 ||
            this.brandMatches.length > 0;

          this.noResults =
            !hasAnyMatch &&
            !this.isOfflineState &&
            !this.isServerUnavailable &&
            this.searchQuery.trim().length >= 2;

          this.selectedIndex = -1;
          this.rebuildNavigableItems();
        },
        error: () => {
          this.isLoading = false;
          this.resetResultData();
          this.hasSearchError = true;
          this.rebuildNavigableItems();
        },
      });

    // Suscripción al estado de búsqueda por voz
    this.voiceStateSub = this.voiceSearchService.state$.subscribe((state) => {
      if (!state.sourceId || state.sourceId === this.instanceId) {
        this.voiceState = state;
      } else if (this.voiceState.status !== 'IDLE') {
        this.voiceState = { status: 'IDLE', transcript: '', isFinal: false };
      }
    });

    // Transcripción de voz: parcial → solo input; final → MISMO flujo que Enter
    this.voiceTranscriptSub = this.voiceSearchService.transcript$
      .pipe(filter((evt) => evt.sourceId === this.instanceId))
      .subscribe((evt) => {
        const clean = this.searchService.sanitizeSearchQuery(evt.transcript);
        this.searchQuery = clean;
        if (evt.isFinal) {
          this.executeSearch(clean);
        }
      });

    // La URL es la fuente de verdad: cerrar dropdown al navegar y reflejar `search` en el input
    this.routerSub = this.router.events.subscribe((evt) => {
      if (evt instanceof NavigationStart) {
        this.closeDropdown();
      } else if (evt instanceof NavigationEnd) {
        this.syncInputFromUrl(evt.urlAfterRedirects);
      }
    });
    this.syncInputFromUrl(this.router.url);

    // Actualizar estado si vuelve la conexión mientras el dropdown está abierto
    this.connectivitySub = this.connectivityService.isOnline$.subscribe(
      (online) => {
        if (online && this.isOfflineState && this.searchQuery.trim().length >= 2) {
          this.retrySearch();
        }
      }
    );

    if (this.autoFocus) {
      setTimeout(() => {
        this.searchInput?.nativeElement?.focus();
      }, 60);
    }
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
    this.voiceStateSub?.unsubscribe();
    this.voiceTranscriptSub?.unsubscribe();
    this.routerSub?.unsubscribe();
    this.connectivitySub?.unsubscribe();
    this.voiceSearchService.stopListening(this.instanceId);
  }

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery = input.value;
    this.showDropdown = true;

    const trimmed = this.searchQuery.trim();
    if (trimmed.length === 0) {
      this.isLoading = false;
      this.resetResultData();
      this.recentSearches = this.searchService.getSearchHistory();
      this.rebuildNavigableItems();
      this.searchSubject.next('');
      return;
    }

    if (trimmed.length < 2) {
      this.isLoading = false;
      this.resetResultData();
      this.rebuildNavigableItems();
      this.searchSubject.next(trimmed);
      return;
    }

    this.isLoading = true;
    this.noResults = false;
    this.hasSearchError = false;
    this.searchSubject.next(this.searchQuery);
  }

  onSearchFocus(): void {
    this.recentSearches = this.searchService.getSearchHistory();
    this.showDropdown = true;
    this.rebuildNavigableItems();
    if (this.connectivityService.isOnline) {
      this.searchService.prefetchCategories();
    }
  }

  toggleVoiceSearch(event?: Event): void {
    event?.stopPropagation();
    if (!this.voiceSupported) {
      return;
    }
    this.showDropdown = true;
    this.voiceSearchService.toggleListening(this.instanceId);
  }

  stopVoiceSearch(event?: Event): void {
    event?.stopPropagation();
    this.voiceSearchService.stopListening(this.instanceId);
  }

  get isVoiceListening(): boolean {
    return (
      this.voiceState.status === 'LISTENING' ||
      this.voiceState.status === 'PROCESSING'
    );
  }

  get voiceButtonAriaLabel(): string {
    if (!this.voiceSupported) {
      return 'Tu navegador no admite búsqueda por voz. Puedes escribir tu búsqueda.';
    }
    if (this.isVoiceListening) {
      return 'Detener búsqueda por voz';
    }
    return 'Buscar por voz';
  }

  get activeDescendantId(): string | null {
    if (
      this.showDropdown &&
      this.selectedIndex >= 0 &&
      this.selectedIndex < this.navigableItems.length
    ) {
      return this.navigableItems[this.selectedIndex].id;
    }
    return null;
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardNavigation(event: KeyboardEvent): void {
    const isInputFocused =
      document.activeElement === this.searchInput?.nativeElement;

    if (!this.showDropdown && !isInputFocused) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        if (!this.showDropdown) {
          this.showDropdown = true;
          this.rebuildNavigableItems();
        }
        if (this.navigableItems.length > 0) {
          event.preventDefault();
          this.selectedIndex = Math.min(
            this.selectedIndex + 1,
            this.navigableItems.length - 1
          );
        }
        break;

      case 'ArrowUp':
        if (this.showDropdown && this.navigableItems.length > 0) {
          event.preventDefault();
          this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
        }
        break;

      case 'Enter':
        if (!isInputFocused && !this.showDropdown) {
          return;
        }
        event.preventDefault();
        if (
          this.showDropdown &&
          this.selectedIndex >= 0 &&
          this.selectedIndex < this.navigableItems.length
        ) {
          this.activateNavigableItem(this.navigableItems[this.selectedIndex]);
        } else if (this.searchQuery.trim().length >= 2) {
          this.viewAllResults();
        }
        break;

      case 'Escape':
        if (this.isVoiceListening) {
          event.preventDefault();
          this.stopVoiceSearch();
        } else if (this.showDropdown) {
          event.preventDefault();
          this.closeDropdown();
          this.searchInput?.nativeElement?.blur();
        }
        break;

      case 'Tab':
        if (this.showDropdown) {
          this.closeDropdown();
        }
        break;
    }
  }

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.closeDropdown();
    }
  }

  activateNavigableItem(item: NavigableSearchItem): void {
    switch (item.type) {
      case 'history':
      case 'suggestion':
        if (item.query) {
          this.selectQuickQuery(item.query);
        }
        break;
      case 'product':
        if (item.product) {
          this.selectProduct(item.product);
        }
        break;
      case 'category':
        if (item.category) {
          this.selectCategory(item.category);
        }
        break;
      case 'brand':
        if (item.brand) {
          this.selectBrand(item.brand);
        }
        break;
      case 'view-all':
        this.viewAllResults();
        break;
    }
  }

  selectProduct(product: PublicProduct): void {
    const cleanQuery = this.searchService.sanitizeSearchQuery(this.searchQuery);
    if (cleanQuery.length >= 2) {
      this.searchService.saveToSearchHistory(cleanQuery);
    }
    this.closeDropdown();
    this.searchExecuted.emit();
    this.router.navigate(['/producto', product.id]);
  }

  selectCategory(category: PublicCategory): void {
    this.cancelPendingSearch();
    this.closeDropdown();
    this.searchQuery = '';
    this.searchExecuted.emit();
    this.catalogNav.filterBy({ categoryId: category.id });
  }

  selectBrand(brand: SearchBrandMatch): void {
    this.cancelPendingSearch();
    this.closeDropdown();
    this.searchQuery = '';
    this.searchExecuted.emit();
    this.catalogNav.filterBy({ brandId: brand.id });
  }

  selectRecentSearch(query: string): void {
    this.selectQuickQuery(query);
  }

  /**
   * Sugerencia rápida / búsqueda reciente: comando de navegación inmediato.
   * El input se actualiza y se navega en el mismo clic (no se espera autocompletado).
   */
  selectQuickQuery(query: string): void {
    this.executeSearch(query);
  }

  removeRecentSearch(term: string, event: MouseEvent): void {
    event.stopPropagation();
    this.searchService.removeFromSearchHistory(term);
    this.recentSearches = this.searchService.getSearchHistory();
    this.rebuildNavigableItems();
  }

  clearHistory(event: MouseEvent): void {
    event.stopPropagation();
    this.searchService.clearSearchHistory();
    this.recentSearches = [];
    this.rebuildNavigableItems();
  }

  viewAllResults(): void {
    this.executeSearch(this.searchQuery);
  }

  /**
   * Flujo ÚNICO de búsqueda (Enter, CTA, sugerencias rápidas, historial y voz):
   * actualiza el input, cierra el panel y navega de inmediato a /catalogo?search=...
   * No espera autocompletado, categorías, marcas ni fallbacks.
   */
  private executeSearch(rawTerm: string): void {
    const clean = this.searchService.sanitizeSearchQuery(rawTerm);
    if (clean.length < 2) {
      return;
    }
    this.cancelPendingSearch();
    this.searchQuery = clean;
    this.searchSubject.next('');
    this.searchService.saveToSearchHistory(clean);
    this.recentSearches = this.searchService.getSearchHistory();
    this.closeDropdown();
    this.searchExecuted.emit();
    this.catalogNav.search(clean);
  }

  retrySearch(): void {
    const trimmed = this.searchQuery.trim();
    if (trimmed.length < 2) return;
    this.isLoading = true;
    this.isOfflineState = false;
    this.isServerUnavailable = false;
    this.hasSearchError = false;
    this.searchService.searchProducts(trimmed).subscribe((result) => {
      this.isLoading = false;
      this.isOfflineState = !!result.offline;
      this.isServerUnavailable = !!result.serverUnavailable;
      this.suggestedTerm = result.suggestedTerm || null;
      this.searchResults = (result.products || []).slice(
        0,
        this.MAX_PRODUCTS_DISPLAYED
      );
      this.categoryMatches = result.categories || [];
      this.brandMatches = result.brands || [];
      this.totalResults = result.totalResults || 0;
      const hasAnyMatch =
        this.searchResults.length > 0 ||
        this.categoryMatches.length > 0 ||
        this.brandMatches.length > 0;
      this.noResults =
        !hasAnyMatch && !this.isOfflineState && !this.isServerUnavailable;
      this.rebuildNavigableItems();
    });
  }

  /** X del buscador: limpia solo el término; si estamos en /catalogo quita `search` de la URL. */
  clearSearch(): void {
    this.cancelPendingSearch();
    this.searchQuery = '';
    this.resetResultData();
    this.recentSearches = this.searchService.getSearchHistory();
    this.rebuildNavigableItems();
    this.searchSubject.next('');
    if (this.catalogNav.isOnCatalog() && this.catalogNav.hasSearchInUrl()) {
      this.catalogNav.clearSearch();
    }
    this.searchInput?.nativeElement?.focus();
  }

  /** Cancela cualquier petición de autocompletado en vuelo. */
  private cancelPendingSearch(): void {
    this.cancelSearch$.next();
    this.isLoading = false;
  }

  /**
   * Refleja en el input el término `search` de /catalogo (o lo limpia si ya no existe).
   * Fuera de /catalogo no se toca lo que el usuario esté escribiendo.
   */
  private syncInputFromUrl(url: string): void {
    if (!this.catalogNav.isOnCatalog(url)) {
      return;
    }
    const fromUrl = this.catalogNav.getSearchFromUrl(url);
    if (fromUrl !== this.searchQuery) {
      this.cancelPendingSearch();
      this.searchQuery = fromUrl;
      this.resetResultData();
      this.rebuildNavigableItems();
    }
  }

  closeDropdown(): void {
    this.showDropdown = false;
    this.selectedIndex = -1;
    if (this.isVoiceListening) {
      this.voiceSearchService.stopListening(this.instanceId);
    }
  }

  private resetResultData(): void {
    this.searchResults = [];
    this.categoryMatches = [];
    this.brandMatches = [];
    this.noResults = false;
    this.isOfflineState = false;
    this.isServerUnavailable = false;
    this.hasSearchError = false;
    this.totalResults = 0;
    this.suggestedTerm = null;
    this.selectedIndex = -1;
  }

  private rebuildNavigableItems(): void {
    const items: NavigableSearchItem[] = [];
    const trimmed = this.searchQuery.trim();

    if (trimmed.length < 2) {
      if (this.recentSearches.length > 0) {
        this.recentSearches.forEach((term, idx) => {
          items.push({
            type: 'history',
            id: `${this.instanceId}-opt-hist-${idx}`,
            label: term,
            query: term,
          });
        });
      } else {
        this.popularSuggestions.forEach((term, idx) => {
          items.push({
            type: 'suggestion',
            id: `${this.instanceId}-opt-sug-${idx}`,
            label: term,
            query: term,
          });
        });
      }
      this.navigableItems = items;
      return;
    }

    this.searchResults.forEach((prod, idx) => {
      items.push({
        type: 'product',
        id: `${this.instanceId}-opt-prod-${idx}`,
        label: prod.name,
        product: prod,
      });
    });

    this.categoryMatches.forEach((cat, idx) => {
      items.push({
        type: 'category',
        id: `${this.instanceId}-opt-cat-${idx}`,
        label: cat.name,
        category: cat,
      });
    });

    this.brandMatches.forEach((brand, idx) => {
      items.push({
        type: 'brand',
        id: `${this.instanceId}-opt-brand-${idx}`,
        label: brand.name,
        brand,
      });
    });

    if (items.length > 0) {
      items.push({
        type: 'view-all',
        id: `${this.instanceId}-opt-view-all`,
        label: `Ver todos los resultados para ${trimmed}`,
        query: trimmed,
      });
    }

    this.navigableItems = items;
  }

  isOptionSelected(optionId: string): boolean {
    return this.activeDescendantId === optionId;
  }

  setHoveredOption(optionId: string): void {
    const idx = this.navigableItems.findIndex((i) => i.id === optionId);
    if (idx !== -1) {
      this.selectedIndex = idx;
    }
  }

  getProductOptionId(index: number): string {
    return `${this.instanceId}-opt-prod-${index}`;
  }

  getCategoryOptionId(index: number): string {
    return `${this.instanceId}-opt-cat-${index}`;
  }

  getBrandOptionId(index: number): string {
    return `${this.instanceId}-opt-brand-${index}`;
  }

  getHistoryOptionId(index: number): string {
    return `${this.instanceId}-opt-hist-${index}`;
  }

  getSuggestionOptionId(index: number): string {
    return `${this.instanceId}-opt-sug-${index}`;
  }

  get viewAllOptionId(): string {
    return `${this.instanceId}-opt-view-all`;
  }

  /**
   * Divide el texto en segmentos seguros (sin usar innerHTML) resaltando coincidencias
   * de forma insensible a acentos y mayúsculas para múltiples palabras.
   */
  getHighlightedParts(
    text: string,
    query: string
  ): { text: string; isMatch: boolean }[] {
    if (!text) return [];
    const analyzed = this.searchService.analyzeQuery(query);
    const tokens =
      analyzed.tokens.length > 0
        ? analyzed.tokens
        : [analyzed.normalizedOriginal].filter((Boolean as any));

    if (tokens.length === 0) {
      return [{ text, isMatch: false }];
    }

    // Construimos mapa carácter por carácter sin acentos
    const normChars: string[] = [];
    const origIndices: number[] = [];

    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      for (let c = 0; c < ch.length; c++) {
        normChars.push(ch[c]);
        origIndices.push(i);
      }
    }

    const normText = normChars.join('');
    const matchedOrigFlags = new Array<boolean>(text.length).fill(false);

    for (const token of tokens) {
      if (!token || token.length < 2) continue;
      let startIdx = 0;
      while (startIdx < normText.length) {
        const found = normText.indexOf(token, startIdx);
        if (found === -1) break;
        for (let k = found; k < found + token.length; k++) {
          const origIdx = origIndices[k];
          if (origIdx !== undefined) {
            matchedOrigFlags[origIdx] = true;
          }
        }
        startIdx = found + token.length;
      }
    }

    const parts: { text: string; isMatch: boolean }[] = [];
    let currentPos = 0;
    while (currentPos < text.length) {
      const flag = matchedOrigFlags[currentPos];
      let endPos = currentPos + 1;
      while (endPos < text.length && matchedOrigFlags[endPos] === flag) {
        endPos++;
      }
      parts.push({
        text: text.substring(currentPos, endPos),
        isMatch: flag,
      });
      currentPos = endPos;
    }

    return parts;
  }

  getDisplayPrice(product: PublicProduct): number {
    return product.discountPrice || product.price;
  }

  hasDiscount(product: PublicProduct): boolean {
    return !!(
      product.discountPrice && product.discountPrice < product.price
    );
  }

  onProductImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img && !img.src.includes('placeholder-instrument.svg')) {
      img.src =
        "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'><path d='M9 18V5l12-2v13'/><circle cx='6' cy='18' r='3'/><circle cx='18' cy='16' r='3'/></svg>";
    }
  }
}
