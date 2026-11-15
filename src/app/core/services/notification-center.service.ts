/**
 * ══════════════════════════════════════════════════════════════════════════
 * NotificationCenterService — Centro de notificaciones global (singleton)
 *
 * Maneja notificaciones de TODOS los módulos del panel administrativo.
 * Cada notificación pertenece a una categoría y un nivel de severidad.
 *
 * SEGURIDAD — Matriz de acceso por categoría:
 *
 *   Categoría   │ ROLE_ADMIN │ ROLE_SUPER_ADMIN
 *   ────────────┼────────────┼─────────────────
 *   database    │     ✗      │       ✓
 *   inventory   │     ✓      │       ✓
 *   users       │     ✓      │       ✓
 *   orders      │     ✓      │       ✓
 *   system      │     ✓      │       ✓
 *
 *  El filtrado ocurre a nivel de observable (userRole$) y nunca
 *  en la capa de UI, garantizando que roles menos privilegiados
 *  no reciban datos que no les corresponden.
 * ══════════════════════════════════════════════════════════════════════════
 */

import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';

// ── Tipos ───────────────────────────────────────────────────────────────────

export type NotificationCategory =
  | 'database'    // Gestión DB: backups, monitoreo, mantenimiento
  | 'inventory'   // Productos: stock bajo, sin imagen, precio
  | 'users'       // Empleados/clientes: cambios de rol, registros
  | 'orders'      // Órdenes: nuevas, canceladas, pagos
  | 'system';     // Sistema general: errores, actualizaciones

export type NotificationLevel = 'error' | 'warning' | 'info' | 'success';

export interface AppNotification {
  id: string;
  level: NotificationLevel;
  category: NotificationCategory;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  persistent: boolean;
  actionRoute: string | null;
  actionLabel: string | null;
  /** Query params opcionales para pasar junto con actionRoute (ej. { tab: 'monitoring' }) */
  actionQueryParams?: Record<string, string> | null;
  /** Categorías requeridas para ver esta notificación (seguridad basada en rol) */
  requiredRole?: 'SUPER_ADMIN' | 'ADMIN' | null;
  metadata?: Record<string, unknown>;
}

/**
 * Nivel mínimo de rol requerido para ver cada categoría.
 *
 *   'SUPER_ADMIN' → solo ROLE_SUPER_ADMIN
 *   'ADMIN'       → ROLE_ADMIN y ROLE_SUPER_ADMIN (todos los admins)
 *
 * Para agregar una nueva categoría restringida en el futuro,
 * basta con añadirla aquí sin tocar ningún otro archivo.
 */
const CATEGORY_MIN_ROLE: Record<NotificationCategory, 'SUPER_ADMIN' | 'ADMIN'> = {
  database:  'SUPER_ADMIN',   // Backups, monitoreo DB — solo super-admin
  inventory: 'ADMIN',         // Stock, productos     — todos los admins
  users:     'ADMIN',         // Empleados, clientes  — todos los admins
  orders:    'ADMIN',         // Órdenes, pagos        — todos los admins
  system:    'ADMIN',         // Errores del sistema   — todos los admins
};

/** Niveles de rol del sistema, de menor a mayor privilegio */
type UserRoleLevel = 'ADMIN' | 'SUPER_ADMIN';

@Injectable({ providedIn: 'root' })
export class NotificationCenterService {

  private readonly MAX_NOTIFICATIONS = 60;
  private readonly DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutos

  /** Fuente de verdad interna (sin filtrar por rol) */
  private readonly source = new BehaviorSubject<AppNotification[]>([]);

  /**
   * IDs de alertas críticas de BD ya notificadas — singleton para sobrevivir
   * al destroy/recreate de los componentes de pestañas.
   */
  private readonly knownCriticalAlertIds = new Set<string>();

  /**
   * Nombres de tablas con mantenimiento atrasado ya notificadas en esta sesión.
   */
  private readonly notifiedOverdueTables = new Set<string>();

  private readonly authService = inject(AuthService);

  /**
   * Observable que emite el nivel de rol del usuario autenticado.
   * Usa `distinctUntilChanged` para no re-disparar si el token
   * se refresca pero el rol sigue siendo el mismo.
   */
  private readonly userRoleLevel$: Observable<UserRoleLevel> =
    this.authService.getCurrentUser().pipe(
      map(user => {
        if (!user?.roles) return 'ADMIN';
        const isSuperAdmin = user.roles.some(r =>
          r?.toUpperCase() === 'ROLE_SUPER_ADMIN' || r?.toUpperCase() === 'SUPER_ADMIN'
        );
        return isSuperAdmin ? 'SUPER_ADMIN' : 'ADMIN';
      }),
      distinctUntilChanged()
    );

  // ═══════════════════════════════════════════════════════════════════════════
  // Observables públicos — FILTRADOS POR SEGURIDAD
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Todas las notificaciones permitidas para el rol del usuario actual.
   *
   * Lógica:
   *   SUPER_ADMIN → ve todo (database + inventory + users + orders + system)
   *   ADMIN       → ve solo las categorías con minRole === 'ADMIN'
   *                 (inventory, users, orders, system — nunca database)
   */
  readonly all$: Observable<AppNotification[]> = combineLatest([
    this.source.asObservable(),
    this.userRoleLevel$
  ]).pipe(
    map(([list, roleLevel]) =>
      list.filter(n => {
        const required = CATEGORY_MIN_ROLE[n.category];
        // Si la categoría requiere SUPER_ADMIN, solo pasa si el usuario lo es
        return required === 'ADMIN' || roleLevel === 'SUPER_ADMIN';
      })
    )
  );

  /** Conteo de no leídas (filtrado por seguridad) */
  readonly unreadCount$: Observable<number> = this.all$.pipe(
    map(list => list.filter(n => !n.read).length),
    distinctUntilChanged()
  );

  /** Flag booleano de si hay no leídas */
  readonly hasUnread$: Observable<boolean> = this.unreadCount$.pipe(
    map(count => count > 0),
    distinctUntilChanged()
  );

  /** Últimas 10 para el panel desplegable del topbar */
  readonly recent$: Observable<AppNotification[]> = this.all$.pipe(
    map(list => list.slice(0, 10))
  );

  /** No leídas agrupadas por categoría (filtradas por seguridad) */
  readonly unreadByCategory$: Observable<Record<NotificationCategory, number>> = this.all$.pipe(
    map(list => {
      const unread = list.filter(n => !n.read);
      return {
        database:  unread.filter(n => n.category === 'database').length,
        inventory: unread.filter(n => n.category === 'inventory').length,
        users:     unread.filter(n => n.category === 'users').length,
        orders:    unread.filter(n => n.category === 'orders').length,
        system:    unread.filter(n => n.category === 'system').length,
      };
    }),
    distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // Métodos de escritura
  // ═══════════════════════════════════════════════════════════════════════════

  push(notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>): void {
    const newItem: AppNotification = {
      ...notif,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      read: false,
    };

    const current = this.source.getValue();

    // Deduplicación: mismo título + categoría + no leída en ventana de 5 min
    const isDuplicate = current.some(n =>
      !n.read &&
      n.title === newItem.title &&
      n.category === newItem.category &&
      (Date.now() - n.timestamp.getTime()) < this.DEDUP_WINDOW_MS
    );
    if (isDuplicate) return;

    const updated = [newItem, ...current].slice(0, this.MAX_NOTIFICATIONS);
    this.source.next(updated);
  }

  markRead(id: string): void {
    this.source.next(
      this.source.getValue().map(n =>
        n.id === id ? { ...n, read: true } : n
      )
    );
  }

  markAllRead(): void {
    this.source.next(
      this.source.getValue().map(n => ({ ...n, read: true }))
    );
  }

  markCategoryRead(category: NotificationCategory): void {
    this.source.next(
      this.source.getValue().map(n =>
        n.category === category ? { ...n, read: true } : n
      )
    );
  }

  /**
   * Descarta una notificación por su ID.
   * El usuario eligió explícitamente cerrarla → se elimina siempre,
   * incluso si es `persistent: true`.
   */
  dismiss(id: string): void {
    this.source.next(
      this.source.getValue().filter(n => n.id !== id)
    );
  }

  /**
   * Elimina notificaciones que el usuario ya NO quiere ver
   * (solo las que no tienen lógica de auto-limpieza — persistent).
   * Útil para limpiar ruido sin borrar alertas activas.
   */
  clearNonPersistent(): void {
    this.source.next(
      this.source.getValue().filter(n => n.persistent)
    );
  }

  /**
   * "Limpiar notificaciones leídas" — elimina todo lo que está leído,
   * incluyendo las persistentes ya revisadas.
   * Solo sobreviven las NO leídas (independientemente de persistent).
   */
  clearRead(): void {
    this.source.next(
      this.source.getValue().filter(n => !n.read)
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Métodos de conveniencia por módulo
  // ═══════════════════════════════════════════════════════════════════════════

  // ── GESTIÓN DB — Respaldos (solo SUPER_ADMIN) ────────────────────────────

  backupCompleted(fileName: string, triggeredBy: string): void {
    this.push({
      level: 'success',
      category: 'database',
      title: 'Respaldo completado',
      message: `${fileName} disponible. El enlace se genera al descargar.`,
      persistent: false,
      actionRoute: '/admin/backups',
      actionLabel: 'Ver respaldos',
      requiredRole: 'SUPER_ADMIN',
      metadata: { fileName, triggeredBy }
    });
  }

  backupFailed(error: string): void {
    this.push({
      level: 'error',
      category: 'database',
      title: 'Error al generar respaldo',
      message: error,
      persistent: true,
      actionRoute: '/admin/backups',
      actionLabel: 'Ver bitácora',
      requiredRole: 'SUPER_ADMIN',
    });
  }

  // ── INVENTARIO — Productos ───────────────────────────────────────────────

  lowStock(productName: string, stock: number, threshold: number): void {
    this.push({
      level: stock === 0 ? 'error' : 'warning',
      category: 'inventory',
      title: stock === 0 ? `Sin stock: ${productName}` : `Stock bajo: ${productName}`,
      message: stock === 0
        ? 'El producto no tiene unidades disponibles.'
        : `Quedan ${stock} unidades (mínimo: ${threshold}).`,
      persistent: false,
      actionRoute: '/admin/products',
      actionLabel: 'Ver producto',
    });
  }

  // ── USUARIOS — Empleados ─────────────────────────────────────────────────

  newEmployeeRegistered(name: string): void {
    this.push({
      level: 'info',
      category: 'users',
      title: 'Nuevo empleado registrado',
      message: `${name} fue agregado al sistema.`,
      persistent: false,
      actionRoute: '/admin/staff',
      actionLabel: 'Ver empleados',
    });
  }

  roleChanged(userName: string, newRole: string): void {
    this.push({
      level: 'info',
      category: 'users',
      title: 'Rol actualizado',
      message: `${userName} ahora tiene el rol ${newRole}.`,
      persistent: false,
      actionRoute: '/admin/roles',
      actionLabel: 'Ver roles',
      requiredRole: 'SUPER_ADMIN',
    });
  }

  // ── ÓRDENES ──────────────────────────────────────────────────────────────

  newOrder(orderId: string | number, customerName: string): void {
    this.push({
      level: 'info',
      category: 'orders',
      title: 'Nueva orden recibida',
      message: `Orden #${orderId} de ${customerName}.`,
      persistent: false,
      actionRoute: '/admin/orders',
      actionLabel: 'Ver orden',
    });
  }

  orderCancelled(orderId: string | number, reason: string): void {
    this.push({
      level: 'warning',
      category: 'orders',
      title: `Orden #${orderId} cancelada`,
      message: reason || 'El cliente canceló la orden.',
      persistent: false,
      actionRoute: '/admin/orders',
      actionLabel: 'Ver detalle',
    });
  }

  // ── SISTEMA ──────────────────────────────────────────────────────────────

  systemError(title: string, message: string): void {
    this.push({
      level: 'error',
      category: 'system',
      title,
      message,
      persistent: true,
      actionRoute: null,
      actionLabel: null,
    });
  }

  systemInfo(title: string, message: string): void {
    this.push({
      level: 'info',
      category: 'system',
      title,
      message,
      persistent: false,
      actionRoute: null,
      actionLabel: null,
    });
  }

  // ── SESIÓN ───────────────────────────────────────────────────────────────

  /** Elimina todas las notificaciones (usar al cerrar sesión). */
  clearAll(): void {
    this.source.next([]);
    this.knownCriticalAlertIds.clear();
    this.notifiedOverdueTables.clear();
  }

  // ── Deduplicación por componentes de BD (singleton, sobrevive tab-switching) ──

  isAlertKnown(alertId: string): boolean {
    return this.knownCriticalAlertIds.has(alertId);
  }

  addKnownAlert(alertId: string): void {
    this.knownCriticalAlertIds.add(alertId);
  }

  removeStaleAlerts(currentIds: Set<string>): void {
    this.knownCriticalAlertIds.forEach(id => {
      if (!currentIds.has(id)) this.knownCriticalAlertIds.delete(id);
    });
  }

  isTableNotified(tableName: string): boolean {
    return this.notifiedOverdueTables.has(tableName);
  }

  addNotifiedTable(tableName: string): void {
    this.notifiedOverdueTables.add(tableName);
  }
}
