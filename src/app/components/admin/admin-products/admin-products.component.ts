import { Component, OnInit, OnDestroy, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil, forkJoin, debounceTime } from 'rxjs';
import { ProductService } from '../../../services/product.service';
import { AdminProductService } from '../../../services/admin-product.service';
import { StockAlertsService, StockAlertConfig, StaffRecipient } from '../../../services/stock-alerts.service';
import { BrandService } from '../../../services/brand.service';
import { CategoryService } from '../../../services/category.service';
import { FileUploadService } from '../../../services/file-upload.service';
import { NotificationCenterService } from '../../../core/services/notification-center.service';
import { AuthService } from '../../../services/auth.service';
import { BrandBasicInfo } from '../../../models/brand.model';
import { FileValidators } from '../../../utils/file-validators';
import Swal from 'sweetalert2';
export type UploadStatus = 'PENDING' | 'UPLOADING' | 'UPLOADED' | 'FAILED';

export interface PendingProductImage {
  tempId: string;
  file: File;
  previewUrl: string;
  name: string;
  size: number;
  type: string;
  desiredOrder: number;
  isPrimaryCandidate: boolean;
  uploadStatus: UploadStatus;
  errorMessage?: string;
}

/**
 * Componente para gestión completa de productos (CRUD)
 * Integrado con sistema de marcas
 */
@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-products.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./admin-products.component.css']
})
export class AdminProductsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private searchSubject$ = new Subject<string>(); // 🔍 Subject para debounce de búsqueda

  // Estado
  products: any[] = [];
  brands: BrandBasicInfo[] = [];
  categories: any[] = [];
  loading = false;
  showCreateModal = false;
  showEditModal = false;
  showDeleteModal = false;

  // Paginación
  currentPage = 0;
  pageSize = 5;
  totalProducts = 0;
  totalPages = 0;
  readonly pageSizeOptions: number[] = [5, 10, 20, 50, 100];

  // Búsqueda y filtros (SERVER-SIDE)
  searchTerm = '';
  filterBrandId: number | null = null;
  filterCategoryId: number | null = null;
  filterActive: boolean | null = null;
  
  // Ordenamiento
  sortBy = 'id';
  sortDir = 'DESC';

  // Formulario de producto con especificaciones técnicas
  productForm: any = {
    name: '',
    description: '',
    price: null,
    discountPrice: null,
    stock: 0,
    imageUrl: '',
    sku: '',
    categoryId: null,
    brandId: null,
    model: '',
    weight: null,
    dimensions: '',
    active: true,
    featured: false,
    // NUEVO: Sistema híbrido de especificaciones
    customAttributes: [],      // Atributos dinámicos clave-valor
    detailedDescription: '',   // Descripción rica con HTML
    // Especificaciones técnicas adicionales (mantener compatibilidad)
    specifications: {
      material: '',
      color: '',
      brand: '',
      warranty: '',
      includes: '',
      features: []
    }
  };

  // ── Custom Dropdown: categoría y marca ────────────────────────────────
  categorySearch     = '';
  brandSearch        = '';
  showCategoryDropdown = false;
  showBrandDropdown    = false;
  filteredCategories: any[] = [];
  filteredBrands:     any[] = [];

  // Validación del formulario con mensajes específicos
  formErrors: any = {
    name: '',
    sku: '',
    price: '',
    stock: '',
    categoryId: '',
    brandId: '',
    imageUrl: '',
    model: ''
  };

  // 📊 Contador de caracteres para descripción corta
  descriptionCharCount: number = 0;

  // Tooltips y ayudas para cada campo
  fieldHelp: any = {
    name: 'Nombre descriptivo del producto (ej: Guitarra Eléctrica Stratocaster)',
    sku: 'Código único de identificación (ej: GUIT-STRAT-001)',
    price: 'Precio de venta en pesos (solo números)',
    discountPrice: 'Precio con descuento (opcional, debe ser menor al precio regular)',
    stock: 'Cantidad disponible en inventario',
    categoryId: 'Categoría principal del producto',
    brandId: 'Marca del fabricante',
    model: 'Modelo o versión específica del producto',
    weight: 'Peso en kilogramos (ej: 3.5)',
    dimensions: 'Medidas en cm: Largo x Ancho x Alto',
    imageUrl: 'URL de la imagen del producto o selecciona un archivo'
  };

  // Control del editor de texto enriquecido
  showDescriptionEditor = false;
  descriptionPreview = '';

  // Control de estado para cambios sin guardar y validaciones locales
  initialProductFormState: string = '';
  attemptedNext: boolean = false;
  attemptedSave: boolean = false;

  selectedProduct: any = null;

  // Mensajes (legacy — se mantienen para compatibilidad interna)
  successMessage = '';
  errorMessage = '';

  // ── Sistema de notificaciones toast ────────────────────────────────────
  toast: {
    visible: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    progress: number;       // 0–100, controla la barra de progreso visual
  } = { visible: false, type: 'info', title: '', message: '', progress: 100 };

  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private toastProgressInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Muestra un toast no intrusivo dentro del contexto del componente.
   * Se cierra automáticamente después de `duration` ms.
   */
  showToast(
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string,
    duration = 5000
  ): void {
    // Cancelar toast anterior si había uno activo
    if (this.toastTimer)            clearTimeout(this.toastTimer);
    if (this.toastProgressInterval) clearInterval(this.toastProgressInterval);

    this.toast = { visible: true, type, title, message, progress: 100 };

    // Animación de barra de progreso
    const step = 100 / (duration / 50);
    this.toastProgressInterval = setInterval(() => {
      this.toast.progress = Math.max(0, this.toast.progress - step);
    }, 50);

    // Auto-cierre
    this.toastTimer = setTimeout(() => {
      this.dismissToast();
    }, duration);
  }

  dismissToast(): void {
    if (this.toastTimer)            clearTimeout(this.toastTimer);
    if (this.toastProgressInterval) clearInterval(this.toastProgressInterval);
    this.toast.visible = false;
  }

  // ── Notificaciones de stock ──────────────────────────────
  private readonly LOW_STOCK_THRESHOLD = 5;

  private checkStockNotification(productName: string, stock: number, productId?: number): void {
    if (stock <= this.LOW_STOCK_THRESHOLD) {
      this.notifService.lowStock(productName, stock, this.LOW_STOCK_THRESHOLD);
    }
  }

  // Upload de imágenes - Sistema de galería múltiple
  selectedImageFile: File | null = null;
  imagePreview: string | null = null;
  uploadingImage = false;
  
  // Galería de imágenes del producto
  productImages: Array<{
    id?: number; // ID de product_images (si ya existe en BD)
    url: string;
    file?: File;
    isPrimary: boolean;
    displayOrder: number;
    altText?: string;
    provider?: string;
  }> = [];

  pendingProductImages: PendingProductImage[] = [];
  
  maxImages = 8; // Máximo de imágenes permitidas
  
  // Variables Lightbox (Vista Ampliada)
  showLightbox = false;
  lightboxImage: { url: string; name: string; size?: number; type?: string } | null = null;
  
  // Control de tabs profesional
  currentTab: 'general' | 'pricing' | 'media' | 'details' = 'general';
  
  // Control de modo de subida de imagen
  imageUploadMode: 'file' | 'url' = 'file'; // Por defecto archivo local

  // Bandera para validación profesional (solo mostrar errores después de submit)
  isSubmitted = false;

  // ── ESTADO DE SUBIDA PROFESIONAL (OVERLAY) ──
  isProcessingUploads = false;
  uploadProgressMessage = '';
  partialErrorState = false;
  failedImagesCount = 0;

  // ── Stock Alerts Modal ──────────────────────────────────────────────────
  showStockAlertsModal = false;
  stockAlertsLoading = false;
  savingStockAlerts = false;
  stockAlertsEnabled = false;
  stockAlertThreshold = 10;
  // Employee selector state
  allAlertStaff: StaffRecipient[] = [];
  filteredAlertStaff: StaffRecipient[] = [];
  selectedAlertEmployees: StaffRecipient[] = [];
  alertStaffSearch = '';
  showAlertStaffDropdown = false;
  loadingAlertStaff = false;

  // Getters para el template
  get filteredProducts(): any[] {
    return this.products;
  }

  get activeProductsCount(): number {
    return this.products.filter(p => p.active).length;
  }

  get lowStockCount(): number {
    return this.products.filter(p => p.stock <= 10).length;
  }

  constructor(
    private productService: ProductService,
    private adminProductService: AdminProductService,
    private stockAlertsService: StockAlertsService,
    private brandService: BrandService,
    private categoryService: CategoryService,
    private fileUploadService: FileUploadService,
    private notifService: NotificationCenterService,
    public authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.loadInitialData();
    
    // 🔍 Configurar debounce para búsqueda (esperar 500ms después de que el usuario deje de escribir)
    this.searchSubject$
      .pipe(
        debounceTime(500), // Esperar 500ms sin cambios
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        console.log('🔍 Ejecutando búsqueda con debounce:', this.searchTerm);
        this.currentPage = 0;
        this.loadProducts();
      });
    
    // Aplicar filtros desde query params (navegación desde otros módulos)
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      let needsReload = false;

      if (params['brandId']) {
        this.filterBrandId = +params['brandId'];
        needsReload = true;
      }

      if (params['categoryId']) {
        this.filterCategoryId = +params['categoryId'];
        needsReload = true;
      }

      if (needsReload) {
        this.currentPage = 0;
        this.loadProducts();
      }

      if (params['action'] === 'create' && !this.showCreateModal) {
        this.openCreateModal();
        this.clearActionParam();
      }

      // Recarga disparada por el CSV import (emite importSuccess → layout navega con action=refresh)
      if (params['action'] === 'refresh') {
        this.currentPage = 0;
        this.loadProducts();
        this.clearActionParam();
      }
    });

    // Verificar si hay scroll horizontal después de cargar datos
    setTimeout(() => this.checkTableScroll(), 500);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.clearPendingImages();
    FileValidators.revokePreviewUrl(this.imagePreview);
    this.closeLightbox();
  }

  private clearActionParam(): void {
    this.router.navigate([], {
      queryParams: { action: null },
      queryParamsHandling: 'merge'
    });
  }

  // ==================== LISTENER DE RESIZE DE VENTANA ====================
  
  @HostListener('window:resize')
  onWindowResize(): void {
    this.checkTableScroll();
  }

  /** Close custom dropdowns when clicking anywhere outside them */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-dropdown-wrap')) {
      this.showCategoryDropdown = false;
      this.showBrandDropdown    = false;
    }
  }

  // ==================== DETECCIÓN AUTOMÁTICA DE SCROLL ====================
  
  checkTableScroll(): void {
    const tableWrapper = document.querySelector('.table-wrapper') as HTMLElement;
    const tableContainer = document.querySelector('.table-container') as HTMLElement;
    
    if (!tableWrapper || !tableContainer) return;

    // Verificar si el contenido de la tabla es más ancho que el contenedor
    const hasHorizontalScroll = tableWrapper.scrollWidth > tableWrapper.clientWidth;
    
    if (hasHorizontalScroll) {
      tableContainer.classList.add('has-scroll');
    } else {
      tableContainer.classList.remove('has-scroll');
    }
  }

  // ==================== MANEJO DE SCROLL EN TABLA ====================
  
  onTableScroll(event: Event): void {
    const element = event.target as HTMLElement;
    const container = element.closest('.table-container');
    
    if (!container) return;

    // Detectar si hizo scroll (ocultar hint después de primer scroll)
    if (element.scrollLeft > 10) {
      container.classList.add('scrolled');
    }

    // Detectar si llegó al final del scroll (ocultar sombra derecha)
    const isAtEnd = element.scrollLeft + element.clientWidth >= element.scrollWidth - 10;
    if (isAtEnd) {
      element.classList.add('scrolled-end');
    } else {
      element.classList.remove('scrolled-end');
    }
  }

  // ==================== CARGA INICIAL ====================

  loadInitialData(): void {
    this.loading = true;
    this.errorMessage = '';
    
    console.log('🔄 Iniciando carga de datos...');
    
    // Cargar marcas de forma independiente
    this.brandService.getActiveBrands()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (brands) => {
          console.log('✅ Marcas cargadas exitosamente:', brands);
          this.brands = brands || [];
          console.log('🏷️ Total de marcas:', this.brands.length);
          
          if (this.brands.length === 0) {
            console.warn('⚠️ No se encontraron marcas activas');
          }
        },
        error: (error) => {
          console.error('❌ Error al cargar marcas:', error);
          this.brands = [];
        }
      });
    
    // Cargar categorías de forma independiente
    this.categoryService.getAllCategories()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (categories: any) => {
          console.log('✅ Categorías cargadas exitosamente:', categories);
          this.categories = categories || [];
          console.log('📂 Total de categorías:', this.categories.length);
          
          if (this.categories.length === 0) {
            console.warn('⚠️ No se encontraron categorías');
          }
        },
        error: (error: any) => {
          console.error('❌ Error al cargar categorías:', error);
          console.error('📍 URL del error:', error.url);
          console.error('📊 Status:', error.status);
          console.error('💬 Mensaje:', error.error?.message || error.message);
          
          this.categories = [];
          this.errorMessage = `Advertencia: No se pudieron cargar las categorías. ${error.error?.message || error.message}`;
        }
      });
    
    // Cargar productos siempre
    this.loadProducts();
  }

  // ==================== CRUD OPERATIONS ====================

  /**
   * 🔍 CARGAR PRODUCTOS CON BÚSQUEDA Y FILTROS DEL SERVIDOR
   * Server-Side: El backend procesa búsqueda, filtros, paginación y ordenamiento
   */
  loadProducts(): void {
    this.loading = true;
    this.errorMessage = '';

    console.log('🔄 Cargando productos con filtros del servidor...');
    console.log('📄 Página:', this.currentPage, '| Tamaño:', this.pageSize);
    console.log('🔍 Búsqueda:', this.searchTerm || 'N/A');
    console.log('🏷️ Marca:', this.filterBrandId || 'N/A');
    console.log('📂 Categoría:', this.filterCategoryId || 'N/A');
    console.log('✅ Estado:', this.filterActive !== null ? (this.filterActive ? 'Activo' : 'Inactivo') : 'Todos');

    this.productService.getAllProducts(
      this.currentPage,
      this.pageSize,
      this.searchTerm,
      this.filterBrandId,
      this.filterCategoryId,
      this.filterActive,
      this.sortBy,
      this.sortDir
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          console.log('✅ Respuesta del servidor:', response);
          
          this.products = response.content || [];
          this.totalProducts = response.totalElements || 0;
          this.totalPages = response.totalPages || 1;
          
          console.log('📊 Productos cargados:', this.products.length, '| Total:', this.totalProducts);
          
          this.loading = false;
          
          // Verificar scroll horizontal después de cargar
          setTimeout(() => this.checkTableScroll(), 100);
        },
        error: (error) => {
          console.error('❌ Error al cargar productos:', error);
          this.errorMessage = 'Error al cargar productos. Por favor, intenta de nuevo.';
          this.loading = false;
          this.products = [];
          this.totalProducts = 0;
        }
      });
  }

  /**
   * 🔍 Aplicar filtros (reinicia a página 0 y recarga desde el servidor)
   */
  applyFilters(): void {
    console.log('🎯 Aplicando filtros...');
    this.currentPage = 0; // Reiniciar a la primera página
    this.loadProducts();
  }

  /**
   * 🔄 Limpiar todos los filtros
   */
  clearFilters(): void {
    console.log('🧹 Limpiando filtros...');
    this.searchTerm = '';
    this.filterBrandId = null;
    this.filterCategoryId = null;
    this.filterActive = null;
    this.applyFilters();
  }

  /**
   * 🔽 Cambiar ordenamiento
   */
  changeSorting(field: string): void {
    if (this.sortBy === field) {
      // Alternar dirección si es el mismo campo
      this.sortDir = this.sortDir === 'ASC' ? 'DESC' : 'ASC';
    } else {
      // Nuevo campo, ordenar descendente por defecto
      this.sortBy = field;
      this.sortDir = 'DESC';
    }
    
    console.log(`🔽 Ordenando por: ${this.sortBy} ${this.sortDir}`);
    this.applyFilters(); // Recargar con nuevo ordenamiento
  }

  /**
   * 📊 Contar filtros activos
   */
  getActiveFiltersCount(): number {
    let count = 0;
    if (this.searchTerm && this.searchTerm.trim() !== '') count++;
    if (this.filterBrandId !== null) count++;
    if (this.filterCategoryId !== null) count++;
    if (this.filterActive !== null) count++;
    return count;
  }

  openCreateModal(): void {
    console.log('Abriendo modal de crear producto');
    
    this.resetForm();

    // Resetear variables de overlay profesional
    this.isProcessingUploads = false;
    this.uploadProgressMessage = '';
    this.partialErrorState = false;
    this.failedImagesCount = 0;
    this.isSubmitted = false; // Resetear validación
    this.showCreateModal = true;
    this.currentTab = 'general'; // Empezar en la primera pestaña
    this.imageUploadMode = 'file'; // Modo por defecto: archivo local
    this.errorMessage = '';
    this.clearFormErrors();
    this.clearPendingImages();
    FileValidators.revokePreviewUrl(this.imagePreview);
    this.imagePreview = null;
    this.selectedImageFile = null;
    // Limpiar dropdowns
    this.categorySearch = '';
    this.brandSearch = '';
    
    // Cargar descripción vacía en editor
    this.loadDescriptionInEditor();
    
    // Resetear contadores y estados nuevos
    this.attemptedNext = false;
    this.attemptedSave = false;
    this.updateDescriptionCharCount();
    
    // Guardar estado prístino
    this.saveInitialFormState();

    this.showCategoryDropdown = false;
    this.showBrandDropdown = false;
    this.filteredCategories = [];
    this.filteredBrands = [];
    
    // Inicializar contador de caracteres
    this.updateDescriptionCharCount();
    
    // Resetear variables de overlay profesional
    this.isProcessingUploads = false;
    this.uploadProgressMessage = '';
    this.partialErrorState = false;
    this.failedImagesCount = 0;
    
    if (this.brands.length === 0 || this.categories.length === 0) {
      this.loadInitialData();
    }
  }

  // ==================== CONTROL DE TABS ====================
  
  setTab(tab: 'general' | 'pricing' | 'media' | 'details'): void {
    // Definir orden de tabs
    const tabsOrder = ['general', 'pricing', 'media', 'details'];
    const currentIndex = tabsOrder.indexOf(this.currentTab);
    const targetIndex = tabsOrder.indexOf(tab);
    
    // Si vamos hacia adelante, validar la pestaña actual
    if (targetIndex > currentIndex) {
      this.attemptedNext = true;
      let valid = true;
      
      if (this.currentTab === 'general') {
        if (!this.productForm.name?.trim() || this.productForm.name.trim().length < 3) {
          this.formErrors.name = 'El nombre del producto es obligatorio y debe tener al menos 3 caracteres';
          valid = false;
        }
        if (!this.productForm.categoryId) {
          this.formErrors.categoryId = 'Debes seleccionar una categoría';
          valid = false;
        }
      } else if (this.currentTab === 'pricing') {
        if (!this.productForm.price || this.productForm.price <= 0 || isNaN(Number(this.productForm.price))) {
          this.formErrors.price = 'El precio debe ser un número válido mayor a 0';
          valid = false;
        }
        if (this.productForm.stock === null || this.productForm.stock === undefined || this.productForm.stock < 0 || isNaN(Number(this.productForm.stock))) {
          this.formErrors.stock = 'El stock debe ser un número entero igual o mayor a 0';
          valid = false;
        }
        this.validateDiscountPrice();
        if (this.formErrors.discountPrice) valid = false;
      }
      
      if (!valid) {
        // No avanzar si hay errores y mostrar advertencia local (o dejar que el HTML muestre el banner)
        return;
      }
    }
    
    // Resetear attemptedNext al cambiar de tab exitosamente
    this.attemptedNext = false;
    this.currentTab = tab;
    
    // Si cambiamos al tab de detalles, cargar la descripción en el editor
    if (tab === 'details' && this.showEditModal) {
      setTimeout(() => {
        this.loadDescriptionInEditor();
      }, 100);
    }
  }

  // ==================== CUSTOM DROPDOWN: CATEGORÍA Y MARCA ====================

  /**
   * Abre el dropdown de categoría y pre-filtra con el texto actual.
   */
  openCategoryDropdown(): void {
    this.filteredCategories = this._filterList(this.categories, this.categorySearch);
    this.showCategoryDropdown = true;
  }

  /**
   * Filtra categorías mientras el usuario escribe.
   */
  filterCategories(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.categorySearch = val;
    this.filteredCategories = this._filterList(this.categories, val);
    this.showCategoryDropdown = true;
    // Si el texto ya no coincide con ninguna opción, limpiar el ID
    const exact = this.categories.find((c: any) =>
      c.name.toLowerCase() === val.toLowerCase()
    );
    this.productForm.categoryId = exact ? exact.id : null;
  }

  /**
   * Selecciona una categoría del dropdown.
   */
  selectCategory(cat: any): void {
    this.productForm.categoryId = cat.id;
    this.categorySearch = cat.name;
    this.showCategoryDropdown = false;
  }

  /**
   * Cierra el dropdown de categoría con un pequeño delay
   * para permitir que el click en la opción se procese primero.
   */
  closeCategoryDropdown(): void {
    setTimeout(() => { this.showCategoryDropdown = false; }, 180);
  }

  /**
   * Abre el dropdown de marca y pre-filtra con el texto actual.
   */
  openBrandDropdown(): void {
    this.filteredBrands = this._filterList(this.brands, this.brandSearch);
    this.showBrandDropdown = true;
  }

  /**
   * Filtra marcas mientras el usuario escribe.
   */
  filterBrands(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.brandSearch = val;
    this.filteredBrands = this._filterList(this.brands, val);
    this.showBrandDropdown = true;
    if (!val || val.trim() === '') {
      this.productForm.brandId = null;
      return;
    }
    const exact = this.brands.find((b: any) =>
      b.name.toLowerCase() === val.toLowerCase()
    );
    this.productForm.brandId = exact ? exact.id : null;
  }

  /**
   * Selecciona una marca del dropdown.
   */
  selectBrand(brand: any): void {
    this.productForm.brandId = brand.id;
    this.brandSearch = brand.name;
    this.showBrandDropdown = false;
  }

  /**
   * Cierra el dropdown de marca con un pequeño delay.
   */
  closeBrandDropdown(): void {
    setTimeout(() => { this.showBrandDropdown = false; }, 180);
  }

  /** Filtra un array de {id, name} por texto, ignorando case. */
  private _filterList(list: any[], query: string): any[] {
    if (!query || query.trim() === '') return [...list];
    const q = query.toLowerCase().trim();
    return list.filter((item: any) => item.name.toLowerCase().includes(q));
  }

  /**
   * Inicializa los textos de los dropdowns a partir del productForm (modo edición)
   */
  initComboboxFromForm(): void {
    if (this.productForm.categoryId) {
      const cat = this.categories.find((c: any) => c.id == this.productForm.categoryId);
      this.categorySearch = cat ? cat.name : '';
    } else {
      this.categorySearch = '';
    }
    if (this.productForm.brandId) {
      const brand = this.brands.find((b: any) => b.id == this.productForm.brandId);
      this.brandSearch = brand ? brand.name : '';
    } else {
      this.brandSearch = '';
    }
  }

  // Legacy aliases kept so existing call-sites compile without changes
  onCategoryChange(value: string): void {
    const match = this.categories.find((c: any) =>
      c.name.toLowerCase() === value.toLowerCase()
    );
    this.productForm.categoryId = match ? match.id : null;
  }

  onBrandChange(value: string): void {
    if (!value || value.trim() === '') { this.productForm.brandId = null; return; }
    const match = this.brands.find((b: any) =>
      b.name.toLowerCase() === value.toLowerCase()
    );
    this.productForm.brandId = match ? match.id : null;
  }
  
  // ==================== CONTROL DE MODO DE IMAGEN ====================
  
  setImageUploadMode(mode: 'file' | 'url'): void {
    this.imageUploadMode = mode;
    // Limpiar campos al cambiar de modo
    if (mode === 'file') {
      this.productForm.imageUrl = '';
    } else {
      this.selectedImageFile = null;
      this.imagePreview = null;
    }
  }

  openEditModal(product: any): void {
    console.log('🔍 === ABRIENDO MODAL DE EDICIÓN ===');
    console.log('📦 Producto recibido:', product);
    console.log('📝 detailedDescription desde DB:', product.detailedDescription);
    console.log('🏷️ customAttributes desde DB:', product.customAttributes);
    
    this.selectedProduct = product;
    this.productForm = {
      name: product.name,
      description: product.description || '',
      price: product.price,
      discountPrice: product.discountPrice,
      stock: product.stock,
      imageUrl: product.imageUrl || '',
      sku: product.sku,
      categoryId: product.categoryId,
      brandId: product.brandId,
      model: product.model || '',
      weight: product.weight,
      dimensions: product.dimensions || '',
      active: product.active,
      featured: product.featured,
      // NUEVOS CAMPOS: Cargar atributos y descripción detallada
      customAttributes: product.customAttributes ? [...product.customAttributes] : [],
      detailedDescription: product.detailedDescription || ''
    };

    console.log('✅ productForm.detailedDescription asignado:', this.productForm.detailedDescription);
    console.log('✅ productForm.customAttributes asignados:', this.productForm.customAttributes);

    // Cargar galería de imágenes existentes directamente desde el backend
    this.loadProductGallery();

    console.log(`📸 Cargadas ${this.productImages.length} imágenes para edición`);
    console.log(`🔧 Cargados ${this.productForm.customAttributes.length} atributos personalizados`);

    // Inicializar contador de caracteres para descripción corta
    this.updateDescriptionCharCount();

    this.showEditModal = true;
    this.currentTab = 'general'; // Empezar en la primera pestaña
    this.imageUploadMode = 'file'; // Modo archivo por defecto
    this.errorMessage = '';
    this.clearPendingImages();
    FileValidators.revokePreviewUrl(this.imagePreview);
    this.imagePreview = null;
    this.selectedImageFile = null;
    // Inicializar comboboxes con los valores del producto
    this.initComboboxFromForm();
    this.loadDescriptionInEditor(); // Cargar descripción en el editor
    
    // Resetear contadores y estados nuevos
    this.attemptedNext = false;
    this.attemptedSave = false;
    this.isSubmitted = false;
    
    // Esperar a que los datos se establezcan y guardar el estado
    setTimeout(() => {
      this.saveInitialFormState();
    }, 0);
  }

  openDeleteModal(product: any): void {
    this.selectedProduct = product;
    this.showDeleteModal = true;
    this.errorMessage = '';
  }

  async saveProduct(): Promise<void> {
    // Marcar formulario como submitted para activar validaciones visuales
    this.isSubmitted = true;
    this.attemptedSave = true;

    // Validar formulario básico
    if (!this.validateForm()) {
      console.error('❌ Validación del formulario falló');
      
      // Navigate to the tab that has the first error
      if (this.formErrors.name || this.formErrors.categoryId || this.formErrors.brandId) {
        this.setTab('general');
      } else if (this.formErrors.price || this.formErrors.discountPrice || this.formErrors.stock) {
        this.setTab('pricing');
      }
      
      // Scroll al primer error
      setTimeout(() => {
        const firstError = document.querySelector('.is-invalid');
        if (firstError) {
          firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);

      return;
    }

    // Validar atributos personalizados
    if (!this.validateCustomAttributes()) {
      console.error('❌ Validación de atributos personalizados falló');
      this.setTab('details'); // Cambiar a la pestaña de detalles
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    try {
      // Dimensiones por defecto
      const defaultDimensions = this.productForm.dimensions?.trim() || '30 x 10 x 5 cm';
      
      // Preparar objeto JSON final (sin imágenes)
      const productData = {
        name: this.productForm.name?.trim(),
        description: this.productForm.description?.trim() || null,
        price: this.productForm.price ? Number(this.productForm.price) : null,
        discountPrice: this.productForm.discountPrice ? Number(this.productForm.discountPrice) : null,
        stock: this.productForm.stock ? Number(this.productForm.stock) : 0,
        sku: this.productForm.sku?.trim(),
        categoryId: this.productForm.categoryId ? Number(this.productForm.categoryId) : null,
        brandId: this.productForm.brandId ? Number(this.productForm.brandId) : null,
        model: this.productForm.model?.trim() || null,
        weight: this.productForm.weight ? Number(this.productForm.weight) : null,
        dimensions: defaultDimensions,
        active: this.productForm.active === true,
        featured: this.productForm.featured === true,
        // ✨ NUEVO: Sistema Híbrido de Especificaciones
        customAttributes: (this.productForm.customAttributes || [])
          .filter((attr: any) => attr.key && attr.key.trim() && attr.value && attr.value.trim())
          .map((attr: any, index: number) => ({
            key: attr.key.trim(),
            value: attr.value.trim(),
            displayOrder: index
          })),
        detailedDescription: this.productForm.detailedDescription?.trim() || null
      };

      console.log('📦 Objeto producto final:', productData);

      if (this.showCreateModal) {
        // Validación extra de imágenes si la hubiese, pero el límite de 8 ya lo controlamos al seleccionarlas
        // CREAR PRODUCTO
        this.productService.createProduct(productData)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: async (response) => {
              console.log('✅ Producto creado exitosamente:', response);
              
              if (this.pendingProductImages.length > 0) {
                // Hay imágenes pendientes, subirlas secuencialmente
                this.isProcessingUploads = true;
                this.loading = true; // Mantener bloqueado mientras sube
                
                let successCount = 0;
                let failedCount = 0;
                let currentIndex = 1;
                const totalPending = this.pendingProductImages.length;

                // Subir secuencialmente según el desiredOrder
                for (const pending of this.pendingProductImages) {
                  this.uploadProgressMessage = `Subiendo imagen ${currentIndex} de ${totalPending}...`;
                  pending.uploadStatus = 'UPLOADING';
                  try {
                    await new Promise<void>((resolve) => {
                      this.adminProductService.uploadProductImage(response.id, pending.file)
                        .pipe(takeUntil(this.destroy$))
                        .subscribe({
                          next: (uploadRes) => {
                            pending.uploadStatus = 'UPLOADED';
                            successCount++;
                            FileValidators.revokePreviewUrl(pending.previewUrl);
                            
                            // Si la imagen era la candidata principal, llamar a PATCH /primary
                            if (pending.isPrimaryCandidate && uploadRes.data && uploadRes.data.id) {
                              this.adminProductService.setPrimaryProductImage(response.id, uploadRes.data.id)
                                .pipe(takeUntil(this.destroy$))
                                .subscribe({
                                  next: () => console.log('✅ Imagen seteada como principal correctamente'),
                                  error: (err) => console.error('❌ Error al setear imagen principal', err)
                                });
                            }
                            
                            resolve();
                          },
                          error: (err) => {
                            pending.uploadStatus = 'FAILED';
                            pending.errorMessage = this.extractErrorMessage(err);
                            failedCount++;
                            resolve(); // Resolvemos para no detener el bucle
                          }
                        });
                    });
                  } catch (e) {
                    console.error('Error in upload loop', e);
                    pending.uploadStatus = 'FAILED';
                    pending.errorMessage = 'Error inesperado';
                    failedCount++;
                  }
                  currentIndex++;
                }

                // Filtrar las fallidas para mantenerlas en la UI
                this.pendingProductImages = this.pendingProductImages.filter(p => p.uploadStatus === 'FAILED');
                
                this.isProcessingUploads = false;
                this.failedImagesCount = failedCount;
                
                // Notificar si el nuevo producto tiene stock bajo
                this.checkStockNotification(productData.name || 'Nuevo producto', productData.stock, response?.id);

                if (failedCount > 0) {
                  // Fallo parcial: pasar a modo edición y mantener modal abierto
                  this.partialErrorState = true;
                  this.showCreateModal = false;
                  this.selectedProduct = response;
                  this.showEditModal = true;
                  this.setTab('media');
                  this.loadProductGallery();
                  this.loadProducts();
                } else {
                  // Éxito total: cerrar modal inmediatamente
                  this.showToast('success', 'Éxito', 'Producto creado y todas las imágenes se guardaron correctamente.', 4000);
                  this.closeModal();
                  this.loadProducts();
                }
                this.loading = false;
              } else {
                // Producto sin imágenes: éxito total
                this.checkStockNotification(productData.name || 'Nuevo producto', productData.stock, response?.id);
                this.showToast('success', 'Éxito', 'Producto guardado correctamente.', 4000);
                this.closeModal();
                this.loadProducts();
                this.loading = false;
              }
            },
            error: (error) => {
              console.error('❌ Error al crear producto:', error);
              this.showToast('error', 'Error al crear producto', this.extractErrorMessage(error), 8000);
              this.errorMessage = this.extractErrorMessage(error);
              this.loading = false;
            }
          });
          
      } else if (this.showEditModal && this.selectedProduct) {
        // ACTUALIZAR PRODUCTO
        this.productService.updateProduct(this.selectedProduct.id, productData)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (response) => {
              console.log('✅ Producto actualizado exitosamente:', response);
              this.showToast('success', 'Producto actualizado', 'Los cambios se guardaron correctamente.', 4000);
              this.successMessage = '✅ Producto actualizado exitosamente';
              this.showEditModal = false;
              // Notificar si el stock cambió a nivel crítico
              this.checkStockNotification(
                productData.name || this.selectedProduct?.name || 'Producto',
                productData.stock,
                this.selectedProduct?.id
              );
              this.selectedProduct = null;
              this.resetForm();
              this.loadProducts();
              this.loading = false;
              setTimeout(() => this.successMessage = '', 3000);
            },
            error: (error) => {
              console.error('❌ Error al actualizar producto:', error);
              this.showToast('error', 'Error al actualizar producto', this.extractErrorMessage(error), 8000);
              this.errorMessage = this.extractErrorMessage(error);
              this.loading = false;
            }
          });
      }

    } catch (error: any) {
      console.error('❌ Error general en saveProduct:', error);
      this.showToast('error', 'Error inesperado', error.message || 'Error al procesar el producto', 8000);
      this.errorMessage = error.message || 'Error al procesar el producto';
      this.loading = false;
    }
  }

  deleteProduct(): void {
    if (!this.selectedProduct) return;

    this.loading = true;
    this.errorMessage = '';

    this.productService.deleteProduct(this.selectedProduct.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.successMessage = 'Producto eliminado exitosamente';
          this.showDeleteModal = false;
          this.selectedProduct = null;
          this.loadProducts();
          setTimeout(() => this.successMessage = '', 3000);
        },
        error: (error) => {
          console.error('Error al eliminar producto:', error);
          this.errorMessage = error.error?.message || 'Error al eliminar el producto';
          this.loading = false;
        }
      });
  }

  toggleStatus(product: any): void {
    const updatedProduct = { ...product, active: !product.active };
    
    this.productService.updateProduct(product.id, updatedProduct)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.successMessage = `Producto ${product.active ? 'desactivado' : 'activado'} exitosamente`;
          this.loadProducts();
          setTimeout(() => this.successMessage = '', 3000);
        },
        error: (error) => {
          console.error('Error al cambiar estado:', error);
          this.errorMessage = 'Error al cambiar el estado del producto';
        }
      });
  }

  // ==================== VALIDACIÓN PROFESIONAL ====================

  /**
   * Validación en tiempo real para campos numéricos
   */
  validateNumber(value: any, fieldName: string): void {
    const numValue = Number(value);
    
    if (value !== '' && value !== null && value !== undefined) {
      if (isNaN(numValue)) {
        this.formErrors[fieldName] = '⚠️ Solo se permiten números';
      } else if (numValue < 0) {
        this.formErrors[fieldName] = '⚠️ El valor no puede ser negativo';
      } else {
        this.formErrors[fieldName] = '';
      }
    } else {
      this.formErrors[fieldName] = '';
    }
  }

  /**
   * Manejador de eventos para inputs numéricos (type-safe)
   */
  onNumberInput(event: Event, fieldName: string): void {
    const input = event.target as HTMLInputElement;
    this.validateNumber(input.value, fieldName);
  }

  /**
   * Manejador de evento para error de imagen (type-safe)
   */
  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'https://via.placeholder.com/400x400/800020/FFFFFF?text=Error+al+cargar';
  }

  /**
   * Validación de precio con descuento
   */
  validateDiscountPrice(): void {
    if (this.productForm.discountPrice) {
      const price = Number(this.productForm.price);
      const discountPrice = Number(this.productForm.discountPrice);
      
      if (discountPrice >= price) {
        this.formErrors.discountPrice = '⚠️ El precio con descuento debe ser menor al precio regular';
      } else if (discountPrice < 0) {
        this.formErrors.discountPrice = '⚠️ El precio no puede ser negativo';
      } else {
        this.formErrors.discountPrice = '';
      }
    }
  }

  /**
   * Validación de SKU único
   */
  validateSKU(): void {
    const sku = this.productForm.sku?.trim();
    if (sku && sku.length < 3) {
      this.formErrors.sku = '⚠️ El SKU debe tener al menos 3 caracteres';
    } else if (sku && !/^[A-Z0-9-]+$/i.test(sku)) {
      this.formErrors.sku = '⚠️ El SKU solo puede contener letras, números y guiones';
    } else {
      this.formErrors.sku = '';
    }
  }

  /**
   * Validación del formulario completo
   */
  validateForm(): boolean {
    this.clearFormErrors();
    let isValid = true;

    // Validar nombre
    if (!this.productForm.name?.trim()) {
      this.formErrors.name = 'El nombre del producto es obligatorio';
      isValid = false;
    } else if (this.productForm.name.trim().length < 3) {
      this.formErrors.name = 'El nombre debe tener al menos 3 caracteres';
      isValid = false;
    }

    // SKU es autogenerado por el backend — no se valida en el frontend

    // Validar precio
    if (!this.productForm.price || this.productForm.price <= 0) {
      this.formErrors.price = 'El precio debe ser mayor a 0';
      isValid = false;
    } else if (isNaN(Number(this.productForm.price))) {
      this.formErrors.price = 'El precio debe ser un número válido';
      isValid = false;
    }

    // Validar stock
    if (this.productForm.stock === null || this.productForm.stock === undefined || this.productForm.stock < 0) {
      this.formErrors.stock = 'El stock debe ser un entero igual o mayor a 0';
      isValid = false;
    } else if (isNaN(Number(this.productForm.stock))) {
      this.formErrors.stock = 'El stock debe ser un número válido';
      isValid = false;
    }

    // Validar categoría
    if (!this.productForm.categoryId) {
      this.formErrors.categoryId = 'Debes seleccionar una categoría';
      isValid = false;
    }

    // Validar precio con descuento
    this.validateDiscountPrice();
    if (this.formErrors.discountPrice) {
      isValid = false;
    }

    return isValid;
  }

  clearFormErrors(): void {
    this.formErrors = {
      name: '',
      sku: '',
      price: '',
      stock: '',
      categoryId: '',
      brandId: '',
      imageUrl: '',
      model: '',
      discountPrice: ''
    };
  }

  // ==================== EDITOR DE DESCRIPCIÓN RICO ====================

  /**
   * Aplicar formato al texto seleccionado
   */
  applyTextFormat(command: string, value?: string): void {
    document.execCommand(command, false, value);
  }

  /**
   * Insertar lista
   */
  insertList(type: 'ul' | 'ol'): void {
    const listType = type === 'ul' ? 'insertUnorderedList' : 'insertOrderedList';
    document.execCommand(listType, false);
  }

  /**
   * Actualizar contenido de la descripción desde el editor
   */
  onDescriptionInput(event: Event): void {
    const editor = event.target as HTMLElement;
    this.productForm.detailedDescription = editor.innerHTML;
    // console.log('📝 Descripción actualizada:', editor.innerHTML.length + ' caracteres');
  }

  /**
   * Cargar descripción en el editor cuando se edita un producto
   */
  loadDescriptionInEditor(): void {
    console.log('🔄 Intentando cargar descripción en el editor...');
    console.log('📝 Contenido a cargar:', this.productForm.detailedDescription);
    
    // Intentar múltiples veces con timeouts incrementales para asegurar que el DOM esté listo
    const attempts = [100, 300, 500];
    
    attempts.forEach((delay, index) => {
      setTimeout(() => {
        const editor = document.querySelector('.rich-text-editor-pro') as HTMLElement;
        console.log(`🔍 Intento ${index + 1} (${delay}ms) - Editor encontrado:`, !!editor);
        
        if (editor) {
          if (this.productForm.detailedDescription && this.productForm.detailedDescription.trim() !== '') {
            editor.innerHTML = this.productForm.detailedDescription;
            console.log(`✅ Intento ${index + 1} - Descripción cargada en el editor:`, 
                       this.productForm.detailedDescription.substring(0, 100) + '...');
          } else {
            editor.innerHTML = '';
            console.log(`ℹ️ Intento ${index + 1} - No hay descripción detallada para cargar (vacía o null)`);
          }
        } else {
          console.warn(`⚠️ Intento ${index + 1} - Editor NO encontrado en el DOM`);
        }
      }, delay);
    });
  }

  /**
   * Limpiar formato
   */
  clearFormatting(): void {
    document.execCommand('removeFormat', false);
  }

  /**
   * 📊 Actualizar contador de caracteres para Descripción Corta
   */
  updateDescriptionCharCount(): void {
    this.descriptionCharCount = (this.productForm.description || '').length;
  }

  extractErrorMessage(error: any): string {
    if (error.error?.message) {
      return error.error.message;
    }
    
    if (error.error?.errors) {
      const errorMessages = Object.values(error.error.errors).join(', ');
      return errorMessages || 'Error en la validación de datos';
    }

    if (error.message) {
      return error.message;
    }

    return 'Error al procesar la solicitud. Por favor intenta nuevamente.';
  }

  // ==================== BÚSQUEDA Y FILTROS ====================

  /**
   * 🔍 Método llamado cuando el usuario escribe en el buscador
   * Usa debounce para evitar parpadeos (espera 500ms después de que deje de escribir)
   */
  onSearch(): void {
    this.searchSubject$.next(this.searchTerm);
  }

  // ==================== PAGINACIÓN ====================

  /** Índice del primer producto mostrado (base-1 para la UI) */
  get startIndex(): number {
    if (this.totalProducts === 0) return 0;
    return this.currentPage * this.pageSize + 1;
  }

  /** Índice del último producto mostrado (base-1 para la UI) */
  get endIndex(): number {
    return Math.min((this.currentPage + 1) * this.pageSize, this.totalProducts);
  }

  /** Arreglo de números de página para el loop del template */
  get pageNumbers(): number[] {
    const total = this.totalPages;
    const current = this.currentPage;
    const delta = 2; // páginas a mostrar a cada lado de la actual
    const range: number[] = [];

    const left = Math.max(0, current - delta);
    const right = Math.min(total - 1, current + delta);

    for (let i = left; i <= right; i++) {
      range.push(i);
    }
    return range;
  }

  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.loadProducts();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
      this.loadProducts();
    }
  }

  previousPage(): void {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.loadProducts();
    }
  }

  changePageSize(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.pageSize = +select.value;
    this.currentPage = 0;
    this.loadProducts();
  }

  // ==================== UTILIDADES ====================

  /**
   * Guarda el estado inicial del formulario para poder compararlo
   * y detectar cambios sin guardar.
   */
  saveInitialFormState(): void {
    // Normalizar datos antes de guardar
    const state = {
      name: this.productForm.name || '',
      description: this.productForm.description || '',
      price: this.productForm.price || null,
      discountPrice: this.productForm.discountPrice || null,
      stock: this.productForm.stock || 0,
      categoryId: this.productForm.categoryId || null,
      brandId: this.productForm.brandId || null,
      model: this.productForm.model || '',
      weight: this.productForm.weight || null,
      dimensions: this.productForm.dimensions || '',
      active: !!this.productForm.active,
      featured: !!this.productForm.featured,
      detailedDescription: this.productForm.detailedDescription || '',
      customAttributes: JSON.stringify(this.productForm.customAttributes || [])
    };
    this.initialProductFormState = JSON.stringify(state);
  }

  /**
   * Compara el estado actual con el estado inicial.
   * Retorna true si hay cambios sin guardar.
   */
  hasUnsavedProductChanges(): boolean {
    // Si hay imágenes pendientes o imágenes con error
    if ((this.pendingProductImages && this.pendingProductImages.length > 0) || this.failedImagesCount > 0) {
      return true;
    }

    // Normalizar estado actual para comparación
    const currentState = {
      name: this.productForm.name || '',
      description: this.productForm.description || '',
      price: this.productForm.price || null,
      discountPrice: this.productForm.discountPrice || null,
      stock: this.productForm.stock || 0,
      categoryId: this.productForm.categoryId || null,
      brandId: this.productForm.brandId || null,
      model: this.productForm.model || '',
      weight: this.productForm.weight || null,
      dimensions: this.productForm.dimensions || '',
      active: !!this.productForm.active,
      featured: !!this.productForm.featured,
      detailedDescription: this.productForm.detailedDescription || '',
      customAttributes: JSON.stringify(this.productForm.customAttributes || [])
    };

    return JSON.stringify(currentState) !== this.initialProductFormState;
  }

  /**
   * Intercepta intentos de cierre del modal para prevenir pérdida de datos.
   */
  confirmCloseProductModal(): void {
    // 1. Bloquear cierre si hay operación en progreso
    if (this.loading || this.uploadingImage || this.isProcessingUploads) {
      Swal.fire({
        title: 'Operación en proceso',
        text: 'Hay una operación en proceso. Espera a que termine antes de cerrar.',
        icon: 'warning',
        confirmButtonColor: '#800020',
        confirmButtonText: 'Entendido',
        allowOutsideClick: false,
        allowEscapeKey: false
      });
      return;
    }

    // 2. Verificar si hay cambios sin guardar
    if (this.hasUnsavedProductChanges()) {
      Swal.fire({
        title: 'Cambios sin guardar',
        text: 'Tienes cambios sin guardar. Si cierras ahora, se perderán los cambios realizados.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Cerrar sin guardar',
        cancelButtonText: 'Seguir editando',
        allowOutsideClick: false,
        allowEscapeKey: false,
        reverseButtons: true
      }).then((result) => {
        if (result.isConfirmed) {
          // Si elige "Cerrar sin guardar"
          this.closeModal();
        }
      });
    } else {
      // 3. Cerrar directo si no hay cambios
      this.closeModal();
    }
  }

  closeModal(): void {
    this.showCreateModal = false;
    this.showEditModal = false;
    this.showDeleteModal = false;
    this.selectedProduct = null;
    this.selectedImageFile = null;
    this.imagePreview = null;
    this.errorMessage = '';
    this.clearPendingImages();
  }

  /**
   * Sanitiza un campo decimal (precios), permitiendo solo números y un punto.
   */
  sanitizeDecimalInput(event: any, field: string): void {
    let input = event.target.value;
    // Eliminar todo lo que no sea número o punto
    input = input.replace(/[^0-9.]/g, '');
    
    // Asegurar que solo haya un punto
    const parts = input.split('.');
    if (parts.length > 2) {
      input = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Limitar a 2 decimales si hay punto
    if (parts.length === 2 && parts[1].length > 2) {
      input = parts[0] + '.' + parts[1].substring(0, 2);
    }
    
    event.target.value = input;
    
    // Forzar actualización del modelo de Angular
    const numericValue = input ? parseFloat(input) : null;
    this.productForm[field] = numericValue;
    
    // Marcar que el usuario ya intentó cambiar algo para validación
    this.attemptedSave = false;
  }

  /**
   * Sanitiza un campo entero (stock), permitiendo solo números.
   */
  sanitizeIntegerInput(event: any, field: string): void {
    let input = event.target.value;
    // Eliminar todo lo que no sea número
    input = input.replace(/[^0-9]/g, '');
    
    event.target.value = input;
    
    // Forzar actualización del modelo de Angular
    const numericValue = input ? parseInt(input, 10) : 0;
    this.productForm[field] = numericValue;
    
    // Marcar que el usuario ya intentó cambiar algo
    this.attemptedSave = false;
  }

  resetForm(): void {
    this.productForm = {
      name: '',
      description: '',
      price: null,
      discountPrice: null,
      stock: 0,
      imageUrl: '',
      sku: '',
      categoryId: null,
      brandId: null,
      model: '',
      weight: null,
      dimensions: '',
      active: true,
      featured: false,
      // NUEVOS CAMPOS: Sistema híbrido
      customAttributes: [],      // Atributos dinámicos
      detailedDescription: ''    // Descripción rica HTML
    };
    this.selectedImageFile = null;
    this.imagePreview = null;
    this.productImages = []; // Limpiar galería de imágenes
    this.clearFormErrors();
  }

  // ==================== MANEJO DE IMÁGENES ====================

  /**
   * Cargar galería de imágenes desde el servidor
   */
  loadProductGallery(): void {
    if (!this.selectedProduct || !this.selectedProduct.id) return;
    
    this.adminProductService.getProductImages(this.selectedProduct.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (images) => {
        this.productImages = images.map(img => ({
          id: img.id,
          url: img.imageUrl,
          isPrimary: img.isPrimary,
          displayOrder: img.displayOrder,
          altText: img.altText,
          provider: img.provider
        }));
        
        // Actualizar imageUrl del producto si cambió la principal
        const primaryImg = this.productImages.find(i => i.isPrimary);
        if (primaryImg && this.selectedProduct) {
          this.selectedProduct.imageUrl = primaryImg.url;
        }
      },
      error: (err) => {
        console.error('Error al cargar galería:', err);
        this.showToast('error', 'Error', 'No se pudo cargar la galería del producto.', 4000);
      }
    });
  }

  /**
   * Manejar selección de archivo de imagen individual
   */
  onImageFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleImageFilesBatch(Array.from(input.files));
      input.value = ''; // Limpiar el input para poder seleccionar de nuevo
    }
  }

  /**
   * Procesar un lote de archivos de imagen respetando el límite máximo
   */
  handleImageFilesBatch(files: File[]): void {
    const currentTotal = this.productImages.length + this.pendingProductImages.length;
    const spaceLeft = this.maxImages - currentTotal;

    if (spaceLeft <= 0) {
      this.showToast('warning', 'Límite alcanzado', `Has alcanzado el máximo de ${this.maxImages} imágenes para este producto. Elimina una imagen para poder subir otra.`, 5000);
      return;
    }

    let filesToProcess = files;
    if (files.length > spaceLeft) {
      filesToProcess = files.slice(0, spaceLeft);
      if (currentTotal === 0) {
        this.showToast('warning', 'Límite alcanzado', `Máximo ${this.maxImages} imágenes por producto. Se agregaron ${spaceLeft} de ${files.length} archivos.`, 6000);
      } else {
        this.showToast('warning', 'Límite alcanzado', `Solo puedes agregar ${spaceLeft} imágenes más. Máximo ${this.maxImages} imágenes por producto.`, 6000);
      }
    }

    filesToProcess.forEach(file => this.handleImageFile(file));
  }

  /**
   * Validar y preparar imagen para subir
   */
  handleImageFile(file: File): void {
    const validation = FileValidators.validateImageFile(file);

    if (!validation.isValid) {
      this.showToast('error', 'Archivo inválido', validation.errorMessage || 'Error al validar imagen.', 7000);
      return;
    }

    // El límite máximo de 8 ya se verificó en handleImageFilesBatch para el lote,
    // pero lo mantenemos por seguridad
    const currentTotal = this.productImages.length + this.pendingProductImages.length;
    if (currentTotal >= this.maxImages) return;

    // Encolar imagen pendiente (tanto para modo creación como edición)
    const previewUrl = FileValidators.createPreviewUrl(file);
    // Si es el primer archivo de todos (incluyendo existentes), sugerirlo como principal
    const isFirst = this.productImages.length === 0 && this.pendingProductImages.length === 0;
    
    this.pendingProductImages.push({
      tempId: 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      file,
      previewUrl,
      name: file.name,
      size: file.size,
      type: file.type,
      desiredOrder: this.productImages.length + this.pendingProductImages.length + 1,
      isPrimaryCandidate: isFirst,
      uploadStatus: 'PENDING'
    });
  }

  // --- MÉTODOS PARA IMÁGENES PENDIENTES ---

  removePendingImage(index: number): void {
    if (this.pendingProductImages[index]) {
      const removed = this.pendingProductImages[index];
      FileValidators.revokePreviewUrl(removed.previewUrl);
      this.pendingProductImages.splice(index, 1);
      
      // Reasignar el primary candidate si se eliminó el que era
      if (removed.isPrimaryCandidate && this.pendingProductImages.length > 0) {
        this.pendingProductImages[0].isPrimaryCandidate = true;
      }
      
      // Actualizar desiredOrder de los restantes
      this.pendingProductImages.forEach((img, i) => img.desiredOrder = i + 1);
    }
  }

  clearPendingImages(): void {
    if (this.pendingProductImages && this.pendingProductImages.length > 0) {
      this.pendingProductImages.forEach(p => FileValidators.revokePreviewUrl(p.previewUrl));
      this.pendingProductImages = [];
    }
  }
  
  setPrimaryPendingImage(index: number): void {
    this.pendingProductImages.forEach((img, i) => {
      img.isPrimaryCandidate = (i === index);
    });
  }

  movePendingImageLeft(index: number): void {
    if (index > 0 && index < this.pendingProductImages.length) {
      const temp = this.pendingProductImages[index];
      this.pendingProductImages[index] = this.pendingProductImages[index - 1];
      this.pendingProductImages[index - 1] = temp;
      this.updatePendingOrders();
    }
  }

  movePendingImageRight(index: number): void {
    if (index >= 0 && index < this.pendingProductImages.length - 1) {
      const temp = this.pendingProductImages[index];
      this.pendingProductImages[index] = this.pendingProductImages[index + 1];
      this.pendingProductImages[index + 1] = temp;
      this.updatePendingOrders();
    }
  }

  private updatePendingOrders(): void {
    this.pendingProductImages.forEach((img, i) => {
      img.desiredOrder = i + 1;
    });
  }

  // --- MÉTODOS PARA LIGHTBOX ---

  openPendingLightbox(pendingImg: PendingProductImage): void {
    this.lightboxImage = {
      url: pendingImg.previewUrl,
      name: pendingImg.name,
      size: pendingImg.size,
      type: pendingImg.type
    };
    this.showLightbox = true;
  }

  openExistingLightbox(image: any): void {
    this.lightboxImage = {
      url: image.url,
      name: image.altText || 'Imagen de producto'
    };
    this.showLightbox = true;
  }

  closeLightbox(): void {
    this.showLightbox = false;
    this.lightboxImage = null;
  }

  /**
   * Subir la imagen seleccionada al backend
   */
  async uploadSelectedImage(): Promise<void> {
    if (!this.selectedProduct || this.pendingProductImages.length === 0) return;
    
    this.uploadingImage = true;
    let successCount = 0;
    let failedCount = 0;

    for (const pending of this.pendingProductImages) {
      pending.uploadStatus = 'UPLOADING';
      try {
        await new Promise<void>((resolve) => {
          this.adminProductService.uploadProductImage(this.selectedProduct!.id, pending.file)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (uploadRes) => {
                pending.uploadStatus = 'UPLOADED';
                successCount++;
                FileValidators.revokePreviewUrl(pending.previewUrl);
                
                if (pending.isPrimaryCandidate && uploadRes.data && uploadRes.data.id) {
                  this.adminProductService.setPrimaryProductImage(this.selectedProduct!.id, uploadRes.data.id)
                    .pipe(takeUntil(this.destroy$))
                    .subscribe();
                }
                resolve();
              },
              error: (err) => {
                pending.uploadStatus = 'FAILED';
                pending.errorMessage = this.extractErrorMessage(err);
                failedCount++;
                resolve();
              }
            });
        });
      } catch (e) {
        console.error('Error in upload loop', e);
        pending.uploadStatus = 'FAILED';
        pending.errorMessage = 'Error inesperado';
        failedCount++;
      }
    }

    this.pendingProductImages = this.pendingProductImages.filter(p => p.uploadStatus === 'FAILED');
    
    if (failedCount > 0) {
      this.showToast('warning', 'Subida completada con errores', `Se subieron ${successCount} imágenes, pero fallaron ${failedCount}.`, 6000);
    } else {
      this.showToast('success', 'Imágenes subidas', 'Las imágenes se subieron correctamente.', 3000);
    }
    
    this.uploadingImage = false;
    this.loadProductGallery();
  }

  /**
   * Establecer imagen como principal (Portada del producto)
   */
  setPrimaryImage(imageId: number): void {
    if (!this.selectedProduct) return;
    
    this.adminProductService.setPrimaryProductImage(this.selectedProduct.id, imageId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showToast('success', 'Portada actualizada', 'Esta imagen será la portada del producto.', 3000);
          this.loadProductGallery();
          this.loadProducts(); // Para actualizar la lista también
        },
        error: (err) => {
          console.error('Error al establecer portada:', err);
          this.showToast('error', 'Error', 'No se pudo actualizar la imagen principal.', 4000);
        }
      });
  }

  /**
   * Eliminar imagen de la galería
   */
  removeImage(imageId: number): void {
    if (!this.selectedProduct) return;
    
    if (confirm('¿Estás seguro de que deseas eliminar esta imagen? Esta acción no se puede deshacer.')) {
      this.adminProductService.deleteProductImage(this.selectedProduct.id, imageId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.showToast('success', 'Imagen eliminada', 'La imagen ha sido eliminada de la galería.', 3000);
            this.loadProductGallery();
          },
          error: (err) => {
            console.error('Error al eliminar imagen:', err);
            this.showToast('error', 'Error', 'No se pudo eliminar la imagen.', 4000);
          }
        });
    }
  }

  /**
   * Limpiar todas las imágenes (deprecated visualmente pero útil para resets)
   */
  clearAllImages(): void {
    this.productImages = [];
    this.clearImage();
  }

  /**
   * Limpiar imagen seleccionada para subir
   */
  clearImage(): void {
    this.selectedImageFile = null;
    FileValidators.revokePreviewUrl(this.imagePreview);
    this.imagePreview = null;
  }

  /**
   * Prevenir comportamiento por defecto en drag over
   */
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    
    // Agregar clase visual
    const uploadZone = event.currentTarget as HTMLElement;
    uploadZone.classList.add('drag-over');
  }

  /**
   * Remover efecto visual cuando sale del área
   */
  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    
    const uploadZone = event.currentTarget as HTMLElement;
    uploadZone.classList.remove('drag-over');
  }

  /**
   * Manejar soltar archivo (drag and drop)
   */
  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    // Remover clase visual
    const uploadZone = event.currentTarget as HTMLElement;
    uploadZone.classList.remove('drag-over');

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleImageFilesBatch(Array.from(files));
    }
  }

  /**
   * Subir imagen al servidor (simulado - necesitas implementar el endpoint en el backend)
   */
  async uploadImage(): Promise<string | null> {
    if (!this.selectedImageFile) {
      return this.productForm.imageUrl || null;
    }

    this.uploadingImage = true;

    try {
      // TODO: Implementar upload real al servidor
      // Por ahora convertimos a base64
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          this.uploadingImage = false;
          resolve(e.target.result);
        };
        reader.readAsDataURL(this.selectedImageFile!);
      });
    } catch (error) {
      console.error('Error al subir imagen:', error);
      this.uploadingImage = false;
      return null;
    }
  }

  navigateToBrands(): void {
    this.router.navigate(['/admin/brands']);
  }

  navigateToCategories(): void {
    this.router.navigate(['/admin/categories']);
  }

  getBrandName(brandId: number | null): string {
    if (!brandId) return '-';
    const brand = this.brands.find(b => b.id === brandId);
    return brand ? brand.name : 'N/A';
  }

  getCategoryName(categoryId: number | null): string {
    if (!categoryId) return '-';
    const category = this.categories.find(c => c.id === categoryId);
    return category ? category.name : 'N/A';
  }

  // ==================== NUEVOS MÉTODOS: ATRIBUTOS DINÁMICOS ====================

  /**
   * Agregar un nuevo atributo personalizado vacío
   */
  addAttribute(): void {
    if (!this.productForm.customAttributes) {
      this.productForm.customAttributes = [];
    }
    
    this.productForm.customAttributes.push({
      key: '',
      value: ''
    });
  }

  /**
   * Eliminar un atributo por índice
   */
  removeAttribute(index: number): void {
    if (this.productForm.customAttributes && index >= 0 && index < this.productForm.customAttributes.length) {
      this.productForm.customAttributes.splice(index, 1);
    }
  }

  /**
   * Validar que los atributos tengan tanto key como value antes de guardar
   */
  validateCustomAttributes(): boolean {
    if (!this.productForm.customAttributes || this.productForm.customAttributes.length === 0) {
      return true; // Es válido no tener atributos
    }

    // Filtrar atributos vacíos y validar los que tienen contenido
    this.productForm.customAttributes = this.productForm.customAttributes.filter((attr: any) => {
      // Si ambos están vacíos, eliminar
      if (!attr.key && !attr.value) {
        return false;
      }
      // Si solo uno está vacío, es un error
      if (!attr.key || !attr.value) {
        this.errorMessage = 'Cada característica debe tener nombre y valor';
        return true; // Mantener para mostrar error
      }
      return true;
    });

    // Verificar que todos los atributos restantes sean válidos
    const hasInvalid = this.productForm.customAttributes.some((attr: any) => !attr.key || !attr.value);
    return !hasInvalid;
  }

  // =========================================================================
  // STOCK ALERTS MODAL — Configurar notificaciones de bajo stock
  // =========================================================================

  openStockAlertsModal(): void {
    this.showStockAlertsModal = true;
    this.stockAlertsLoading = true;
    this.savingStockAlerts = false;
    this.alertStaffSearch = '';
    this.showAlertStaffDropdown = false;

    // Cargar config y empleados en paralelo desde el nuevo servicio unificado
    forkJoin({
      config: this.stockAlertsService.getConfig(),
      staff: this.stockAlertsService.getStaffRecipients(),
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: ({ config, staff }) => {
        this.stockAlertsEnabled = config.enabled;
        this.stockAlertThreshold = config.stockThreshold;
        this.allAlertStaff = staff;
        this.filteredAlertStaff = [...staff];

        // Pre-seleccionar empleados cuyos emails coincidan con los guardados
        const savedEmails = (config.notifyEmails || []).map((e: string) => e.toLowerCase());
        this.selectedAlertEmployees = staff.filter(s =>
          savedEmails.includes(s.email.toLowerCase())
        );
        this.filterAlertStaff();
        this.stockAlertsLoading = false;
      },
      error: () => {
        // Si no existe config aún, mostrar valores default
        this.stockAlertsEnabled = false;
        this.stockAlertThreshold = 10;
        this.selectedAlertEmployees = [];
        // Intentar cargar solo empleados
        this.stockAlertsService.getStaffRecipients()
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (staff) => {
              this.allAlertStaff = staff;
              this.filteredAlertStaff = [...staff];
            },
            error: () => {
              this.allAlertStaff = [];
              this.filteredAlertStaff = [];
            },
          });
        this.stockAlertsLoading = false;
      },
    });
  }

  closeStockAlertsModal(): void {
    this.showStockAlertsModal = false;
    this.showAlertStaffDropdown = false;
  }

  /** Valida si la configuración es válida para guardar */
  isStockAlertsValid(): boolean {
    if (!this.stockAlertsEnabled) return true; // Si desactivado, siempre válido
    return this.stockAlertThreshold >= 0 && this.selectedAlertEmployees.length > 0;
  }

  saveStockAlerts(): void {
    if (!this.isStockAlertsValid()) return;
    this.savingStockAlerts = true;

    const config = {
      enabled: this.stockAlertsEnabled,
      stockThreshold: this.stockAlertThreshold,
      notifyEmails: this.selectedAlertEmployees.map(e => e.email),
    };

    this.stockAlertsService.updateConfig(config)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.savingStockAlerts = false;
          this.closeStockAlertsModal();
          this.showToast('success', 'Alertas de stock', 'Configuración guardada correctamente');
        },
        error: () => {
          this.savingStockAlerts = false;
          this.showToast('error', 'Error', 'No se pudo guardar la configuración de alertas');
        },
      });
  }

  // ── Employee selector helpers ──────────────────────────────────────────

  filterAlertStaff(): void {
    const q = this.alertStaffSearch.toLowerCase().trim();
    const selectedIds = new Set(this.selectedAlertEmployees.map(e => e.id));

    this.filteredAlertStaff = this.allAlertStaff.filter(s =>
      !selectedIds.has(s.id) && (
        s.fullName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.role.toLowerCase().includes(q)
      )
    );
  }

  selectAlertEmployee(staff: StaffRecipient): void {
    if (this.selectedAlertEmployees.some(e => e.id === staff.id)) return;
    this.selectedAlertEmployees = [...this.selectedAlertEmployees, staff];
    this.alertStaffSearch = '';
    this.showAlertStaffDropdown = false;
    this.filterAlertStaff();
  }

  removeAlertEmployee(staffId: number): void {
    this.selectedAlertEmployees = this.selectedAlertEmployees.filter(e => e.id !== staffId);
    this.filterAlertStaff();
  }

  onAlertStaffFocus(): void {
    this.showAlertStaffDropdown = true;
    this.filterAlertStaff();
  }

  onAlertStaffBlur(): void {
    setTimeout(() => {
      this.showAlertStaffDropdown = false;
    }, 200);
  }

  getAlertInitials(fullName: string): string {
    if (!fullName) return '?';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  formatAlertRole(role: string): string {
    if (!role) return 'Sin rol';
    return role.replace('ROLE_', '').replace(/_/g, ' ');
  }
}
