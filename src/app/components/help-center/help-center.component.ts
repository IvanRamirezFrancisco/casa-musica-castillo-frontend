import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HelpCenterService } from '../../services/help-center.service';
import { HelpCategory, Faq } from '../../models/help-center.model';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-help-center',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './help-center.component.html',
  styleUrls: ['./help-center.component.css']
})
export class HelpCenterComponent implements OnInit {
  searchQuery = '';
  selectedCategory: string = 'all';
  
  categories: HelpCategory[] = [];
  faqs: (Faq & { isOpen?: boolean })[] = [];
  
  isLoadingCategories = true;
  isLoadingFaqs = true;
  isSearching = false;

  private searchSubject = new Subject<string>();

  constructor(
    private router: Router,
    private helpCenterService: HelpCenterService
  ) {}

  ngOnInit(): void {
    this.loadCategories();
    this.loadFaqs();

    // Configurar búsqueda con debounce (evitar llamadas múltiples al backend)
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(query => {
      this.executeSearch(query);
    });
  }

  loadCategories(): void {
    this.isLoadingCategories = true;
    this.helpCenterService.getPublicCategories().subscribe({
      next: (data) => {
        this.categories = data;
        this.isLoadingCategories = false;
      },
      error: (err) => {
        console.error('Error al cargar categorías', err);
        this.isLoadingCategories = false;
      }
    });
  }

  loadFaqs(): void {
    this.isLoadingFaqs = true;
    this.helpCenterService.getPublicFaqs().subscribe({
      next: (data) => {
        this.faqs = data.map(faq => ({ ...faq, isOpen: false }));
        this.isLoadingFaqs = false;
      },
      error: (err) => {
        console.error('Error al cargar FAQs', err);
        this.isLoadingFaqs = false;
      }
    });
  }

  onSearchChange(): void {
    this.searchSubject.next(this.searchQuery);
  }

  executeSearch(query: string): void {
    if (!query || query.trim().length < 2) {
      if (this.isSearching) {
        this.isSearching = false;
        this.loadFaqs(); // Restaurar todo
      }
      return;
    }
    
    this.isSearching = true;
    this.isLoadingFaqs = true;
    this.helpCenterService.searchFaqs(query).subscribe({
      next: (data) => {
        this.faqs = data.map(faq => ({ ...faq, isOpen: false }));
        this.isLoadingFaqs = false;
        this.selectedCategory = 'all'; // Resetear categoría al buscar
      },
      error: (err) => {
        console.error('Error al buscar FAQs', err);
        this.isLoadingFaqs = false;
      }
    });
  }

  get filteredFAQs(): (Faq & { isOpen?: boolean })[] {
    if (this.isSearching) {
      return this.faqs; // Ya filtrados por el backend
    }
    
    // Filtrar localmente por categoría
    if (this.selectedCategory !== 'all') {
      return this.faqs.filter(faq => faq.categoryName === this.selectedCategory || faq.categoryId.toString() === this.selectedCategory);
    }
    
    return this.faqs;
  }

  selectCategory(categoryId: string | number): void {
    this.selectedCategory = categoryId.toString();
    this.searchQuery = ''; // Limpiar búsqueda al cambiar categoría
    if (this.isSearching) {
      this.isSearching = false;
      this.loadFaqs();
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
      // Texto antes del match
      if (matchIndex > currentIndex) {
        result.push({ text: text.substring(currentIndex, matchIndex), isMatch: false });
      }
      
      // El match
      result.push({ text: text.substring(matchIndex, matchIndex + search.length), isMatch: true });
      
      currentIndex = matchIndex + search.length;
      matchIndex = lowerText.indexOf(lowerSearch, currentIndex);
    }

    // Texto después del último match
    if (currentIndex < text.length) {
      result.push({ text: text.substring(currentIndex), isMatch: false });
    }

    return result;
  }

  toggleFAQ(faq: Faq & { isOpen?: boolean }): void {
    faq.isOpen = !faq.isOpen;
  }

  contactSupport(): void {
    alert('Información de contacto:\n\nEmail: contacto@casademusicacastillo.com\nTeléfono: (55) 1234-5678');
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
