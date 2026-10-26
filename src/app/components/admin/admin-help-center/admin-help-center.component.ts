import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { HelpCenterService } from '../../../services/help-center.service';
import { HelpCategory, Faq } from '../../../models/help-center.model';
import Swal from 'sweetalert2';
import { Subject, of, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, map } from 'rxjs/operators';

interface IconSearchResult {
  icons: string[];
}

interface IconOption {
  id: string;
  prefix: string;
  name: string;
  displayName: string;
  previewUrl: string;
  source: string;
}

@Component({
  selector: 'app-admin-help-center',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-help-center.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./admin-help-center.component.css']
})
export class AdminHelpCenterComponent implements OnInit, OnDestroy {
  activeTab: 'categories' | 'faqs' = 'categories';
  
  categories: HelpCategory[] = [];
  faqs: Faq[] = [];
  
  isLoading = false;
  
  // Modals state
  showCategoryModal = false;
  showFaqModal = false;
  
  // Form objects
  currentCategory: Partial<HelpCategory> = {};
  originalCategory: Partial<HelpCategory> = {};
  currentFaq: Partial<Faq> = {};
  originalFaq: Partial<Faq> = {};
  isEditing = false;
  
  // Icon Picker State
  iconSearchQuery = '';
  isSearchingIcons = false;
  iconSearchResults: IconOption[] = [];
  iconSearchError = false;
  iconSearchNetworkError = false;
  iconSelectionTouched = false;
  visibleResultsCount = 24;
  
  private iconSearchCache = new Map<string, IconOption[]>();
  private iconSearchSubject = new Subject<string>();
  private categoryNameSubject = new Subject<string>();
  private subscriptions = new Subscription();

  // Fallback icon list if Iconify fails
  private fallbackIcons: IconOption[] = [
    'help', 'home', 'person', 'security', 'shopping_cart', 
    'receipt_long', 'payments', 'store', 'inventory_2', 
    'local_shipping', 'headphones', 'music_note', 'info', 'settings'
  ].map(name => this.buildIconOption(name, 'fallback'));

  constructor(
    private helpCenterService: HelpCenterService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadCategories();
    this.loadFaqs();
    
    // Icon Search (Manual)
    this.subscriptions.add(
      this.iconSearchSubject.pipe(
        debounceTime(350),
        distinctUntilChanged(),
        switchMap(query => {
          if (!query || query.trim().length < 2) {
            return of(null);
          }
          this.isSearchingIcons = true;
          this.iconSearchError = false;
          this.iconSearchNetworkError = false;
          return this.searchIconify(query);
        })
      ).subscribe(result => {
        this.isSearchingIcons = false;
        this.visibleResultsCount = 24;
        if (result) {
          this.iconSearchResults = result.icons || [];
          this.iconSearchNetworkError = result.networkError || false;
        } else {
          this.iconSearchResults = [];
        }
      })
    );

    // Auto-suggest por Nombre de Categoría
    this.subscriptions.add(
      this.categoryNameSubject.pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap(name => {
          if (!name || name.trim().length < 3 || this.iconSelectionTouched) {
            return of(null);
          }
          this.isSearchingIcons = true;
          this.iconSearchError = false;
          this.iconSearchNetworkError = false;
          return this.searchIconify(name);
        })
      ).subscribe(result => {
        this.isSearchingIcons = false;
        if (result && !this.iconSelectionTouched) {
          this.visibleResultsCount = 24;
          this.iconSearchResults = result.icons || [];
          this.iconSearchNetworkError = result.networkError || false;
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.unlockBodyScroll();
  }

  setTab(tab: 'categories' | 'faqs'): void {
    this.activeTab = tab;
  }

  // ------------------------------------------------------------------
  // UTILS
  // ------------------------------------------------------------------
  lockBodyScroll(): void {
    document.body.style.overflow = 'hidden';
  }

  unlockBodyScroll(): void {
    document.body.style.overflow = '';
  }

  // --- Categories ---
  
  loadCategories(): void {
    this.isLoading = true;
    this.helpCenterService.getAdminCategories().subscribe({
      next: (data) => {
        this.categories = data;
        this.isLoading = false;
      },
      error: (err) => {
        Swal.fire('Error', 'Error al cargar categorías', 'error');
        this.isLoading = false;
      }
    });
  }

  openCategoryModal(category?: HelpCategory): void {
    this.resetIconPicker();
    if (category) {
      this.isEditing = true;
      this.currentCategory = { ...category };
      this.originalCategory = { ...category };
      this.iconSelectionTouched = true;
    } else {
      this.isEditing = false;
      this.currentCategory = {
        name: '',
        description: '',
        iconKey: 'label',
        displayOrder: 0,
        active: true
      };
      this.originalCategory = { ...this.currentCategory };
      this.iconSelectionTouched = false;
    }
    this.showCategoryModal = true;
    this.lockBodyScroll();
  }

  onCreateCategoryBackdropClick(): void {
    if (this.isLoading) return;
    this.requestCloseCategoryModal();
  }

  isCategoryDirty(): boolean {
    return JSON.stringify(this.currentCategory) !== JSON.stringify(this.originalCategory);
  }

  requestCloseCategoryModal(): void {
    if (this.isCategoryDirty()) {
      // Evitar doble alerta si ya hay una abierta (Swal)
      if (Swal.isVisible()) return;
      Swal.fire({
        title: '¿Descartar los cambios?',
        text: 'Tienes información sin guardar.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Descartar cambios',
        cancelButtonText: 'Seguir editando'
      }).then((result) => {
        if (result.isConfirmed) {
          this.forceCloseCategoryModal();
        }
      });
    } else {
      this.forceCloseCategoryModal();
    }
  }

  forceCloseCategoryModal(): void {
    this.showCategoryModal = false;
    this.currentCategory = {};
    this.originalCategory = {};
    this.unlockBodyScroll();
    this.isLoading = false;
  }

  saveCategory(): void {
    if (!this.currentCategory.name) {
      Swal.fire('Atención', 'El nombre es requerido', 'warning');
      return;
    }
    
    // Sanitize icon string - allow colon para prefix:name
    if (this.currentCategory.iconKey) {
      this.currentCategory.iconKey = this.currentCategory.iconKey.trim().toLowerCase().replace(/[^a-z0-9_:-]/g, '');
    }
    
    this.isLoading = true;
    if (this.isEditing && this.currentCategory.id) {
      this.helpCenterService.updateCategory(this.currentCategory.id, this.currentCategory).subscribe({
        next: () => {
          Swal.fire('¡Éxito!', 'Categoría actualizada exitosamente', 'success');
          this.forceCloseCategoryModal();
          this.loadCategories();
        },
        error: (err) => {
          Swal.fire('Error', 'Error al actualizar categoría', 'error');
          this.isLoading = false;
        }
      });
    } else {
      this.helpCenterService.createCategory(this.currentCategory).subscribe({
        next: () => {
          Swal.fire('¡Éxito!', 'Categoría creada exitosamente', 'success');
          this.forceCloseCategoryModal();
          this.loadCategories();
        },
        error: (err) => {
          Swal.fire('Error', 'Error al crear categoría', 'error');
          this.isLoading = false;
        }
      });
    }
  }

  deleteCategory(id: number): void {
    Swal.fire({
      title: '¿Eliminar categoría?',
      text: 'Solo es posible si no tiene preguntas asociadas.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.isLoading = true;
        this.helpCenterService.deleteCategory(id).subscribe({
          next: () => {
            Swal.fire('¡Eliminada!', 'Categoría eliminada', 'success');
            this.loadCategories();
          },
          error: (err) => {
            if (err.status === 409 || err.status === 400) {
              Swal.fire('No se puede eliminar', 'La categoría tiene preguntas asociadas', 'error');
            } else {
              Swal.fire('Error', 'Error al eliminar categoría', 'error');
            }
            this.isLoading = false;
          }
        });
      }
    });
  }

  // --- FAQs ---
  
  loadFaqs(): void {
    this.isLoading = true;
    this.helpCenterService.getAdminFaqs().subscribe({
      next: (data) => {
        this.faqs = data;
        this.isLoading = false;
      },
      error: (err) => {
        Swal.fire('Error', 'Error al cargar FAQs', 'error');
        this.isLoading = false;
      }
    });
  }

  openFaqModal(faq?: Faq): void {
    if (faq) {
      this.isEditing = true;
      this.currentFaq = { ...faq };
      this.originalFaq = { ...faq };
    } else {
      this.isEditing = false;
      this.currentFaq = {
        categoryId: this.categories.length > 0 ? this.categories[0].id : undefined,
        question: '',
        answer: '',
        displayOrder: 0,
        active: true,
        featured: false
      };
      this.originalFaq = { ...this.currentFaq };
    }
    this.showFaqModal = true;
    this.lockBodyScroll();
  }

  onCreateFaqBackdropClick(): void {
    if (this.isLoading) return;
    this.requestCloseFaqModal();
  }

  isFaqDirty(): boolean {
    return JSON.stringify(this.currentFaq) !== JSON.stringify(this.originalFaq);
  }

  requestCloseFaqModal(): void {
    if (this.isFaqDirty()) {
      if (Swal.isVisible()) return;
      Swal.fire({
        title: '¿Descartar los cambios?',
        text: 'Tienes información sin guardar.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Descartar cambios',
        cancelButtonText: 'Seguir editando'
      }).then((result) => {
        if (result.isConfirmed) {
          this.forceCloseFaqModal();
        }
      });
    } else {
      this.forceCloseFaqModal();
    }
  }

  forceCloseFaqModal(): void {
    this.showFaqModal = false;
    this.currentFaq = {};
    this.originalFaq = {};
    this.unlockBodyScroll();
    this.isLoading = false;
  }

  saveFaq(): void {
    if (!this.currentFaq.categoryId || !this.currentFaq.question || !this.currentFaq.answer) {
      Swal.fire('Atención', 'Por favor complete todos los campos requeridos', 'warning');
      return;
    }
    
    this.isLoading = true;
    if (this.isEditing && this.currentFaq.id) {
      this.helpCenterService.updateFaq(this.currentFaq.id, this.currentFaq).subscribe({
        next: () => {
          Swal.fire('¡Éxito!', 'Pregunta actualizada exitosamente', 'success');
          this.forceCloseFaqModal();
          this.loadFaqs();
        },
        error: (err) => {
          Swal.fire('Error', 'Error al actualizar pregunta', 'error');
          this.isLoading = false;
        }
      });
    } else {
      this.helpCenterService.createFaq(this.currentFaq).subscribe({
        next: () => {
          Swal.fire('¡Éxito!', 'Pregunta creada exitosamente', 'success');
          this.forceCloseFaqModal();
          this.loadFaqs();
        },
        error: (err) => {
          Swal.fire('Error', 'Error al crear pregunta', 'error');
          this.isLoading = false;
        }
      });
    }
  }

  deleteFaq(id: number): void {
    Swal.fire({
      title: '¿Eliminar pregunta?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.isLoading = true;
        this.helpCenterService.deleteFaq(id).subscribe({
          next: () => {
            Swal.fire('¡Eliminada!', 'Pregunta eliminada', 'success');
            this.loadFaqs();
          },
          error: (err) => {
            Swal.fire('Error', 'Error al eliminar pregunta', 'error');
            this.isLoading = false;
          }
        });
      }
    });
  }

  getCategoryName(categoryId: number | undefined): string {
    if (!categoryId) return '';
    const cat = this.categories.find(c => c.id === categoryId);
    return cat ? cat.name : 'Desconocida';
  }
  
  // --- Icon Picker Logic ---
  
  get visibleIcons(): IconOption[] {
    return this.iconSearchResults.slice(0, this.visibleResultsCount);
  }

  showMoreIcons(): void {
    this.visibleResultsCount += 24;
  }

  onCategoryNameChange(newName: string): void {
    this.currentCategory.name = newName;
    if (!this.iconSelectionTouched) {
      this.categoryNameSubject.next(newName);
    }
  }
  
  onIconSearchChange(query: string): void {
    this.iconSearchQuery = query;
    this.iconSearchSubject.next(query);
  }
  
  selectIcon(icon: string): void {
    this.currentCategory.iconKey = icon;
    this.iconSelectionTouched = true;
  }
  
  resetIconPicker(): void {
    this.iconSearchQuery = '';
    this.iconSearchResults = [];
    this.isSearchingIcons = false;
    this.iconSearchError = false;
    this.iconSearchNetworkError = false;
    this.iconSelectionTouched = false;
    this.visibleResultsCount = 24;
  }

  retryIconSearch(): void {
    if (this.iconSearchQuery) {
      this.iconSearchSubject.next(this.iconSearchQuery);
    }
  }

  onIconLoadError(icon: IconOption): void {
    // Retirar del array si falla carga (evita tile vacío)
    this.iconSearchResults = this.iconSearchResults.filter(i => i.id !== icon.id);
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

  getFriendlyIconName(icon: string): string {
    if (!icon) return '';
    return icon.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  private normalizeIconSearchTerm(term: string): string {
    return term.toLowerCase().trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Sin acentos
      .replace(/[^a-z0-9 ]/g, "") // Sin caracteres raros
      .replace(/\s+/g, ' '); // Un solo espacio
  }

  private aliases: Record<string, string[]> = {
    'telefono': ['phone', 'call', 'phone_in_talk', 'contact_phone', 'smartphone'],
    'celular': ['smartphone', 'phone', 'mobile'],
    'casa': ['home', 'house', 'cottage'],
    'cuenta': ['account_circle', 'person', 'manage_accounts', 'account_box', 'security'],
    'usuario': ['person', 'account_circle', 'group', 'face'],
    'persona': ['person', 'account_circle', 'face'],
    'seguridad': ['security', 'shield', 'lock', 'verified_user'],
    'carrito': ['shopping_cart', 'shopping_basket', 'add_shopping_cart'],
    'compras': ['shopping_cart', 'storefront', 'bag'],
    'pedido': ['receipt', 'receipt_long', 'inventory', 'package'],
    'pedidos': ['receipt', 'receipt_long', 'inventory', 'package'],
    'pago': ['payments', 'payment', 'credit_card', 'wallet'],
    'pagos': ['payments', 'payment', 'credit_card', 'wallet'],
    'transferencia': ['account_balance', 'sync_alt', 'payments', 'currency_exchange'],
    'envio': ['local_shipping', 'package', 'delivery'],
    'envios': ['local_shipping', 'package', 'delivery'],
    'entrega': ['local_shipping', 'package'],
    'tienda': ['store', 'storefront', 'shopping_bag'],
    'inventario': ['inventory', 'inventory_2', 'warehouse'],
    'producto': ['inventory_2', 'category', 'package'],
    'musica': ['music_note', 'library_music', 'headphones'],
    'sonido': ['audio', 'sound', 'equalizer', 'speaker', 'volume', 'graphic_eq', 'headphones'],
    'ayuda': ['help', 'help_center', 'contact_support', 'question_mark'],
    'instrumento': ['instrument', 'musical_instrument', 'music', 'guitar', 'piano', 'violin', 'microphone'],
    'instrumentos': ['instrument', 'musical_instrument', 'music', 'guitar', 'piano', 'violin', 'microphone'],
    'guitarra': ['guitar', 'acoustic_guitar', 'electric_guitar'],
    'jarana': ['guitar', 'acoustic_guitar', 'ukulele', 'string_instrument'],
    'violin': ['violin', 'fiddle', 'strings'],
    'piano': ['piano', 'keyboard', 'music_keyboard'],
    'teclado': ['keyboard', 'piano'],
    'bateria': ['drum', 'drums', 'drum_set', 'percussion'],
    'trompeta': ['trumpet', 'brass'],
    'saxofon': ['saxophone'],
    'flauta': ['flute', 'wind_instrument'],
    'acordeon': ['accordion'],
    'microfono': ['microphone', 'mic'],
    'bajo': ['bass_guitar', 'guitar', 'music'],
    'amplificador': ['amplifier', 'speaker', 'audio'],
    'bocina': ['speaker', 'volume', 'audio'],
    'mezcladora': ['mixer', 'audio_mixer', 'tune', 'equalizer'],
    'audifonos': ['headphones', 'headset']
  };

  private buildIconOption(fullId: string, source: string): IconOption {
    let prefix = 'material-symbols';
    let name = fullId;
    let id = fullId;

    if (fullId.includes(':')) {
      [prefix, name] = fullId.split(':');
    } else {
      // Remover suffixes si es simple string
      name = name.replace(/_sharp$/, '').replace(/_rounded$/, '').replace(/_outlined$/, '');
      id = name;
    }

    return {
      id,
      prefix,
      name,
      displayName: this.getFriendlyIconName(name),
      previewUrl: `https://api.iconify.design/${prefix}/${name}.svg`,
      source
    };
  }

  private searchIconify(query: string) {
    const normalized = this.normalizeIconSearchTerm(query);
    
    // 1. Relacionados de diccionario
    let relatedTerms: string[] = [];
    Object.keys(this.aliases).forEach(key => {
      if (key.includes(normalized)) {
        relatedTerms = [...relatedTerms, ...this.aliases[key]];
      }
    });
    // Coincidencia original si nada match o por defecto (sanitizado)
    relatedTerms.unshift(normalized.replace(/\s+/g, '-'));
    relatedTerms = Array.from(new Set(relatedTerms)).filter(Boolean);
    
    const queryForApi = relatedTerms.length > 1 ? relatedTerms[1] : relatedTerms[0];
    
    // Check cache
    if (this.iconSearchCache.has(queryForApi)) {
      return of({ icons: this.iconSearchCache.get(queryForApi) || [], networkError: false });
    }

    const prefixes = 'material-symbols,mdi,fa6-solid,tabler,lucide,ph,heroicons';
    
    // Primero, busqueda limitada por prefixes preferidos
    const urlPref = `https://api.iconify.design/search?query=${encodeURIComponent(queryForApi)}&prefixes=${prefixes}&limit=64`;
    // Y busqueda global paralela u odenada
    const urlGlobal = `https://api.iconify.design/search?query=${encodeURIComponent(queryForApi)}&limit=64`;
    
    return this.http.get<any>(urlPref).pipe(
      switchMap(response => {
        let apiIcons = (response && response.icons) ? response.icons : [];
        if (apiIcons.length < 5) {
          // Fallback a global search si muy pocos resultados preferidos
          return this.http.get<any>(urlGlobal).pipe(
            map(res => [...apiIcons, ...(res.icons || [])])
          );
        }
        return of(apiIcons);
      }),
      map((combinedApiIcons: string[]) => {
        const localOptions = relatedTerms.map(t => this.buildIconOption(t, 'local'));
        const apiOptions = combinedApiIcons.map(i => this.buildIconOption(i, 'api'));
        
        const combined = [...localOptions, ...apiOptions];
        // Deduplicación basada en el nombre para evitar (mdi:guitar, ph:guitar, material-symbols:guitar) repetidos. 
        // Preferimos el primero que llegue (el local primero, luego preferido, etc).
        const seenNames = new Set<string>();
        const unique: IconOption[] = [];
        
        for (const opt of combined) {
          if (!seenNames.has(opt.name)) {
            seenNames.add(opt.name);
            unique.push(opt);
          }
        }
        
        const finalResults = unique.slice(0, 64);
        this.iconSearchCache.set(queryForApi, finalResults);
        return { icons: finalResults, networkError: false };
      }),
      catchError(err => {
        console.warn('Iconify Search Failed', err);
        this.iconSearchError = true;
        this.iconSearchNetworkError = true;
        
        const localOptions = relatedTerms.map(t => this.buildIconOption(t, 'fallback'));
        const combined = [...localOptions, ...this.fallbackIcons];
        
        const seenNames = new Set<string>();
        const unique: IconOption[] = [];
        
        for (const opt of combined) {
          if (!seenNames.has(opt.name)) {
            seenNames.add(opt.name);
            unique.push(opt);
          }
        }
        return of({ icons: unique.slice(0, 32), networkError: true });
      })
    );
  }
}
