import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  BrandDTO,
  CreateBrandRequest,
  BrandBasicInfo,
  BrandListResponse
} from '../models/brand.model';

/**
 * Servicio para gestión de marcas
 * Consume endpoints de /api/admin/brands
 */
@Injectable({
  providedIn: 'root'
})
export class BrandService {
  private readonly ADMIN_API_URL = `${environment.apiUrl}/admin/brands`;

  constructor(private http: HttpClient) {}

  /**
   * Obtener todas las marcas con paginación
   * GET /api/admin/brands?page=0&size=20&sortBy=name&sortDir=asc
   */
  getAllBrands(
    page: number = 0,
    size: number = 20,
    sortBy: string = 'name',
    sortDir: string = 'asc'
  ): Observable<BrandListResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sortBy', sortBy)
      .set('sortDir', sortDir);

    return this.http.get<BrandListResponse>(this.ADMIN_API_URL, { params });
  }

  /**
   * Buscar marcas con filtros
   * GET /api/admin/brands/search?name=fender&active=true
   */
  searchBrands(
    name?: string,
    active?: boolean,
    countryOrigin?: string,
    page: number = 0,
    size: number = 20
  ): Observable<BrandListResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (name) params = params.set('name', name);
    if (active !== undefined) params = params.set('active', active.toString());
    if (countryOrigin) params = params.set('countryOrigin', countryOrigin);

    return this.http.get<BrandListResponse>(`${this.ADMIN_API_URL}/search`, { params });
  }

  /**
   * Obtener marcas activas (para selector en productos)
   * GET /api/admin/brands/active
   */
  getActiveBrands(): Observable<BrandBasicInfo[]> {
    return this.http.get<BrandBasicInfo[]>(`${this.ADMIN_API_URL}/active`);
  }

  /**
   * Obtener marca por ID
   * GET /api/admin/brands/{id}
   */
  getBrandById(id: number): Observable<BrandDTO> {
    return this.http.get<BrandDTO>(`${this.ADMIN_API_URL}/${id}`);
  }

  /**
   * Crear nueva marca
   * POST /api/admin/brands
   */
  createBrand(brand: CreateBrandRequest): Observable<BrandDTO> {
    return this.http.post<BrandDTO>(this.ADMIN_API_URL, brand);
  }

  /**
   * Actualizar marca existente
   * PUT /api/admin/brands/{id}
   */
  updateBrand(id: number, brand: CreateBrandRequest): Observable<BrandDTO> {
    return this.http.put<BrandDTO>(`${this.ADMIN_API_URL}/${id}`, brand);
  }

  /**
   * Eliminar marca
   * DELETE /api/admin/brands/{id}
   */
  deleteBrand(id: number): Observable<{message: string}> {
    return this.http.delete<{message: string}>(`${this.ADMIN_API_URL}/${id}`);
  }

  /**
   * Activar/Desactivar marca
   * PATCH /api/admin/brands/{id}/toggle-status
   */
  toggleBrandStatus(id: number): Observable<BrandDTO> {
    return this.http.patch<BrandDTO>(`${this.ADMIN_API_URL}/${id}/toggle-status`, {});
  }

  /**
   * Actualizar contador de productos
   * PATCH /api/admin/brands/{id}/update-count
   */
  updateProductCount(id: number): Observable<{message: string}> {
    return this.http.patch<{message: string}>(`${this.ADMIN_API_URL}/${id}/update-count`, {});
  }

  // ==================== LOGO ====================

  /**
   * Subir logo a marca
   * POST /api/admin/brands/{id}/logo
   */
  uploadBrandLogo(brandId: number, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<any>(`${this.ADMIN_API_URL}/${brandId}/logo`, formData);
  }

  /**
   * Eliminar logo de marca
   * DELETE /api/admin/brands/{id}/logo
   */
  deleteBrandLogo(brandId: number): Observable<any> {
    return this.http.delete<any>(`${this.ADMIN_API_URL}/${brandId}/logo`);
  }
}
