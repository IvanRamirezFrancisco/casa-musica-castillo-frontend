import { Component, OnInit, OnDestroy, ElementRef, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil, switchMap, finalize } from 'rxjs';
import { SearchService, SearchResult } from '../../services/search.service';
import { PublicProduct } from '../../models/product.model';
import { EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-global-search',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './global-search.component.html',
  styleUrls: ['./global-search.component.css']
})
export class GlobalSearchComponent implements OnInit, OnDestroy {
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  
  searchQuery = '';
  showDropdown = false;
  isSearching = false;
  searchResults: PublicProduct[] = [];
  searchSuggestions: string[] = [];
  totalResults = 0;
  executionTime = 0;
  
  // Teclado interactivo
  activeIndex = -1;
  @Output() searchActiveChange = new EventEmitter<boolean>();
  
  // Subject para implementar debounce
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();
  
  // Estados
  hasSearched = false;
  noResults = false;

  constructor(
    private searchService: SearchService,
    private router: Router,
    private elementRef: ElementRef
  ) {}

  ngOnInit(): void {
    // Configurar búsqueda con debounce
    this.searchSubject.pipe(
      debounceTime(400), // Esperar 400ms después de que el usuario deje de escribir
      distinctUntilChanged(), // Solo buscar si el texto cambió
      takeUntil(this.destroy$),
      switchMap(query => {
        if (query.trim().length >= 2) {
          this.isSearching = true;
          return this.searchService.search(query);
        } else {
          this.isSearching = false;
          this.searchResults = [];
          this.showDropdown = false;
          return [];
        }
      })
    ).subscribe({
      next: (result: SearchResult | any[]) => {
        this.isSearching = false;
        this.hasSearched = true;
        
        if (Array.isArray(result)) {
          // Caso cuando devuelve array vacío
          this.searchResults = [];
          this.totalResults = 0;
          this.noResults = true;
        } else {
          // Caso cuando devuelve SearchResult
          this.searchResults = result.products;
          this.totalResults = result.totalResults;
          this.executionTime = result.executionTime;
          this.noResults = this.searchResults.length === 0;
        }
        
        this.showDropdown = this.hasSearched;
      },
      error: (err) => {
        this.isSearching = false;
        this.searchResults = [];
        this.noResults = true;
        this.showDropdown = true;
      }
    });

    // Cargar sugerencias cuando el input recibe foco
    this.loadSearchSuggestions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Método llamado cuando el usuario escribe
  onSearchInput(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    this.searchQuery = query;
    this.searchSubject.next(query);
    this.activeIndex = -1; // reset selection on new search
    
    // Si el query está vacío, ocultar dropdown (o mostrar historial)
    if (query.trim().length === 0) {
      this.hasSearched = false;
      this.isSearching = false;
      this.searchResults = [];
      if (this.searchSuggestions.length > 0) {
        this.showDropdown = true;
      } else {
        this.showDropdown = false;
        this.notifySearchActive();
      }
    }
  }

  // Cargar sugerencias de búsqueda
  loadSearchSuggestions(): void {
    this.searchService.getSearchHistory().pipe(
      takeUntil(this.destroy$)
    ).subscribe(history => {
      this.searchSuggestions = history;
    });
  }

  // Seleccionar una sugerencia
  selectSuggestion(suggestion: string): void {
    this.searchQuery = suggestion;
    this.searchSubject.next(suggestion);
  }

  // Navegar a detalle de producto
  viewProductDetail(product: PublicProduct): void {
    this.closeDropdown();
    this.router.navigate(['/producto', product.id]);
  }

  // Ver todos los resultados
  viewAllResults(): void {
    if (this.searchQuery.trim()) {
      this.closeDropdown();
      this.router.navigate(['/catalogo'], {
        queryParams: { busqueda: this.searchQuery }
      });
    }
  }

  // Cerrar dropdown
  closeDropdown(): void {
    this.showDropdown = false;
    this.activeIndex = -1;
    this.notifySearchActive();
  }

  // Abrir dropdown
  openDropdown(): void {
    if (this.hasSearched || this.searchSuggestions.length > 0) {
      this.showDropdown = true;
      this.notifySearchActive();
    }
  }
  
  // Notificar estado al padre (header) para bloqueo de scroll
  notifySearchActive(): void {
    this.searchActiveChange.emit(this.showDropdown || document.activeElement === this.searchInput?.nativeElement);
  }

  // Limpiar búsqueda
  clearSearch(): void {
    this.searchQuery = '';
    this.searchResults = [];
    this.showDropdown = false;
    this.hasSearched = false;
    this.noResults = false;
    this.searchInput?.nativeElement.focus();
  }

  // Detectar clic fuera del componente
  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.closeDropdown();
    }
  }

  // Manejar teclado ARIA Combobox
  onKeyDown(event: KeyboardEvent): void {
    // Si está cerrado pero se interactúa
    if (!this.showDropdown && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      this.openDropdown();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const maxIndex = this.hasSearched ? this.searchResults.slice(0, 5).length - 1 : this.searchSuggestions.length - 1;
      if (this.activeIndex < maxIndex) {
        this.activeIndex++;
        this.scrollActiveOptionIntoView();
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.activeIndex > 0) {
        this.activeIndex--;
        this.scrollActiveOptionIntoView();
      } else if (this.activeIndex === 0) {
        this.activeIndex = -1; // Regresar foco real al input
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.activeIndex >= 0 && this.showDropdown) {
        // Opción activa seleccionada
        if (this.hasSearched && this.searchResults.length > 0) {
          this.viewProductDetail(this.searchResults[this.activeIndex]);
        } else if (!this.hasSearched && this.searchSuggestions.length > 0) {
          this.selectSuggestion(this.searchSuggestions[this.activeIndex]);
        }
      } else if (this.searchQuery.trim()) {
        // Enter genérico
        this.viewAllResults();
      }
    } else if (event.key === 'Escape') {
      this.closeDropdown();
      // Devolver foco al input o quitarlo
      this.searchInput?.nativeElement.blur();
    } else if (event.key === 'Tab') {
      this.closeDropdown();
    }
  }

  // Desplazar el elemento seleccionado para mantenerlo visible
  private scrollActiveOptionIntoView(): void {
    // Retraso nulo para esperar que Angular dibuje el active
    setTimeout(() => {
      const activeEl = document.querySelector('.search-dropdown .active-option') as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      }
    });
  }

  // Sanitización de Regex segura
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Devolver fragmentos seguros en lugar de HTML
  getHighlightedParts(text: string): { text: string, isMatch: boolean }[] {
    if (!this.searchQuery.trim() || !text) return [{ text, isMatch: false }];
    
    const query = this.searchQuery.trim();
    const escapedQuery = this.escapeRegex(query);
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    
    const parts = text.split(regex);
    return parts.map(part => ({
      text: part,
      isMatch: part.toLowerCase() === query.toLowerCase()
    })).filter(part => part.text.length > 0);
  }
}
