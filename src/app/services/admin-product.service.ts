import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product, PageResponse, ProductImageResponse } from '../models/admin.models';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AdminProductService {
  private apiUrl = `${environment.apiUrl}/admin/products`;

  constructor(private http: HttpClient) { }

  getAllProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(this.apiUrl);
  }

  getProductsPaginated(page: number = 0, size: number = 10, sortBy: string = 'id', direction: string = 'DESC'): Observable<PageResponse<Product>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sortBy', sortBy)
      .set('direction', direction);
    
    return this.http.get<PageResponse<Product>>(`${this.apiUrl}/paginated`, { params });
  }

  getProductById(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/${id}`);
  }

  createProduct(product: Product): Observable<Product> {
    return this.http.post<Product>(this.apiUrl, product);
  }

  updateProduct(id: number, product: Product): Observable<Product> {
    return this.http.put<Product>(`${this.apiUrl}/${id}`, product);
  }

  deleteProduct(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  toggleProductStatus(id: number): Observable<Product> {
    return this.http.patch<Product>(`${this.apiUrl}/${id}/toggle-status`, {});
  }

  searchProducts(keyword: string): Observable<Product[]> {
    const params = new HttpParams().set('keyword', keyword);
    return this.http.get<Product[]>(`${this.apiUrl}/search`, { params });
  }

  getProductsCount(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.apiUrl}/count`);
  }

  // ==================== IMAGES ====================

  getProductImages(productId: number): Observable<ProductImageResponse[]> {
    return this.http.get<ProductImageResponse[]>(`${this.apiUrl}/${productId}/images`);
  }

  uploadProductImage(productId: number, file: File): Observable<{ success: boolean; message: string; data: ProductImageResponse }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ success: boolean; message: string; data: ProductImageResponse }>(`${this.apiUrl}/${productId}/images`, formData);
  }

  setPrimaryProductImage(productId: number, imageId: number): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${productId}/images/${imageId}/primary`, {});
  }

  deleteProductImage(productId: number, imageId: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${productId}/images/${imageId}`);
  }
}
