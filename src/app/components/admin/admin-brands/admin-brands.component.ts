import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { BrandService } from '../../../services/brand.service';
import { FileUploadService } from '../../../services/file-upload.service';
import { AuthService } from '../../../services/auth.service';
import {
  BrandDTO,
  CreateBrandRequest,
  BrandListResponse
} from '../../../models/brand.model';
import { FileValidators } from '../../../utils/file-validators';
import Swal from 'sweetalert2';

export type UploadStatus = 'PENDING' | 'UPLOADING' | 'UPLOADED' | 'FAILED';

export interface PendingBrandLogo {
  file: File;
  previewUrl: string;
  name: string;
  size: number;
  type: string;
  uploadStatus: UploadStatus;
  errorMessage?: string;
}

/**
 * Componente para gestión completa de marcas (CRUD)
 * Funcionalidades: Crear, Listar, Editar, Eliminar, Búsqueda
 */
@Component({
  selector: 'app-admin-brands',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-brands.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./admin-brands.component.css']
})
export class AdminBrandsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Estado
  brands: BrandDTO[] = [];
  loading = false;
  showCreateModal = false;
  showEditModal = false;
  showDeleteModal = false;

  // ── ESTADO DE SUBIDA PROFESIONAL (OVERLAY) ──
  isProcessingUploads = false;
  uploadProgressMessage = '';
  partialErrorState = false;

  // Paginación
  currentPage = 0;
  pageSize = 10;
  totalBrands = 0;
  totalPages = 0;
  readonly pageSizeOptions = [5, 10, 20, 50];

  get startIndex(): number {
    return this.totalBrands === 0 ? 0 : this.currentPage * this.pageSize + 1;
  }

  get endIndex(): number {
    return Math.min((this.currentPage + 1) * this.pageSize, this.totalBrands);
  }

  get pageNumbers(): number[] {
    const pages: number[] = [];
    const start = Math.max(0, this.currentPage - 2);
    const end = Math.min(this.totalPages - 1, this.currentPage + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  changePageSize(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.pageSize = +select.value;
    this.currentPage = 0;
    this.loadBrands();
  }

  // Búsqueda y filtros
  searchTerm = '';
  filterActive: boolean | null = null;
  filterCountry = '';

  // Formulario
  brandForm: CreateBrandRequest = {
    name: '',
    description: '',
    logoUrl: '',
    websiteUrl: '',
    countryOrigin: '',
    active: true
  };

  initialBrandFormState: string = '';

  pendingBrandLogo: PendingBrandLogo | null = null;
  
  selectedBrand: BrandDTO | null = null;

  // Variables Lightbox (Vista Ampliada)
  showLightbox = false;
  lightboxImage: { url: string; name: string; size?: number; type?: string } | null = null;

  // Mensajes
  successMessage = '';
  errorMessage = '';

  // Getters para el template (evitar arrow functions en HTML)
  get activeBrandsCount(): number {
    return this.brands.filter(b => b.active).length;
  }

  get totalProductsCount(): number {
    return this.brands.reduce((sum, b) => sum + b.productCount, 0);
  }

  constructor(
    private brandService: BrandService,
    private router: Router,
    private route: ActivatedRoute,
    private fileUploadService: FileUploadService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadBrands();

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
    // Limpiar URLs de preview en memoria
    if (this.pendingBrandLogo) {
      FileValidators.revokePreviewUrl(this.pendingBrandLogo.previewUrl);
    }
    this.closeLightbox();
  }

  // ==================== CRUD OPERATIONS ====================

  loadBrands(): void {
    this.loading = true;
    this.errorMessage = '';

    if (this.searchTerm || this.filterActive !== null || this.filterCountry) {
      // Búsqueda con filtros
      this.brandService.searchBrands(
        this.searchTerm || undefined,
        this.filterActive !== null ? this.filterActive : undefined,
        this.filterCountry || undefined,
        this.currentPage,
        this.pageSize
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: BrandListResponse) => {
          this.brands = response.brands;
          this.totalBrands = response.totalBrands;
          this.totalPages = response.totalPages;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error al buscar marcas:', error);
          this.errorMessage = 'Error al buscar marcas';
          this.loading = false;
        }
      });
    } else {
      // Carga normal
      this.brandService.getAllBrands(this.currentPage, this.pageSize)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response: BrandListResponse) => {
            this.brands = response.brands;
            this.totalBrands = response.totalBrands;
            this.totalPages = response.totalPages;
            this.loading = false;
          },
          error: (error) => {
            console.error('Error al cargar marcas:', error);
            this.errorMessage = 'Error al cargar marcas';
            this.loading = false;
          }
        });
    }
  }

  openCreateModal(): void {
    this.brandForm = {
      name: '',
      description: '',
      logoUrl: '',
      websiteUrl: '',
      countryOrigin: '',
      active: true
    };
    this.saveInitialFormState();
    if (this.pendingBrandLogo) {
      FileValidators.revokePreviewUrl(this.pendingBrandLogo.previewUrl);
    }
    this.pendingBrandLogo = null;
    this.showCreateModal = true;
    this.errorMessage = '';
    this.isProcessingUploads = false;
    this.partialErrorState = false;
  }

  openEditModal(brand: BrandDTO): void {
    this.selectedBrand = brand;
    this.brandForm = {
      name: brand.name,
      description: brand.description || '',
      logoUrl: brand.logoUrl || '',
      websiteUrl: brand.websiteUrl || '',
      countryOrigin: brand.countryOrigin || '',
      active: brand.active
    };
    this.saveInitialFormState();
    if (this.pendingBrandLogo) {
      FileValidators.revokePreviewUrl(this.pendingBrandLogo.previewUrl);
    }
    this.pendingBrandLogo = null;
    this.showEditModal = true;
    this.errorMessage = '';
    this.isProcessingUploads = false;
    this.partialErrorState = false;
  }

  openDeleteModal(brand: BrandDTO): void {
    this.selectedBrand = brand;
    this.showDeleteModal = true;
    this.errorMessage = '';
  }

  saveBrand(): void {
    if (!this.brandForm.name.trim()) {
      this.errorMessage = 'El nombre de la marca es obligatorio';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const payload = { ...this.brandForm };

    if (this.showCreateModal) {
      // Crear nueva marca
      this.isProcessingUploads = true;
      this.uploadProgressMessage = 'Creando marca...';

      this.brandService.createBrand(payload)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (createdBrand) => {
            if (this.pendingBrandLogo) {
              // Hay logo pendiente: subirlo ahora
              this.uploadProgressMessage = 'Subiendo logo...';
              this.brandService.uploadBrandLogo(createdBrand.id, this.pendingBrandLogo.file)
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                    next: (logoResponse: any) => {
                      this.successMessage = 'Marca y logo creados exitosamente.';
                      this.showCreateModal = false;
                      this.selectedBrand = createdBrand;
                      this.selectedBrand.logoUrl = logoResponse.data?.secureUrl || '';
                      this.selectedBrand.logoProvider = logoResponse.data?.provider || '';
                      this.brandForm.logoUrl = this.selectedBrand.logoUrl;
                      FileValidators.revokePreviewUrl(this.pendingBrandLogo!.previewUrl);
                      this.pendingBrandLogo = null;
                      this.loading = false;
                      this.isProcessingUploads = false;
                      this.loadBrands();
                      setTimeout(() => this.successMessage = '', 4000);
                  },
                    error: (logoError) => {
                      // Falló el logo, pero la marca se creó
                      console.error('Error al subir logo inicial:', logoError);
                      this.partialErrorState = true;
                      this.errorMessage = 'La marca se creó, pero hubo un error al subir el logo. Puedes reintentar.';
                      this.showCreateModal = false;
                      this.selectedBrand = createdBrand;
                      this.showEditModal = true;
                      
                      // Mantener estado FAILED en logo pendiente
                      if (this.pendingBrandLogo) {
                        this.pendingBrandLogo.uploadStatus = 'FAILED';
                        this.pendingBrandLogo.errorMessage = logoError.error?.error || logoError.error?.message || 'Error al subir';
                      }
                      
                      this.loading = false;
                      this.isProcessingUploads = false;
                      this.loadBrands();
                    }
                });
            } else {
              // No hay logo pendiente, solo transicionar a edición (o cerrar)
              this.successMessage = 'Marca creada exitosamente.';
              this.showCreateModal = false;
              this.loading = false;
              this.isProcessingUploads = false;
              this.loadBrands();
              setTimeout(() => this.successMessage = '', 3000);
            }
          },
          error: (error) => {
            console.error('Error al crear marca:', error);
            this.errorMessage = error.error?.message || 'Error al crear la marca';
            this.loading = false;
            this.isProcessingUploads = false;
          }
        });
    } else if (this.showEditModal && this.selectedBrand) {
      // Actualizar marca existente
      this.brandService.updateBrand(this.selectedBrand.id, payload)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (updatedBrand) => {
            this.successMessage = 'Marca actualizada exitosamente';
            this.showEditModal = false;
            this.selectedBrand = null;
            this.loadBrands();
            this.loading = false;
            setTimeout(() => this.successMessage = '', 3000);
          },
          error: (error) => {
          console.error('Error al actualizar marca:', error);
          this.errorMessage = error.error?.message || 'Error al actualizar la marca';
          this.loading = false;
        }
      });
    }
  }

  // --- MÉTODOS PARA LIGHTBOX ---

  openPendingLightbox(): void {
    if (this.pendingBrandLogo) {
      this.lightboxImage = {
        url: this.pendingBrandLogo.previewUrl,
        name: this.pendingBrandLogo.name,
        size: this.pendingBrandLogo.size,
        type: this.pendingBrandLogo.type
      };
      this.showLightbox = true;
    }
  }

  openExistingLightbox(url: string, name: string): void {
    this.lightboxImage = {
      url: url,
      name: name || 'Logo de marca'
    };
    this.showLightbox = true;
  }

  closeLightbox(): void {
    this.showLightbox = false;
    this.lightboxImage = null;
  }

  // ==================== IMAGE HANDLING ====================

  onLogoFileSelected(event: any): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }
    const validation = FileValidators.validateImageFile(file);
    if (!validation.isValid) {
      this.errorMessage = validation.errorMessage || 'Error de archivo';
      return;
    }

    if (this.pendingBrandLogo) {
      FileValidators.revokePreviewUrl(this.pendingBrandLogo.previewUrl);
    }
    
    this.pendingBrandLogo = {
      file: file,
      previewUrl: FileValidators.createPreviewUrl(file),
      name: file.name,
      size: file.size,
      type: file.type,
      uploadStatus: 'PENDING'
    };
    this.errorMessage = '';
  }

  clearLogoSelection(): void {
    if (this.pendingBrandLogo) {
      FileValidators.revokePreviewUrl(this.pendingBrandLogo.previewUrl);
      this.pendingBrandLogo = null;
    }
  }

  uploadSelectedLogo(): void {
    if (!this.selectedBrand || !this.pendingBrandLogo) return;

    this.pendingBrandLogo.uploadStatus = 'UPLOADING';
    this.brandService.uploadBrandLogo(this.selectedBrand.id, this.pendingBrandLogo.file)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.pendingBrandLogo!.uploadStatus = 'UPLOADED';
          FileValidators.revokePreviewUrl(this.pendingBrandLogo!.previewUrl);
          this.pendingBrandLogo = null;
          
          if (this.selectedBrand) {
            this.selectedBrand.logoUrl = response.data?.secureUrl || '';
            this.selectedBrand.logoProvider = response.data?.provider;
            this.brandForm.logoUrl = this.selectedBrand.logoUrl;
          }
          this.successMessage = 'El logo se guardó correctamente.';
          setTimeout(() => this.successMessage = '', 4000);
        },
        error: (err) => {
          if (this.pendingBrandLogo) {
            this.pendingBrandLogo.uploadStatus = 'FAILED';
            this.pendingBrandLogo.errorMessage = err.error?.error || err.error?.message || 'Error al subir el logo.';
          }
          this.errorMessage = 'No se pudo guardar la imagen.';
          setTimeout(() => this.errorMessage = '', 7000);
        }
      });
  }

  cancelLogoUpload(): void {
    if (this.pendingBrandLogo) {
      FileValidators.revokePreviewUrl(this.pendingBrandLogo.previewUrl);
      this.pendingBrandLogo = null;
    }
  }

  removeLogo(): void {
    if (!this.selectedBrand || !this.brandForm.logoUrl) return;

    if (confirm('¿Estás seguro de que deseas eliminar este logo? Esta acción no se puede deshacer.')) {
      this.loading = true;
      this.brandService.deleteBrandLogo(this.selectedBrand.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.successMessage = 'Logo eliminado exitosamente';
            this.brandForm.logoUrl = '';
            if (this.selectedBrand) {
              this.selectedBrand.logoUrl = '';
            }
            this.loading = false;
            this.loadBrands();
            setTimeout(() => this.successMessage = '', 3000);
          },
          error: (error) => {
            console.error('Error al eliminar logo:', error);
            this.errorMessage = error.error?.message || 'Error al eliminar el logo';
            this.loading = false;
          }
        });
    }
  }

  deleteBrand(): void {
    if (!this.selectedBrand) return;

    this.loading = true;
    this.errorMessage = '';

    this.brandService.deleteBrand(this.selectedBrand.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.successMessage = 'Marca eliminada exitosamente';
          this.showDeleteModal = false;
          this.selectedBrand = null;
          this.loadBrands();
          setTimeout(() => this.successMessage = '', 3000);
        },
        error: (error) => {
          console.error('Error al eliminar marca:', error);
          this.errorMessage = error.error?.message || 'Error al eliminar la marca';
          this.loading = false;
        }
      });
  }

  toggleStatus(brand: BrandDTO): void {
    this.brandService.toggleBrandStatus(brand.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.successMessage = `Marca ${brand.active ? 'desactivada' : 'activada'} exitosamente`;
          this.loadBrands();
          setTimeout(() => this.successMessage = '', 3000);
        },
        error: (error) => {
          console.error('Error al cambiar estado:', error);
          this.errorMessage = 'Error al cambiar el estado de la marca';
        }
      });
  }

  // ==================== BÚSQUEDA Y FILTROS ====================

  onSearch(): void {
    this.currentPage = 0;
    this.loadBrands();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.filterActive = null;
    this.filterCountry = '';
    this.currentPage = 0;
    this.loadBrands();
  }

  // ==================== PAGINACIÓN ====================

  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.loadBrands();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
      this.loadBrands();
    }
  }

  previousPage(): void {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.loadBrands();
    }
  }

  // ==================== UTILIDADES ====================

  saveInitialFormState(): void {
    const state = {
      name: this.brandForm.name || '',
      description: this.brandForm.description || '',
      logoUrl: this.brandForm.logoUrl || '',
      websiteUrl: this.brandForm.websiteUrl || '',
      countryOrigin: this.brandForm.countryOrigin || '',
      active: !!this.brandForm.active
    };
    this.initialBrandFormState = JSON.stringify(state);
  }

  hasUnsavedBrandChanges(): boolean {
    if (this.pendingBrandLogo) {
      return true;
    }
    const currentState = {
      name: this.brandForm.name || '',
      description: this.brandForm.description || '',
      logoUrl: this.brandForm.logoUrl || '',
      websiteUrl: this.brandForm.websiteUrl || '',
      countryOrigin: this.brandForm.countryOrigin || '',
      active: !!this.brandForm.active
    };
    return JSON.stringify(currentState) !== this.initialBrandFormState;
  }

  confirmCloseBrandModal(): void {
    if (this.loading || this.isProcessingUploads || (this.pendingBrandLogo && this.pendingBrandLogo.uploadStatus === 'UPLOADING')) {
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

    if (this.hasUnsavedBrandChanges()) {
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
          this.closeModal();
        }
      });
    } else {
      this.closeModal();
    }
  }

  closeModal(): void {
    this.showCreateModal = false;
    this.showEditModal = false;
    this.showDeleteModal = false;
    this.selectedBrand = null;
    this.errorMessage = '';
    if (this.pendingBrandLogo) {
      FileValidators.revokePreviewUrl(this.pendingBrandLogo.previewUrl);
      this.pendingBrandLogo = null;
    }
  }

  private clearActionParam(): void {
    this.router.navigate([], {
      queryParams: { action: null },
      queryParamsHandling: 'merge'
    });
  }

  navigateToProducts(brandId: number): void {
    this.router.navigate(['/admin/products'], { queryParams: { brandId } });
  }
}
