import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface StockAlertConfig {
  enabled: boolean;
  stockThreshold: number;
  notifyEmails: string[];
  superAdminEmails: string[];
}

export interface StaffRecipient {
  id: number;
  fullName: string;
  email: string;
  role: string;
  isSuperAdmin: boolean;
}

// ── Servicio ──────────────────────────────────────────────────────────────────

/**
 * Servicio Angular para gestionar la configuración de alertas de stock bajo.
 *
 * Consume los endpoints de StockAlertsController:
 * - GET    /api/admin/stock-alerts/config
 * - PUT    /api/admin/stock-alerts/config
 * - GET    /api/admin/stock-alerts/staff-recipients
 *
 * La configuración vive en system_automations.parameters (JSONB)
 * del job INVENTORY_AUDIT_JOB. Ya no existe tabla store_alert_config.
 */
@Injectable({
  providedIn: 'root'
})
export class StockAlertsService {

  private readonly API = `${environment.apiUrl}/admin/stock-alerts`;

  constructor(private http: HttpClient) {}

  /** Obtiene la configuración actual de alertas de stock. */
  getConfig(): Observable<StockAlertConfig> {
    return this.http.get<StockAlertConfig>(`${this.API}/config`);
  }

  /** Actualiza la configuración de alertas de stock. */
  updateConfig(config: Partial<StockAlertConfig>): Observable<StockAlertConfig> {
    return this.http.put<StockAlertConfig>(`${this.API}/config`, config);
  }

  /** Lista empleados activos con flag isSuperAdmin. */
  getStaffRecipients(): Observable<StaffRecipient[]> {
    return this.http.get<StaffRecipient[]>(`${this.API}/staff-recipients`);
  }
}
