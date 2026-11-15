import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// -- Interfaces (match con DTOs Java) --

export interface CsvRowError {
  rowNumber: number;
  rawValue:  string;
  reason:    string;
}

export interface CsvImportResult {
  totalRows:     number;
  successCount:  number;
  insertedCount: number;
  updatedCount:  number;
  errorCount:    number;
  errors:        CsvRowError[];
}

export interface ColumnMetadata {
  key:      string;
  label:    string;
  required: boolean;
}

export interface ExportConfig {
  columns: string[];
  sortBy:  string;
  sortDir: string;
  limit:   number;
}

export interface CsvPreviewRow {
  rowNumber: number;
  cells:     Record<string, string>;
  valid:     boolean;
  errors:    string[];
}

export interface CsvImportPreview {
  headers:    string[];
  rows:       CsvPreviewRow[];
  totalRows:  number;
  validCount: number;
  errorCount: number;
  fileName:   string;
  fileSizeKb: number;
}

export type CollisionRule = 'UPDATE' | 'SKIP';
export type CsvModuleType = 'products' | 'users';

// -- Service --
@Injectable({ providedIn: 'root' })
export class CsvImportExportService {

  private readonly base = `${environment.apiUrl}/admin/csv`;

  constructor(private http: HttpClient) {}

  exportData(module: CsvModuleType): Observable<Blob> {
    return this.http.get(`${this.base}/export/${module}`, {
      responseType: 'blob'
    });
  }

  getProductColumns(): Observable<ColumnMetadata[]> {
    return this.http.get<ColumnMetadata[]>(`${this.base}/export/columns/products`);
  }

  exportProductsWithConfig(config: ExportConfig): Observable<Blob> {
    return this.http.post(`${this.base}/export/products/download`, config, {
      responseType: 'blob'
    });
  }

  importData(module: CsvModuleType, file: File, rule: CollisionRule = 'UPDATE'): Observable<CsvImportResult> {
    const form = new FormData();
    form.append('file', file, file.name);
    if (module === 'products') {
      form.append('rule', rule);
    }
    return this.http.post<CsvImportResult>(`${this.base}/import/${module}`, form);
  }

  previewProductImport(file: File): Observable<CsvImportPreview> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<CsvImportPreview>(`${this.base}/import/preview/products`, form);
  }

  confirmProductImport(file: File, selectedRows: number[], rule: CollisionRule): Observable<CsvImportResult> {
    const form = new FormData();
    form.append('file', file, file.name);
    selectedRows.forEach(row => form.append('selectedRows', String(row)));
    form.append('rule', rule);
    return this.http.post<CsvImportResult>(`${this.base}/import/confirm/products`, form);
  }

  downloadProductTemplate(): Observable<Blob> {
    return this.http.get(`${this.base}/import/template/products`, {
      responseType: 'blob'
    });
  }
}
