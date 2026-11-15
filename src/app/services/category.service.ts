import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Category, CreateCategoryRequest, UpdateCategoryRequest } from '../models/category.model';

@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  private readonly API_URL = `${environment.apiUrl}/categories`;
  private readonly ADMIN_API_URL = `${environment.apiUrl}/admin/categories`;

  constructor(private http: HttpClient) {}

  /**
   * Obtener todas las categorías (público)
   */
  getAllCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(this.API_URL);
  }

  /**
   * Obtener solo categorías activas (público)
   */
  getActiveCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.API_URL}/active`);
  }

  /**
   * Obtener categoría por ID
   */
  getCategoryById(id: number): Observable<Category> {
    return this.http.get<Category>(`${this.API_URL}/${id}`);
  }

  /**
   * Crear nueva categoría (ADMIN)
   */
  createCategory(category: CreateCategoryRequest): Observable<Category> {
    return this.http.post<Category>(this.API_URL, category, {
      headers: this.getAuthHeaders()
    });
  }

  /**
   * Actualizar categoría existente (ADMIN)
   */
  updateCategory(id: number, category: UpdateCategoryRequest): Observable<Category> {
    return this.http.put<Category>(`${this.API_URL}/${id}`, category, {
      headers: this.getAuthHeaders()
    });
  }

  /**
   * Eliminar categoría - soft delete (ADMIN)
   */
  deleteCategory(id: number): Observable<any> {
    return this.http.delete(`${this.API_URL}/${id}`, {
      headers: this.getAuthHeaders()
    });
  }

  /**
   * Eliminar categoría permanentemente (ADMIN)
   */
  permanentlyDeleteCategory(id: number): Observable<any> {
    return this.http.delete(`${this.API_URL}/${id}/permanent`, {
      headers: this.getAuthHeaders()
    });
  }

  /**
   * Subir imagen de categoría (ADMIN)
   */
  uploadCategoryImage(id: number, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    // Para multipart/form-data NO debemos establecer Content-Type en los headers de Angular, 
    // el navegador lo hace automáticamente incluyendo el boundary.
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    return this.http.post<any>(`${this.API_URL}/${id}/image`, formData, { headers });
  }

  /**
   * Eliminar imagen de categoría (ADMIN)
   */
  deleteCategoryImage(id: number): Observable<any> {
    return this.http.delete(`${this.API_URL}/${id}/image`, {
      headers: this.getAuthHeaders()
    });
  }

  /**
   * Obtener headers de autenticación
   */
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }
}
