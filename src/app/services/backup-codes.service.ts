import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse } from '../models/api-response.model';

export interface BackupCodeResponse {
  success: boolean;
  message: string;
  data?: {
    backupCodes?: string[];
    codesGenerated?: number;
  };
}

export interface BackupCodeVerificationRequest {
  code: string;
  email: string;
}

@Injectable({
  providedIn: 'root'
})
export class BackupCodesService {
  private readonly API_URL = `${environment.apiUrl}/2fa`;

  constructor(private http: HttpClient) {}

  /**
   * Generar nuevos códigos de respaldo (solo disponible si Google Auth está activado)
   */
  generateBackupCodes(currentPassword: string): Observable<BackupCodeResponse> {
    return this.http.post<BackupCodeResponse>(`${this.API_URL}/backup-codes/generate`, { currentPassword });
  }

  /**
   * Verificar código de respaldo durante login
   */
  verifyBackupCode(request: BackupCodeVerificationRequest): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/backup-codes/verify`, request);
  }

  /**
   * Obtener estado de códigos de respaldo
   */
  getBackupCodesStatus(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.API_URL}/backup-codes/status`);
  }

  /**
   * Desactivar códigos de respaldo (elimina todos los códigos)
   */
  disableBackupCodes(currentPassword: string): Observable<BackupCodeResponse> {
    return this.http.post<BackupCodeResponse>(`${this.API_URL}/backup-codes/disable`, { currentPassword });
  }

  /**
   * Obtener headers con autorización
   */
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }
}