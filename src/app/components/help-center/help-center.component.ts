import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HelpCenterService } from '../../services/help-center.service';
import { HelpCategory, Faq } from '../../models/help-center.model';
import { ConnectivityService } from '../../services/connectivity.service';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-help-center',
  standalone: true,
  imports: [FormsModule, RouterModule],
  templateUrl: './help-center.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./help-center.component.css']
})
export class HelpCenterComponent implements OnInit, OnDestroy {
  searchQuery = '';
  selectedCategory: string = 'all';
  
  categories: HelpCategory[] = [];
  allFaqs: (Faq & { isOpen?: boolean })[] = [];
  faqs: (Faq & { isOpen?: boolean })[] = [];
  
  isLoadingCategories = true;
  isLoadingFaqs = true;
  isSearching = false;
  faqsError = false;

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private helpCenterService: HelpCenterService,
    public connectivityService: ConnectivityService
  ) {}

  get isOnline(): boolean {
    return this.connectivityService.isOnline;
  }

  ngOnInit(): void {
    this.loadCategories();
    this.loadFaqs();

    // Configurar búsqueda con debounce (evitar llamadas múltiples al backend)
    this.searchSubject.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(query => {
      this.executeSearch(query);
    });

    // Recargar automáticamente al restablecer la conexión si había error previo
    this.connectivityService.isOnline$.pipe(
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(online => {
      if (online) {
        if (this.faqsError || this.allFaqs.length === 0) {
          this.loadFaqs();
        }
        if (this.categories.length === 0) {
          this.loadCategories();
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  retryLoad(): void {
    this.loadCategories();
    this.loadFaqs();
  }

  loadCategories(): void {
    this.isLoadingCategories = true;
    this.helpCenterService.getPublicCategories().pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.categories = data;
        this.isLoadingCategories = false;
      },
      error: () => {
        this.isLoadingCategories = false;
      }
    });
  }

  loadFaqs(): void {
    this.isLoadingFaqs = true;
    this.faqsError = false;
    this.helpCenterService.getPublicFaqs().pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.allFaqs = data.map((faq, idx) => ({ ...faq, isOpen: idx === 0 }));
        this.faqs = [...this.allFaqs];
        this.isLoadingFaqs = false;
        this.faqsError = false;
      },
      error: () => {
        this.isLoadingFaqs = false;
        this.faqsError = this.allFaqs.length === 0;
      }
    });
  }

  onSearchChange(): void {
    this.searchSubject.next(this.searchQuery);
  }

  executeSearch(query: string): void {
    const trimmed = (query || '').trim();
    if (trimmed.length < 2) {
      if (this.isSearching) {
        this.isSearching = false;
        this.faqs = [...this.allFaqs];
      }
      return;
    }

    this.isSearching = true;

    // Si estamos sin conexión y tenemos FAQs en memoria/caché, filtramos localmente sin fallar
    if (!this.isOnline && this.allFaqs.length > 0) {
      this.filterLocalFaqs(trimmed);
      return;
    }
    
    this.isLoadingFaqs = true;
    this.helpCenterService.searchFaqs(trimmed).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.faqs = data.map((faq, idx) => ({ ...faq, isOpen: idx === 0 }));
        this.isLoadingFaqs = false;
        this.selectedCategory = 'all';
      },
      error: () => {
        this.isLoadingFaqs = false;
        if (this.allFaqs.length > 0) {
          this.filterLocalFaqs(trimmed);
        }
      }
    });
  }

  private filterLocalFaqs(trimmedQuery: string): void {
    const lower = trimmedQuery.toLowerCase();
    this.faqs = this.allFaqs
      .filter(f =>
        f.question.toLowerCase().includes(lower) ||
        f.answer.toLowerCase().includes(lower) ||
        (f.categoryName && f.categoryName.toLowerCase().includes(lower))
      )
      .map((faq, idx) => ({ ...faq, isOpen: idx === 0 }));
    this.selectedCategory = 'all';
  }

  get filteredFAQs(): (Faq & { isOpen?: boolean })[] {
    if (this.isSearching) {
      return this.faqs;
    }
    
    if (this.selectedCategory !== 'all') {
      return this.faqs.filter(faq => faq.categoryName === this.selectedCategory || faq.categoryId.toString() === this.selectedCategory);
    }
    
    return this.faqs;
  }

  selectCategory(categoryId: string | number): void {
    this.selectedCategory = categoryId.toString();
    this.searchQuery = '';
    if (this.isSearching) {
      this.isSearching = false;
      this.faqs = [...this.allFaqs];
    }
  }

  getCategoryNameSafe(categoryId: string): string {
    const cat = this.categories.find(c => c.id.toString() === categoryId);
    return cat ? cat.name : 'Categoría';
  }

  /**
   * Renderizado seguro para <mark> sin innerHTML
   */
  getHighlightedParts(text: string, search: string): { text: string, isMatch: boolean }[] {
    if (!text) return [];
    if (!search || search.trim().length === 0) return [{ text, isMatch: false }];

    const result: { text: string, isMatch: boolean }[] = [];
    const lowerText = text.toLowerCase();
    const lowerSearch = search.toLowerCase();
    
    let currentIndex = 0;
    let matchIndex = lowerText.indexOf(lowerSearch, currentIndex);

    while (matchIndex !== -1) {
      if (matchIndex > currentIndex) {
        result.push({ text: text.substring(currentIndex, matchIndex), isMatch: false });
      }
      result.push({ text: text.substring(matchIndex, matchIndex + search.length), isMatch: true });
      currentIndex = matchIndex + search.length;
      matchIndex = lowerText.indexOf(lowerSearch, currentIndex);
    }

    if (currentIndex < text.length) {
      result.push({ text: text.substring(currentIndex), isMatch: false });
    }

    return result;
  }

  toggleFAQ(faq: Faq & { isOpen?: boolean }): void {
    faq.isOpen = !faq.isOpen;
  }

  contactSupport(): void {
    Swal.fire({
      title: 'Casa de Música Castillo',
      html: `
        <div style="text-align: left; font-size: 0.95rem; line-height: 1.6; color: #333;">
          <p style="margin-bottom: 10px;"><strong>Sucursal física:</strong><br>C. Morelos 18, Col. Centro, C.P. 43000, Huejutla de Reyes, Hidalgo.</p>
          <p style="margin-bottom: 0;">También puedes consultar el estado de tus compras en la sección <strong>Mis Pedidos</strong> o revisar nuestras guías de Envíos y Formas de Pago.</p>
        </div>
      `,
      icon: 'info',
      confirmButtonColor: '#722F37',
      confirmButtonText: 'Entendido'
    });
  }

  navigateToHome(): void {
    this.router.navigate(['/']);
  }

  isLegacyIcon(iconKey: string | undefined): boolean {
    if (!iconKey) return true;
    return !iconKey.includes(':') || iconKey.startsWith('material-symbols:');
  }

  getBaseName(iconKey: string | undefined): string {
    if (!iconKey) return '';
    return iconKey.includes(':') ? iconKey.split(':')[1] : iconKey;
  }

  getPreviewUrl(iconKey: string | undefined): string {
    if (!iconKey) return '';
    if (!iconKey.includes(':')) {
      return `https://api.iconify.design/material-symbols/${iconKey}.svg`;
    }
    const [prefix, name] = iconKey.split(':');
    return `https://api.iconify.design/${prefix}/${name}.svg`;
  }
}

