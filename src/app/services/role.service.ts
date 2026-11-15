import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  Role,
  Permission,
  CreateRoleRequest,
  PermissionsByCategory,
  RoleUserDTO,
  PageResponse
} from '../models/staff.model';

@Injectable({
  providedIn: 'root'
})
export class RoleService {
  private readonly apiUrl = `${environment.apiUrl}/admin/roles`;

  constructor(private http: HttpClient) {}

  /** Obtiene todos los roles con sus permisos y userCount */
  getAllRoles(): Observable<Role[]> {
    return this.http.get<Role[]>(this.apiUrl);
  }

  /** Obtiene un rol por ID */
  getRoleById(roleId: number): Observable<Role> {
    return this.http.get<Role>(`${this.apiUrl}/${roleId}`);
  }

  /** Crea un nuevo rol — sólo SUPER_ADMIN */
  createRole(request: CreateRoleRequest): Observable<{ message: string; role: Role }> {
    return this.http.post<{ message: string; role: Role }>(this.apiUrl, request);
  }

  /**
   * Reemplaza completamente los permisos de un rol — sólo SUPER_ADMIN.
   * Mapea a: PUT /api/admin/roles/{id}/permissions
   */
  updateRolePermissions(roleId: number, permissionIds: number[]): Observable<{ message: string; role: Role }> {
    return this.http.put<{ message: string; role: Role }>(
      `${this.apiUrl}/${roleId}/permissions`,
      { permissionIds }
    );
  }

  /**
   * Elimina un rol — sólo SUPER_ADMIN.
   * El backend bloquea roles inmutables y roles con usuarios asignados.
   */
  deleteRole(roleId: number): Observable<{ message: string; roleId: number }> {
    return this.http.delete<{ message: string; roleId: number }>(`${this.apiUrl}/${roleId}`);
  }

  /** Obtiene todos los permisos disponibles del sistema */
  getAllPermissions(): Observable<Permission[]> {
    return this.http.get<Permission[]>(`${this.apiUrl}/permissions`);
  }

  /** Obtiene permisos agrupados por categoría desde el backend, filtrados según acceso */
  getPermissionsByCategory(): Observable<PermissionsByCategory> {
    return this.http.get<PermissionsByCategory>(`${this.apiUrl}/assignable-permissions-by-category`);
  }

  /** Obtiene la cantidad de usuarios que tienen un rol asignado */
  getUsersCountForRole(roleId: number): Observable<{ roleId: number; userCount: number }> {
    return this.http.get<{ roleId: number; userCount: number }>(`${this.apiUrl}/${roleId}/users-count`);
  }

  /** Obtiene la lista paginada de usuarios que tienen un rol asignado */
  getUsersByRole(roleId: number, page = 0, size = 10): Observable<PageResponse<RoleUserDTO>> {
    return this.http.get<PageResponse<RoleUserDTO>>(
      `${this.apiUrl}/${roleId}/users`,
      { params: { page: String(page), size: String(size) } }
    );
  }
}
