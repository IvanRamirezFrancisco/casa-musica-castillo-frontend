import { Component, OnInit, OnDestroy, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, interval, takeUntil } from 'rxjs';
import {
  DatabaseBackupService,
  BackupLog,
  BackupPage,
  BackupTriggerParams
} from '../../../services/database-backup.service';
import { NotificationCenterService } from '../../../core/services/notification-center.service';

// ── Componente ────────────────────────────────────────────────────────────────

/**
 * Panel de administración de respaldos de base de datos.
 *
 * Funcionalidades:
 *  - Disparar respaldo manual → 202 Accepted → recarga historial a los 3 s
 *  - Historial paginado con estados PENDING/COMPLETED/FAILED
 *  - Auto-polling cada 8 s cuando hay respaldos PENDING en la página actual
 *  - Descarga de respaldo via URL firmada de Supabase Storage (window.open)
 *  - Modal para ver el mensaje de error de un respaldo FAILED
 *  - Notificaciones toast no intrusivas con auto-dismiss
 */
@Component({
  selector: 'app-admin-backups',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-backups.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './admin-backups.component.css'
})
export class AdminBackupsComponent implements OnInit, OnDestroy {

  /** Emite cuando el usuario quiere navegar a la pestaña de automatizaciones */
  @Output() navigateToAutomations = new EventEmitter<void>();

  // ── Estado de la tabla ───────────────────────────────────────────────────
  backupPage: BackupPage | null = null;
  historyLoading  = false;
  currentPage     = 0;
  readonly PAGE_SIZE = 10;

  // ── Estado de acciones ───────────────────────────────────────────────────
  /** true mientras se espera el 202 del POST /trigger */
  isTriggering    = false;
  /** ID de fila cuya URL firmada se está cargando */
  loadingUrlId: number | null = null;

  // ── Panel de notificaciones ──────────────────────────────────────────────
  showNotificationPanel = false;
  showBackupInfo = false;
  isGenerating = false;

  // ── Modal de configuración de respaldo ────────────────────────────────────
  showBackupConfigModal = false;
  backupType: 'FULL' | 'PARTIAL' = 'FULL';
  selectedTables: string[] = [];
  retentionDays = 30;
  compressionLevel = 6;

  /** Tablas críticas mostradas primero en el selector */
  readonly PRIMARY_TABLES: string[] = [
    'users', 'roles', 'products', 'orders', 'order_items',
    'shopping_carts', 'active_sessions', 'audit_logs',
    'categories', 'brands', 'product_images', 'addresses',
    'cart_items', 'product_reviews', 'login_attempts', 'coupons',
  ];

  /** Todas las tablas de la BD (cargadas bajo demanda) */
  allDbTables: { name: string; rowEstimate: number }[] = [];
  showAllTables = false;
  loadingTables = false;

  // ── Notificación toast ───────────────────────────────────────────────────
  notification: {
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  } | null = null;

  // ── Modal de error ───────────────────────────────────────────────────────
  errorModal: { filename: string; message: string } | null = null;

  // ── Modal de bitácora histórica (visor terminal) ──────────────────────────
  logModal: { filename: string; log: string; status: BackupLog['status'] } | null = null;

  // ── Modal de progreso en vivo ─────────────────────────────────────────────
  isLiveModalOpen    = false;
  liveBackupId:      number | null = null;
  liveLogText        = '';
  liveBackupStatus:  'PENDING' | 'COMPLETED' | 'FAILED' = 'PENDING';
  /** Progreso visual 0–100. Avanza heurísticamente mientras PENDING, salta a 100 al terminar. */
  liveProgress       = 0;
  /** Segundos transcurridos desde que se abrió el modal */
  liveElapsedSec     = 0;
  private liveStartMs    = 0;
  private liveLogInterval: ReturnType<typeof setInterval> | null = null;
  private liveTickInterval: ReturnType<typeof setInterval> | null = null;

  // ── Limpieza de observables ──────────────────────────────────────────────
  private destroy$   = new Subject<void>();
  private notifTimer: ReturnType<typeof setTimeout> | null = null;
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private backupService: DatabaseBackupService,
    private notifCenter: NotificationCenterService
  ) {}

  // ── Ciclo de vida ─────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadHistory();
    // Auto-polling: cada 8 s refresca si hay PENDING en la página actual
    interval(8_000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.hasPending) { this.loadHistory(false); }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.notifTimer)      clearTimeout(this.notifTimer);
    if (this.reloadTimer)     clearTimeout(this.reloadTimer);
    if (this.liveLogInterval) clearInterval(this.liveLogInterval);
    if (this.liveTickInterval) clearInterval(this.liveTickInterval);
  }

  // ── Helpers de estado ─────────────────────────────────────────────────────

  /** true si algún backup de la página actual está en PENDING */
  get hasPending(): boolean {
    return !!this.backupPage?.content.some(b => b.status === 'PENDING');
  }

  /** Acceso rápido al contenido de la página actual */
  get rows(): BackupLog[] {
    return this.backupPage?.content ?? [];
  }

  // ── Carga del historial ───────────────────────────────────────────────────

  /**
   * Carga la página indicada del historial.
   * @param showSpinner muestra el skeleton loader cuando es true (por defecto true)
   */
  loadHistory(showSpinner = true): void {
    if (showSpinner) this.historyLoading = true;

    this.backupService.getBackupHistory(this.currentPage, this.PAGE_SIZE)
      .subscribe({
        next: page => {
          this.backupPage   = page;
          this.historyLoading = false;
        },
        error: err => {
          this.historyLoading = false;
          if (err.status !== 403) {
            this.showNotification('error',
              'Error al cargar historial',
              'No se pudo obtener el historial de respaldos del servidor.');
          }
        }
      });
  }

  // ── Paginación ────────────────────────────────────────────────────────────

  goToPage(page: number): void {
    if (page < 0) return;
    if (this.backupPage && page >= this.backupPage.totalPages) return;
    this.currentPage = page;
    this.loadHistory();
  }

  // ── Disparar respaldo ─────────────────────────────────────────────────────

  /**
   * Abre el modal de configuración de respaldo.
   */
  generateBackup(): void {
    this.backupType = 'FULL';
    this.selectedTables = [];
    this.retentionDays = 30;
    this.compressionLevel = 6;
    this.showAllTables = false;
    this.showBackupConfigModal = true;
  }

  /** Cierra el modal de configuración sin ejecutar */
  closeBackupConfigModal(): void {
    this.showBackupConfigModal = false;
  }

  /** Cambia el tipo de respaldo */
  onBackupTypeChange(type: 'FULL' | 'PARTIAL'): void {
    this.backupType = type;
    if (type === 'PARTIAL' && this.selectedTables.length === 0) {
      this.selectedTables = ['users'];
    }
  }

  /** Alterna una tabla en la selección */
  toggleTable(table: string): void {
    const idx = this.selectedTables.indexOf(table);
    if (idx > -1) {
      if (this.selectedTables.length <= 1) {
        this.showNotification('warning', 'Mínimo 1 tabla', 'Debes seleccionar al menos una tabla para respaldo parcial.');
        return;
      }
      this.selectedTables.splice(idx, 1);
    } else {
      this.selectedTables = [...this.selectedTables, table];
    }
  }

  /** Remueve una tabla de la selección (tag) */
  removeTable(table: string): void {
    if (this.selectedTables.length <= 1) {
      this.showNotification('warning', 'Mínimo 1 tabla', 'Debes seleccionar al menos una tabla.');
      return;
    }
    this.selectedTables = this.selectedTables.filter(t => t !== table);
  }

  isTableSelected(table: string): boolean {
    return this.selectedTables.includes(table);
  }

  /** Carga todas las tablas de la BD desde el backend */
  loadAllTables(): void {
    if (this.allDbTables.length > 0) {
      this.showAllTables = true;
      return;
    }
    this.loadingTables = true;
    this.backupService.getDatabaseTables().subscribe({
      next: (tables) => {
        this.allDbTables = tables;
        this.showAllTables = true;
        this.loadingTables = false;
      },
      error: () => {
        this.loadingTables = false;
        this.showNotification('error', 'Error', 'No se pudieron cargar las tablas de la base de datos.');
      }
    });
  }

  hideAllTables(): void {
    this.showAllTables = false;
  }

  formatRowCount(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return String(n);
  }

  /** Valida que la configuración sea correcta antes de ejecutar */
  isBackupConfigValid(): boolean {
    if (this.backupType === 'PARTIAL' && this.selectedTables.length === 0) return false;
    if (this.retentionDays < 1) return false;
    if (this.compressionLevel < 0 || this.compressionLevel > 9) return false;
    return true;
  }

  /**
   * Ejecuta el respaldo con la configuración del modal.
   */
  confirmBackup(): void {
    if (!this.isBackupConfigValid()) return;
    this.showBackupConfigModal = false;
    this.isGenerating = true;

    const params: BackupTriggerParams = {
      backup_type: this.backupType,
      retention_days: this.retentionDays,
      compression_level: this.compressionLevel,
    };
    if (this.backupType === 'PARTIAL') {
      params.tables = [...this.selectedTables];
    }

    this.triggerBackupWithParams(params);
  }

  /**
   * Envía POST /trigger al backend con parámetros.
   */
  private triggerBackupWithParams(params: BackupTriggerParams): void {
    if (this.isTriggering) return;
    this.isTriggering = true;
    this.clearNotification();

    this.backupService.triggerBackupWithParams(params).subscribe({
      next: res => {
        this.isTriggering = false;
        this.isGenerating = false;
        this.openLiveModal(res.backupId);
        if (this.reloadTimer) clearTimeout(this.reloadTimer);
        this.reloadTimer = setTimeout(() => {
          this.currentPage = 0;
          this.loadHistory(false);
        }, 4_000);
      },
      error: err => {
        this.isTriggering = false;
        this.isGenerating = false;
        if (err.status === 403) {
          this.showNotification('warning', 'Acceso denegado',
            'Solo los usuarios con rol SUPER_ADMIN pueden generar respaldos.');
        } else if (err.status === 400) {
          this.showNotification('error', 'Nombre de tabla inválido',
            err.error?.message ?? 'El servidor rechazó la solicitud por un nombre de tabla no permitido.');
        } else {
          this.showNotification('error', 'Error al iniciar respaldo',
            err.error?.message ?? 'El servidor no pudo aceptar la solicitud.');
        }
      }
    });
  }

  // ── Descarga via URL firmada ──────────────────────────────────────────────

  /**
   * Solicita al backend una URL firmada de Supabase Storage y abre
   * la descarga en una nueva pestaña. La URL expira en 1 hora.
   */
  downloadBackup(id: number): void {
    if (this.loadingUrlId !== null) return;
    this.loadingUrlId = id;

    this.backupService.getDownloadUrl(id).subscribe({
      next: res => {
        this.loadingUrlId = null;
        // Abrir en nueva pestaña — el navegador gestiona la descarga
        window.open(res.signedUrl, '_blank', 'noopener,noreferrer');
        this.showNotification('info', 'Enlace generado',
          `El enlace expira en ${res.expiresIn}. La descarga se abrió en una nueva pestaña.`);
      },
      error: err => {
        this.loadingUrlId = null;
        const msg = err.error?.message ?? 'No se pudo obtener el enlace de descarga.';
        this.showNotification('error', 'Error al obtener enlace', msg);
      }
    });
  }

  // ── Modal de error ────────────────────────────────────────────────────────

  /** Abre el modal mostrando el mensaje de error del respaldo FAILED */
  openErrorModal(log: BackupLog): void {
    this.errorModal = {
      filename: log.filename,
      message:  (log.errorMessage !== null && log.errorMessage !== undefined && log.errorMessage.trim() !== '')
                  ? log.errorMessage
                  : 'No hay detalles del error disponibles para este respaldo.\n\nPosibles causas:\n• pg_dump no encontrado en la ruta configurada.\n• Credenciales de base de datos incorrectas.\n• El proceso fue interrumpido antes de registrar el error.'
    };
  }

  /** Cierra el modal de error */
  closeErrorModal(): void {
    this.errorModal = null;
  }

  // ── Modal de bitácora ─────────────────────────────────────────────────────

  /** Abre el visor de bitácora técnica en estilo terminal */
  openLogModal(log: BackupLog): void {
    const hasLog = log.executionLog !== null && log.executionLog !== undefined
                   && log.executionLog.trim() !== '';
    this.logModal = {
      filename: log.filename,
      status:   log.status,
      log: hasLog
        ? log.executionLog!
        : '— No hay bitácora disponible para este registro.\n\n'
          + 'Posibles causas:\n'
          + '  • El respaldo fue generado antes de la versión con soporte de bitácora (V14).\n'
          + '  • El proceso falló antes de poder registrar cualquier salida.',
    };
  }

  /** Cierra el visor de bitácora histórica */
  closeLogModal(): void {
    this.logModal = null;
  }

  // ── Modal de progreso en vivo ─────────────────────────────────────────────

  /** Abre el modal de progreso e inicia el polling cada 1 s */
  openLiveModal(backupId: number): void {
    this.liveBackupId     = backupId;
    this.liveLogText      = '';
    this.liveBackupStatus = 'PENDING';
    this.liveProgress     = 0;
    this.liveElapsedSec   = 0;
    this.liveStartMs      = Date.now();
    this.isLiveModalOpen  = true;
    this.startLivePolling(backupId);
    this.startLiveTick();
  }

  /**
   * Tick cada 1 s: actualiza el contador de tiempo transcurrido y avanza la
   * barra de progreso heurísticamente usando una curva logarítmica que llega
   * al 90% en ~60 s y nunca alcanza el 100 mientras sigue PENDING.
   * Al terminar (COMPLETED/FAILED) el progreso salta a 100 desde el polling.
   */
  private startLiveTick(): void {
    if (this.liveTickInterval) clearInterval(this.liveTickInterval);
    this.liveTickInterval = setInterval(() => {
      if (this.liveBackupStatus !== 'PENDING') {
        clearInterval(this.liveTickInterval!);
        this.liveTickInterval = null;
        return;
      }
      this.liveElapsedSec = Math.floor((Date.now() - this.liveStartMs) / 1_000);
      // Curva: progress = 90 * (1 - e^(-t/45)) → llega a ~86% a los 60s, techo en 90%
      const heuristic = 90 * (1 - Math.exp(-this.liveElapsedSec / 45));
      this.liveProgress = Math.min(Math.round(heuristic), 90);
    }, 1_000);
  }

  private startLivePolling(id: number): void {
    if (this.liveLogInterval) clearInterval(this.liveLogInterval);
    this.liveLogInterval = setInterval(() => {
      this.backupService.getLiveLog(id).subscribe({
        next: res => {
          this.liveLogText = res.log;
          if (res.status === 'COMPLETED' || res.status === 'FAILED') {
            this.liveBackupStatus = res.status;
            // Barra al 100 % al terminar
            this.liveProgress = 100;
            clearInterval(this.liveLogInterval!);
            this.liveLogInterval = null;
            if (this.liveTickInterval) {
              clearInterval(this.liveTickInterval);
              this.liveTickInterval = null;
            }

            // ── Notificación al centro global ──────────────────────────
            if (res.status === 'COMPLETED') {
              const fileName = (res as any).fileName || `backup-${id}`;
              this.notifCenter.backupCompleted(fileName, 'Manual');
            } else {
              this.notifCenter.backupFailed(
                (res as any).errorMessage || 'El respaldo finalizó con errores.'
              );
            }

            // Refrescar tabla silenciosamente para mostrar el estado final
            this.loadHistory(false);
          }
        },
        error: () => { /* ignorar errores transitorios de red */ }
      });
    }, 1_000);
  }

  /** Cierra el modal de progreso (solo habilitado cuando el proceso terminó) */
  closeLiveModal(): void {
    if (this.liveLogInterval)  { clearInterval(this.liveLogInterval);  this.liveLogInterval  = null; }
    if (this.liveTickInterval) { clearInterval(this.liveTickInterval); this.liveTickInterval = null; }
    this.isLiveModalOpen  = false;
    this.liveBackupId     = null;
    this.liveLogText      = '';
    this.liveBackupStatus = 'PENDING';
    this.liveProgress     = 0;
    this.liveElapsedSec   = 0;
    this.loadHistory(false);
  }

  // ── Expiración de enlace ──────────────────────────────────────────────────

  /**
   * Devuelve true si han pasado más de 1 hora desde la creación del backup.
   * Las URLs firmadas de Supabase Storage expiran a los 3600 s (1 hora).
   * @param createdAt fecha ISO 8601 del campo BackupLog.createdAt
   */
  isExpired(createdAt: string | Date): boolean {
    const created  = new Date(createdAt).getTime();
    const expireAt = created + 60 * 60 * 1000;   // +1 hora en ms
    return Date.now() > expireAt;
  }

  // ── Formatters ────────────────────────────────────────────────────────────

  /** Convierte bytes a string legible (B / KB / MB) */
  formatFileSize(bytes: number | null): string {
    if (bytes === null || bytes === undefined) return '—';
    if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(2)} MB`;
    if (bytes >= 1_024)     return `${(bytes / 1_024).toFixed(1)} KB`;
    return `${bytes} B`;
  }

  /** Convierte milisegundos a string legible (ms / s / min) */
  formatMs(ms: number | null): string {
    if (ms === null || ms === undefined) return '—';
    if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)} min`;
    if (ms >= 1_000)  return `${(ms / 1_000).toFixed(1)} s`;
    return `${ms} ms`;
  }

  // ── Notificaciones ────────────────────────────────────────────────────────

  /** Muestra un toast con auto-dismiss */
  showNotification(
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string
  ): void {
    if (this.notifTimer) clearTimeout(this.notifTimer);
    this.notification = { type, title, message };
    const ms = type === 'error' ? 10_000 : type === 'warning' ? 8_000 : 6_000;
    this.notifTimer = setTimeout(() => { this.notification = null; }, ms);
  }

  clearNotification(): void {
    if (this.notifTimer) clearTimeout(this.notifTimer);
    this.notification = null;
  }

  toggleNotificationPanel(): void {
    this.showNotificationPanel = !this.showNotificationPanel;
  }

  // ── TrackBy para ngFor ────────────────────────────────────────────────────
  trackById(_: number, item: BackupLog): number { return item.id; }
}
