import {
  Component, Input, Output, EventEmitter, OnDestroy, OnInit,
  ViewChild, TemplateRef,
  ApplicationRef, EmbeddedViewRef,
  ChangeDetectionStrategy
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import Swal from 'sweetalert2';

import {
  CsvImportExportService,
  CsvImportResult,
  CsvModuleType,
  CollisionRule,
  ColumnMetadata,
  ExportConfig,
  CsvImportPreview,
  CsvPreviewRow
} from '../../../services/csv-import-export.service';
import { NotificationCenterService } from '../../../core/services/notification-center.service';

const ErrorToast = Swal.mixin({
  toast: true,
  position: 'top-end',
  icon: 'error',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer);
    toast.addEventListener('mouseleave', Swal.resumeTimer);
  }
});

type ModalView = 'home' | 'export' | 'import-upload' | 'import-preview' | 'import-processing' | 'import-result';

interface SortOption {
  value: string;
  label: string;
  icon: string;
}

interface LimitOption {
  value: number;
  label: string;
}

@Component({
  selector: 'app-csv-import-export',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './csv-import-export.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./csv-import-export.component.css']
})
export class CsvImportExportComponent implements OnInit, OnDestroy {

  @Input() moduleType: CsvModuleType = 'products';
  @Output() importSuccess = new EventEmitter<void>();

  currentView: ModalView = 'home';
  isExporting = false;

  availableColumns: ColumnMetadata[] = [];
  selectedColumnKeys: Set<string> = new Set();

  sortOptions: SortOption[] = [
    { value: 'nombre', label: 'Nombre (A-Z)', icon: 'sort_by_alpha' },
    { value: 'nombre_desc', label: 'Nombre (Z-A)', icon: 'sort_by_alpha' },
    { value: 'fecha_creacion', label: 'Mas recientes', icon: 'schedule' },
    { value: 'fecha_desc', label: 'Mas antiguos', icon: 'history' },
    { value: 'stock', label: 'Stock (Mayor)', icon: 'inventory_2' },
    { value: 'stock_desc', label: 'Stock (Menor)', icon: 'inventory_2' },
    { value: 'precio', label: 'Precio (Bajo)', icon: 'payments' },
    { value: 'precio_desc', label: 'Precio (Alto)', icon: 'payments' },
  ];
  selectedSort = 'nombre';

  limitOptions: LimitOption[] = [
    { value: 50, label: '50 registros' },
    { value: 100, label: '100 registros' },
    { value: 500, label: '500 registros' },
    { value: 1000, label: '1,000 registros' },
    { value: 0, label: 'Todos' },
  ];
  selectedLimit = 0;
  customLimit: number | null = null;
  useCustomLimit = false;

  selectedFile: File | null = null;
  selectedRule: CollisionRule = 'UPDATE';

  importPreview: CsvImportPreview | null = null;
  previewError: string | null = null;
  selectedPreviewRows: Set<number> = new Set();
  allRowsSelected = true;

  importResult: CsvImportResult | null = null;
  importError: string | null = null;

  showAllPreviewRows = false;
  isDragOver = false;

  @ViewChild('modalTpl', { read: TemplateRef }) modalTpl!: TemplateRef<void>;
  private modalViewRef: EmbeddedViewRef<void> | null = null;

  constructor(
    private csvService: CsvImportExportService,
    private notifService: NotificationCenterService,
    private appRef: ApplicationRef,
  ) {}

  ngOnInit(): void {
    if (this.moduleType === 'products') {
      this.csvService.getProductColumns().subscribe({
        next: (cols) => {
          this.availableColumns = cols;
          this.selectedColumnKeys = new Set(cols.map(c => c.key));
        },
        error: () => {}
      });
    }
  }

  ngOnDestroy(): void {
    this._detachModal();
  }

  get moduleLabel(): string {
    return this.moduleType === 'products' ? 'Productos' : 'Usuarios';
  }

  get exportFilename(): string {
    const today = new Date().toISOString().slice(0, 10);
    return `${this.moduleType}_${today}.csv`;
  }

  get hasErrors(): boolean {
    return (this.importResult?.errorCount ?? 0) > 0;
  }

  get effectiveLimit(): number {
    return this.useCustomLimit && this.customLimit ? this.customLimit : this.selectedLimit;
  }

  get selectedColumnCount(): number {
    return this.selectedColumnKeys.size;
  }

  get previewValidRows(): CsvPreviewRow[] {
    return this.importPreview?.rows.filter(r => r.valid) ?? [];
  }

  get previewErrorRows(): CsvPreviewRow[] {
    return this.importPreview?.rows.filter(r => !r.valid) ?? [];
  }

  get selectedRowCount(): number {
    return this.selectedPreviewRows.size;
  }

  isColumnSelected(key: string): boolean {
    return this.selectedColumnKeys.has(key);
  }

  toggleColumn(col: ColumnMetadata): void {
    if (col.required) return;
    if (this.selectedColumnKeys.has(col.key)) {
      this.selectedColumnKeys.delete(col.key);
    } else {
      this.selectedColumnKeys.add(col.key);
    }
  }

  selectAllColumns(): void {
    this.selectedColumnKeys = new Set(this.availableColumns.map(c => c.key));
  }

  deselectOptionalColumns(): void {
    this.selectedColumnKeys = new Set(
      this.availableColumns.filter(c => c.required).map(c => c.key)
    );
  }

  onExport(): void {
    if (this.isExporting) return;
    this.isExporting = true;

    let sortBy = this.selectedSort;
    let sortDir = 'asc';
    if (sortBy.endsWith('_desc')) {
      sortBy = sortBy.replace('_desc', '');
      sortDir = 'desc';
    }

    const config: ExportConfig = {
      columns: Array.from(this.selectedColumnKeys),
      sortBy,
      sortDir,
      limit: this.effectiveLimit,
    };

    this.csvService.exportProductsWithConfig(config).subscribe({
      next: (blob) => {
        this._downloadBlob(blob, this.exportFilename);
        this.isExporting = false;
      },
      error: (err: HttpErrorResponse) => {
        console.error('[CsvComponent] Export error:', err);
        ErrorToast.fire({ title: 'Error al exportar. Intentalo de nuevo.' });
        this.isExporting = false;
      }
    });
  }

  onDownloadTemplate(): void {
    this.csvService.downloadProductTemplate().subscribe({
      next: (blob) => this._downloadBlob(blob, 'plantilla_productos.csv'),
      error: () => ErrorToast.fire({ title: 'Error al descargar la plantilla.' })
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    input.value = '';
    this._processFile(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    this._processFile(files[0]);
  }

  private _processFile(file: File): void {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      ErrorToast.fire({ title: 'El archivo debe tener extension .csv' });
      this.previewError = 'El archivo debe tener extension .csv';
      this.currentView = 'import-preview';
      this.importPreview = null;
      this.selectedFile = null;
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      ErrorToast.fire({ title: 'El archivo excede 10 MB.' });
      this.previewError = 'El archivo excede el limite de 10 MB.';
      this.currentView = 'import-preview';
      this.importPreview = null;
      this.selectedFile = null;
      return;
    }

    this.selectedFile = file;
    this.previewError = null;
    this.currentView = 'import-preview';
    this._loadServerPreview(file);
  }

  private _loadServerPreview(file: File): void {
    this.csvService.previewProductImport(file).subscribe({
      next: (preview) => {
        this.importPreview = preview;
        this.selectedPreviewRows = new Set(
          preview.rows.filter(r => r.valid).map(r => r.rowNumber)
        );
        this.allRowsSelected = this.selectedPreviewRows.size === preview.rows.filter(r => r.valid).length;
      },
      error: (err: HttpErrorResponse) => {
        const msg = err.error?.message ?? err.error?.errors?.[0] ?? 'Error al validar el archivo CSV.';
        this.previewError = msg;
        this.importPreview = null;
        ErrorToast.fire({ title: msg });
      }
    });
  }

  isRowSelected(rowNumber: number): boolean {
    return this.selectedPreviewRows.has(rowNumber);
  }

  toggleRow(rowNumber: number): void {
    if (this.selectedPreviewRows.has(rowNumber)) {
      this.selectedPreviewRows.delete(rowNumber);
    } else {
      this.selectedPreviewRows.add(rowNumber);
    }
    this._updateAllRowsSelected();
  }

  toggleAllValidRows(): void {
    const validRows = this.importPreview?.rows.filter(r => r.valid) ?? [];
    if (this.allRowsSelected) {
      this.selectedPreviewRows.clear();
      this.allRowsSelected = false;
    } else {
      this.selectedPreviewRows = new Set(validRows.map(r => r.rowNumber));
      this.allRowsSelected = true;
    }
  }

  private _updateAllRowsSelected(): void {
    const validRows = this.importPreview?.rows.filter(r => r.valid) ?? [];
    this.allRowsSelected = validRows.length > 0 &&
      validRows.every(r => this.selectedPreviewRows.has(r.rowNumber));
  }

  onConfirmImport(): void {
    if (!this.selectedFile || this.selectedPreviewRows.size === 0) return;

    this.currentView = 'import-processing';
    this.importResult = null;
    this.importError = null;

    const selectedRows = Array.from(this.selectedPreviewRows);

    this.csvService.confirmProductImport(this.selectedFile, selectedRows, this.selectedRule).subscribe({
      next: (result) => {
        this.importResult = result;
        this.currentView = 'import-result';
        this._notifyImportResult(result);
      },
      error: (err: HttpErrorResponse) => {
        const msg = err.error?.message ?? err.message ?? 'Error desconocido al importar.';
        ErrorToast.fire({ title: msg });
        this.importError = msg;
        this.currentView = 'import-result';
        this.notifService.push({
          level: 'error',
          category: 'inventory',
          title: 'Importacion CSV fallida',
          message: msg,
          persistent: true,
          actionRoute: '/admin/products',
          actionLabel: 'Ver productos',
        });
      }
    });
  }

  private _notifyImportResult(result: CsvImportResult): void {
    if (result.successCount > 0) {
      this.notifService.push({
        level: 'success',
        category: 'inventory',
        title: 'Importacion completada: ' + result.successCount + ' productos',
        message: result.insertedCount > 0 && result.updatedCount > 0
          ? result.insertedCount + ' nuevos, ' + result.updatedCount + ' actualizados.'
          : result.insertedCount > 0
            ? result.insertedCount + ' productos nuevos importados.'
            : result.updatedCount + ' productos actualizados.',
        persistent: false,
        actionRoute: '/admin/products',
        actionLabel: 'Ver productos',
      });
    }

    if (result.errorCount > 0) {
      this.notifService.push({
        level: 'error',
        category: 'inventory',
        title: result.errorCount + ' filas con errores en la importacion',
        message: 'Algunas filas del CSV no pudieron procesarse.',
        persistent: true,
        actionRoute: '/admin/products',
        actionLabel: 'Ver detalles',
      });
    }
  }

  goTo(view: ModalView): void {
    this.currentView = view;
  }

  goHome(): void {
    this.currentView = 'home';
  }

  onReset(): void {
    this.currentView = 'home';
    this.selectedFile = null;
    this.importPreview = null;
    this.previewError = null;
    this.importResult = null;
    this.importError = null;
    this.selectedPreviewRows.clear();
    this.allRowsSelected = true;
    this.showAllPreviewRows = false;
    this.isDragOver = false;
  }

  openModal(): void {
    if (this.modalViewRef) return;
    if (this.availableColumns.length === 0 && this.moduleType === 'products') {
      this.csvService.getProductColumns().subscribe({
        next: (cols) => {
          this.availableColumns = cols;
          this.selectedColumnKeys = new Set(cols.map(c => c.key));
        }
      });
    }

    const view = this.modalTpl.createEmbeddedView(undefined);
    this.appRef.attachView(view);
    view.detectChanges();
    view.rootNodes.forEach((node: Node) => document.body.appendChild(node));
    this.modalViewRef = view;
    document.body.style.overflow = 'hidden';
  }

  private _detachModal(): void {
    if (!this.modalViewRef) return;
    this.modalViewRef.rootNodes.forEach((node: Node) => {
      if (node.parentNode === document.body) document.body.removeChild(node);
    });
    this.appRef.detachView(this.modalViewRef);
    this.modalViewRef.destroy();
    this.modalViewRef = null;
    document.body.style.overflow = '';
  }

  closeModal(): void {
    this._detachModal();
    this.onReset();
  }

  onCloseAndReload(): void {
    this.importSuccess.emit();
    this.closeModal();
  }

  private _downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  getPreviewHeaders(): string[] {
    return this.importPreview?.headers ?? [];
  }

  getCellValue(row: CsvPreviewRow, header: string): string {
    return row.cells?.[header] ?? '';
  }

  trackByRowNumber(_: number, row: CsvPreviewRow): number {
    return row.rowNumber;
  }
}