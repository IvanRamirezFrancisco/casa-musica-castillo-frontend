import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface UploadResponse {
  success: boolean;
  url: string;
  filename: string;
  originalName: string;
  size: number;
}

export interface MultipleUploadResponse {
  success: boolean;
  uploadedCount: number;
  totalFiles: number;
  files: UploadResponse[];
  errors?: string[];
}

/**
 * @deprecated Este servicio está siendo reemplazado por los endpoints específicos de imágenes en AdminProductService y BrandService integrados con Cloudinary.
 * No utilizar para productos ni marcas. Se mantiene temporalmente por compatibilidad residual.
 */
@Injectable({
  providedIn: 'root'
})
export class FileUploadService {
  private apiUrl = 'http://localhost:8080/api/upload';

  constructor(private http: HttpClient) {}

  /**
   * Sube una sola imagen al servidor
   */
  uploadSingle(file: File): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<UploadResponse>(`${this.apiUrl}/single`, formData);
  }

  /**
   * Sube múltiples imágenes al servidor
   */
  uploadMultiple(files: File[]): Observable<MultipleUploadResponse> {
    const formData = new FormData();
    
    files.forEach((file, index) => {
      formData.append('files', file);
    });

    return this.http.post<MultipleUploadResponse>(`${this.apiUrl}/multiple`, formData);
  }

  /**
   * Elimina una imagen del servidor por su nombre de archivo
   */
  deleteImage(filename: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${filename}`);
  }

  /**
   * Extrae el nombre del archivo de una URL completa
   * Ejemplo: http://localhost:8080/uploads/products/abc123.jpg -> abc123.jpg
   */
  extractFilename(url: string): string {
    if (!url) return '';
    const parts = url.split('/');
    return parts[parts.length - 1];
  }
}
