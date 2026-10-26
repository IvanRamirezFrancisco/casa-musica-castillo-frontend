import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil, finalize } from 'rxjs';
import { CategoryService } from '../../../services/category.service';
import { AuthService } from '../../../services/auth.service';
import { Category, CreateCategoryRequest, UpdateCategoryRequest } from '../../../models/category.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin-categories',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-categories.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./admin-categories.component.css']
})
export class AdminCategoriesComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
  categories: Category[] = [];
  filteredCategories: Category[] = [];
  
  // Tree Grid State
  expandedCategories: Set<number> = new Set<number>();
  visibleCategories: Category[] = [];

  // UI State
  loading = false;
  successMessage = '';
  errorMessage = '';

  // Smart Filters
  searchTerm = '';
  statusFilter: 'ALL' | 'ACTIVE' | 'INACTIVE' = 'ALL';
  typeFilter: 'ALL' | 'MAIN' | 'SUBCATEGORY' = 'ALL';
  childrenFilter: 'ALL' | 'WITH_CHILDREN' | 'NO_CHILDREN' = 'ALL';

  // Modals
  showCreateModal = false;
  showEditModal = false;
  showDeleteModal = false;

  // Form
  categoryForm: CreateCategoryRequest = {
    name: '',
    description: '',
    imageUrl: '',
    active: true,
    parentId: null
  };
  initialCategoryFormState = '';
  selectedCategory: Category | null = null;

  // Image Upload
  @ViewChild('fileInput') fileInput!: ElementRef;
  selectedFile: File | null = null;
  previewUrl: string | ArrayBuffer | null = null;
  isUploadingImage = false;
  imageUploadError = '';

  // Stats
  activeCategoriesCount = 0;
  totalProductsCount = 0;

  constructor(
    private categoryService: CategoryService,
    public authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.loadCategories();

    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        if (params['action'] === 'create' && !this.showCreateModal) {
          this.openCreateModal();
          this.clearActionParam();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== LOAD ====================
  loadCategories(): void {
    this.loading = true;
    this.errorMessage = '';

    this.categoryService.getAllCategories()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (categories) => {
          this.categories = categories.map(cat => {
            // Asegurar que subcategoryCount esté inicializado
            return {
              ...cat,
              hasChildren: (cat.subcategoryCount ?? 0) > 0,
              level: cat.parentId ? 1 : 0
            };
          });
          this.calculateStatistics();
          this.applyFilters();
          this.loading = false;
        },
        error: (error) => {
          this.errorMessage = `Error al cargar categorías: ${error.error?.message || error.message}`;
          this.loading = false;
        }
      });
  }

  calculateStatistics(): void {
    this.activeCategoriesCount = this.categories.filter(c => c.active).length;
    this.totalProductsCount = this.categories.reduce((sum, c) => sum + (c.productCount || 0), 0);
  }

  // ==================== SMART SEARCH & FILTERS ====================
  onSearch(): void {
    this.applyFilters();
  }

  applyFilters(): void {
    let results = [...this.categories];

    // Status Filter
    if (this.statusFilter === 'ACTIVE') results = results.filter(c => c.active);
    else if (this.statusFilter === 'INACTIVE') results = results.filter(c => !c.active);

    // Type Filter
    if (this.typeFilter === 'MAIN') results = results.filter(c => !c.parentId);
    else if (this.typeFilter === 'SUBCATEGORY') results = results.filter(c => c.parentId);

    // Children Filter
    if (this.childrenFilter === 'WITH_CHILDREN') results = results.filter(c => c.hasChildren);
    else if (this.childrenFilter === 'NO_CHILDREN') results = results.filter(c => !c.hasChildren);

    // Search Term Filter
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      results = results.filter(category => {
        const matchName = category.name.toLowerCase().includes(term);
        const matchDesc = category.description?.toLowerCase().includes(term);
        const matchParent = category.parentName?.toLowerCase().includes(term);
        return matchName || matchDesc || matchParent;
      });

      // Auto-expand parents if children match search
      results.forEach(c => {
        if (c.parentId) {
          this.expandedCategories.add(c.parentId);
        }
      });
    } else {
      // Si limpiamos la búsqueda, contraemos todo
      this.expandedCategories.clear();
    }

    this.filteredCategories = results;
    this.buildTreeGrid();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.statusFilter = 'ALL';
    this.typeFilter = 'ALL';
    this.childrenFilter = 'ALL';
    this.expandedCategories.clear();
    this.applyFilters();
  }

  // ==================== TREE GRID BUILDER ====================
  buildTreeGrid(): void {
    // Si hay búsqueda o filtros fuertes, mostramos los filtrados directamente (pero respetando jerarquía)
    const isFiltered = this.searchTerm.trim() !== '' || this.typeFilter !== 'ALL' || this.childrenFilter !== 'ALL';
    
    if (isFiltered) {
      // Mostramos la lista plana con contexto si está filtrada intensamente
      this.visibleCategories = this.filteredCategories.sort((a, b) => {
        const nameA = a.parentName ? `${a.parentName} ${a.name}` : a.name;
        const nameB = b.parentName ? `${b.parentName} ${b.name}` : b.name;
        return nameA.localeCompare(nameB);
      });
      return;
    }

    // Si es vista normal (sin filtros complejos), mostramos el árbol interactivo
    const roots = this.filteredCategories.filter(c => !c.parentId).sort((a, b) => a.name.localeCompare(b.name));
    const tree: Category[] = [];

    for (const root of roots) {
      tree.push(root);
      if (this.expandedCategories.has(root.id)) {
        const children = this.filteredCategories
          .filter(c => c.parentId === root.id)
          .sort((a, b) => a.name.localeCompare(b.name));
        tree.push(...children);
      }
    }
    
    this.visibleCategories = tree;
  }

  toggleExpand(categoryId: number): void {
    if (this.expandedCategories.has(categoryId)) {
      this.expandedCategories.delete(categoryId);
    } else {
      this.expandedCategories.add(categoryId);
    }
    this.buildTreeGrid();
  }

  isExpanded(categoryId: number): boolean {
    return this.expandedCategories.has(categoryId);
  }

  // ==================== UI STATE ====================
  private clearActionParam(): void {
    this.router.navigate([], {
      queryParams: { action: null },
      queryParamsHandling: 'merge'
    });
  }

  // ==================== MODALS ====================
  openCreateModal(): void {
    this.resetForm();
    this.saveInitialFormState();
    this.showCreateModal = true;
    this.errorMessage = '';
  }

  openEditModal(category: Category): void {
    this.selectedCategory = category;
    this.categoryForm = {
      name: category.name,
      description: category.description || '',
      imageUrl: category.imageUrl || '',
      active: category.active,
      parentId: category.parentId || null
    };
    this.previewUrl = category.imageUrl || null;
    this.saveInitialFormState();
    this.showEditModal = true;
    this.errorMessage = '';
  }

  // ==================== IMAGE UPLOAD ====================
  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (file) {
      this.imageUploadError = '';
      
      // Validate Type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        this.imageUploadError = 'Formato no soportado. Usa JPG, PNG o WEBP.';
        return;
      }
      
      // Validate Size (2MB)
      if (file.size > 2 * 1024 * 1024) {
        this.imageUploadError = 'La imagen excede el límite de 2MB.';
        return;
      }

      this.selectedFile = file;

      // Preview
      const reader = new FileReader();
      reader.onload = () => {
        this.previewUrl = reader.result;
      };
      reader.readAsDataURL(file);
    }
  }

  triggerFileInput(): void {
    if (this.fileInput) {
      this.fileInput.nativeElement.click();
    }
  }

  removeImage(): void {
    this.selectedFile = null;
    this.previewUrl = null;
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
    this.categoryForm.imageUrl = '';
  }

  // ==================== SAVE ====================
  saveCategory(): void {
    if (!this.validateForm()) return;
    this.loading = true;
    this.errorMessage = '';

    if (this.showCreateModal) {
      this.categoryService.createCategory(this.categoryForm)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (created) => {
            if (this.selectedFile) {
              this.uploadImageAndFinish(created.id, 'Categoría creada exitosamente');
            } else {
              this.finishSave('Categoría creada exitosamente');
            }
          },
          error: (error) => {
            this.errorMessage = error.error?.message || 'Error al crear la categoría';
            this.loading = false;
          }
        });
    } else if (this.showEditModal && this.selectedCategory) {
      this.categoryService.updateCategory(this.selectedCategory.id, this.categoryForm)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (updated) => {
            if (this.selectedFile) {
              this.uploadImageAndFinish(updated.id, 'Categoría actualizada exitosamente');
            } else if (!this.previewUrl && this.selectedCategory?.imagePublicId) {
              // El usuario borró la imagen existente
              this.deleteImageAndFinish(updated.id, 'Categoría actualizada exitosamente');
            } else {
              this.finishSave('Categoría actualizada exitosamente');
            }
          },
          error: (error) => {
            this.errorMessage = error.error?.message || 'Error al actualizar la categoría';
            this.loading = false;
          }
        });
    }
  }

  private uploadImageAndFinish(categoryId: number, successMsg: string): void {
    if (!this.selectedFile) return;
    this.isUploadingImage = true;
    this.categoryService.uploadCategoryImage(categoryId, this.selectedFile)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isUploadingImage = false)
      )
      .subscribe({
        next: () => this.finishSave(successMsg),
        error: (error) => {
          console.error('Error uploading image', error);
          this.errorMessage = 'La categoría fue guardada, pero no se pudo subir la imagen. Puedes intentarlo nuevamente al editarla.';
          this.loadCategories();
          this.loading = false;
        }
      });
  }

  private deleteImageAndFinish(categoryId: number, successMsg: string): void {
    this.categoryService.deleteCategoryImage(categoryId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.finishSave(successMsg),
        error: (error) => {
          console.error('Error deleting image', error);
          this.finishSave(successMsg); // De todas formas terminamos
        }
      });
  }

  private finishSave(message: string): void {
    this.successMessage = message;
    this.showCreateModal = false;
    this.showEditModal = false;
    this.resetForm();
    this.loadCategories();
    this.loading = false;
    setTimeout(() => this.successMessage = '', 4000);
  }

  // ==================== DELETE ====================
  openDeleteModal(category: Category): void {
    this.selectedCategory = category;
    this.showDeleteModal = true;
    this.errorMessage = '';
  }

  deleteCategory(): void {
    if (!this.selectedCategory) return;
    this.loading = true;
    this.errorMessage = '';

    this.categoryService.deleteCategory(this.selectedCategory.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.successMessage = '🗑️ Categoría eliminada exitosamente';
          this.showDeleteModal = false;
          this.selectedCategory = null;
          this.loadCategories();
          setTimeout(() => this.successMessage = '', 4000);
        },
        error: (error) => {
          this.errorMessage = error.error?.message || error.error || 'Error al eliminar la categoría';
          this.loading = false;
        }
      });
  }

  toggleStatus(category: Category): void {
    const req: UpdateCategoryRequest = { active: !category.active };
    this.categoryService.updateCategory(category.id, req)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.successMessage = `Categoría ${req.active ? 'activada' : 'desactivada'} exitosamente`;
          this.loadCategories();
          setTimeout(() => this.successMessage = '', 3000);
        },
        error: (error) => {
          this.errorMessage = error.error?.message || 'Error al cambiar estado';
        }
      });
  }

  // ==================== VALIDATION & UTILS ====================
  validateForm(): boolean {
    if (!this.categoryForm.name || this.categoryForm.name.trim().length < 2) {
      this.errorMessage = 'El nombre de la categoría debe tener al menos 2 caracteres';
      return false;
    }
    if (this.categoryForm.name.length > 100) {
      this.errorMessage = 'El nombre no puede exceder los 100 caracteres';
      return false;
    }
    if (this.selectedCategory && this.categoryForm.parentId === this.selectedCategory.id) {
      this.errorMessage = 'Una categoría no puede ser padre de sí misma';
      return false;
    }
    return true;
  }

  resetForm(): void {
    this.categoryForm = {
      name: '',
      description: '',
      imageUrl: '',
      active: true,
      parentId: null
    };
    this.selectedCategory = null;
    this.selectedFile = null;
    this.previewUrl = null;
    this.imageUploadError = '';
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  closeModal(): void {
    this.showCreateModal = false;
    this.showEditModal = false;
    this.showDeleteModal = false;
    this.selectedCategory = null;
    this.errorMessage = '';
  }

  saveInitialFormState(): void {
    const state = { ...this.categoryForm };
    this.initialCategoryFormState = JSON.stringify(state);
  }

  hasUnsavedCategoryChanges(): boolean {
    if (this.selectedFile) return true; // Si hay imagen nueva, hay cambios
    const currentState = { ...this.categoryForm };
    return JSON.stringify(currentState) !== this.initialCategoryFormState;
  }

  confirmCloseCategoryModal(): void {
    if (this.loading) {
      Swal.fire({
        title: 'Operación en proceso',
        text: 'Espera a que termine antes de cerrar.',
        icon: 'warning',
        confirmButtonColor: '#800020'
      });
      return;
    }
    if (this.hasUnsavedCategoryChanges()) {
      Swal.fire({
        title: 'Cambios sin guardar',
        text: 'Si cierras ahora, se perderán los cambios realizados.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Cerrar sin guardar',
        cancelButtonText: 'Seguir editando'
      }).then((result) => {
        if (result.isConfirmed) this.closeModal();
      });
    } else {
      this.closeModal();
    }
  }

  navigateToProducts(categoryId: number): void {
    this.router.navigate(['/admin/products'], { queryParams: { categoryId } });
  }

  /**
   * Selector para jerarquía en el modal de edición/creación
   * Excluye a sí misma y a sus hijos en caso de edición para evitar ciclos
   */
  getValidParentOptions(): Category[] {
    const roots = this.categories.filter(c => !c.parentId && c.active);
    if (!this.selectedCategory) return roots;
    // Si estamos editando, excluirse a sí misma. 
    // Como la jerarquía actual es de 2 niveles (raíz -> hijo), solo evitamos asignarla a sí misma.
    // Si existieran más niveles, habría que filtrar descendientes también.
    return roots.filter(c => c.id !== this.selectedCategory!.id);
  }

  /**
   * Obtener el nombre de la categoría padre
   */
  getParentCategoryName(parentId: number | null | undefined): string {
    if (!parentId) return '';
    const parent = this.categories.find(c => c.id === parentId);
    return parent ? parent.name : '';
  }
}
