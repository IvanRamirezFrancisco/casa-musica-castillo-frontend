import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// ── Modelos ──────────────────────────────────────────────────────────────────

/** Registro de un respaldo en la base de datos */
export interface BackupLog {
  id: number;
  filename: string;
  /** Ruta del objeto en Supabase Storage (ej. backup_postgres_20260306_030000.dump) */
  filePath: string | null;
  fileSizeBytes: number | null;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  errorMessage: string | null;
  executionTimeMs: number | null;
  createdAt: string;        // ISO 8601
  triggeredBy: string;
  deleted: boolean;
  /**
   * Bitácora técnica completa del proceso: hitos internos + stdout/stderr de pg_dump.
   * Disponible en COMPLETED y FAILED. null en registros históricos (pre-V14) o PENDING.
   */
  executionLog?: string | null;
}

/** Página paginada de BackupLog (Spring Data Page<T>) */
export interface BackupPage {
  content: BackupLog[];
  totalElements: number;
  totalPages: number;
  number: number;          // página actual (0-based)
  size: number;
  first: boolean;
  last: boolean;
}

/** Parámetros opcionales para el endpoint POST /trigger */
export interface BackupTriggerParams {
  backup_type: 'FULL' | 'PARTIAL';
  tables?: string[];
  retention_days?: number;
  compression_level?: number;
}

/** Respuesta del endpoint POST /trigger */
export interface TriggerResponse {
  message: string;
  /** ID del registro BackupLog recién creado — usar para polling en /live-log */
  backupId: number;
  status: 'PENDING';
  backupType?: string;
  triggeredBy: string;
  timestamp: string;
}

/** Respuesta del endpoint GET /{id}/download-url */
export interface DownloadUrlResponse {
  signedUrl: string;
  filename: string;
  expiresIn: string;
}

// ── Servicio ──────────────────────────────────────────────────────────────────

/**
 * Servicio de respaldos de base de datos.
 *
 * El interceptor JWT (auth.interceptor.ts) inyecta automáticamente el header
 * Authorization: Bearer <token> en todas las peticiones, por lo que aquí
 * NO se añaden headers manuales.
 */
@Injectable({
  providedIn: 'root'
})
export class DatabaseBackupService {

  /** URL base del módulo de backups */
  private readonly API = `${environment.apiUrl}/admin/backups`;

  constructor(private http: HttpClient) {}

  /**
   * Dispara un respaldo manual en segundo plano (full backup).
   * El servidor responde 202 Accepted de inmediato.
   */
  triggerBackup(): Observable<TriggerResponse> {
    return this.http.post<TriggerResponse>(`${this.API}/trigger`, {});
  }

  /**
   * Dispara un respaldo con parámetros (full o parcial con tablas).
   * Si backup_type === 'PARTIAL', se envía la lista de tablas seleccionadas.
   *
   * @param params Configuración del respaldo: tipo, tablas, retención, compresión
   */
  triggerBackupWithParams(params: BackupTriggerParams): Observable<TriggerResponse> {
    const body: Record<string, any> = {
      backup_type: params.backup_type,
    };
    if (params.backup_type === 'PARTIAL' && params.tables?.length) {
      body['tables'] = params.tables;
    }
    if (params.retention_days !== undefined) {
      body['retention_days'] = params.retention_days;
    }
    if (params.compression_level !== undefined) {
      body['compression_level'] = params.compression_level;
    }
    return this.http.post<TriggerResponse>(`${this.API}/trigger`, body);
  }

  /**
   * Obtiene el historial de respaldos paginado.
   * @param page Número de página (0-based)
   * @param size Registros por página
   */
  getBackupHistory(page = 0, size = 10): Observable<BackupPage> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<BackupPage>(this.API, { params });
  }

  /**
   * Solicita al backend una URL firmada de Supabase Storage para
   * descargar el archivo del respaldo indicado.
   * La URL tiene una validez de 1 hora.
   *
   * @param id ID del registro en backup_logs
   */
  getDownloadUrl(id: number): Observable<DownloadUrlResponse> {
    return this.http.get<DownloadUrlResponse>(`${this.API}/${id}/download-url`);
  }

  /**
   * Obtiene el log de ejecución de un backup, en tiempo real mientras está activo.
   *
   * - Si el proceso sigue corriendo → responde con el snapshot en memoria y
   *   {@code status: 'PENDING'}.
   * - Si el proceso terminó → responde con el log persistido en BD y el
   *   estado final ({@code 'COMPLETED' | 'FAILED'}).
   *
   * Diseñado para polling con `setInterval` cada 1 s.
   *
   * @param id ID del registro en backup_logs
   */
  getLiveLog(id: number): Observable<{ log: string; status: 'PENDING' | 'COMPLETED' | 'FAILED' }> {
    return this.http.get<{ log: string; status: 'PENDING' | 'COMPLETED' | 'FAILED' }>(
      `${this.API}/${id}/live-log`
    );
  }

  /**
   * Obtiene las tablas de la BD para el selector de respaldo parcial.
   * Reutiliza el endpoint de automaciones.
   */
  getDatabaseTables(): Observable<{ name: string; rowEstimate: number }[]> {
    return this.http.get<{ name: string; rowEstimate: number }[]>(
      `${this.API}/tables`
    );
  }
}

