/**
 * ══════════════════════════════════════════════════════════════════════════
 * NotificationCenterComponent — Panel de notificaciones del topbar
 *
 * Componente standalone que renderiza:
 *  - Botón campana con badge de conteo
 *  - Panel desplegable con filtros por categoría
 *  - Lista de notificaciones con niveles de severidad
 *  - Acciones: marcar leída, descartar, navegar
 *
 * SEGURIDAD: El filtrado por rol se hace en NotificationCenterService.
 * Este componente solo consume observables ya filtrados.
 * ══════════════════════════════════════════════════════════════════════════
 */

import {
  Component,
  ChangeDetectionStrategy,
  HostListener,
  ElementRef,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Observable, BehaviorSubject, combineLatest, Subject } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import { trigger, transition, style, animate } from '@angular/animations';

import {
  NotificationCenterService,
  AppNotification,
  NotificationCategory
} from '../../../core/services/notification-center.service';
import { TimeAgoPipe } from '../../pipes/time-ago.pipe';

@Component({
  selector: 'app-notification-center',
  standalone: true,
  imports: [CommonModule, TimeAgoPipe],
  templateUrl: './notification-center.component.html',
  styleUrl: './notification-center.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('slideDown', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-10px) scale(0.97)' }),
        animate('220ms cubic-bezier(0.16, 1, 0.3, 1)',
          style({ opacity: 1, transform: 'translateY(0) scale(1)' }))
      ]),
      transition(':leave', [
        animate('150ms ease-in',
          style({ opacity: 0, transform: 'translateY(-6px) scale(0.98)' }))
      ])
    ]),
    trigger('badgePulse', [
      transition(':enter', [
        style({ transform: 'scale(0.5)' }),
        animate('250ms ease', style({ transform: 'scale(1)' }))
      ])
    ])
  ]
})
export class NotificationCenterComponent implements OnDestroy {

  isOpen = false;

  private readonly activeFilter$ = new BehaviorSubject<NotificationCategory | 'all'>('all');
  private readonly destroy$ = new Subject<void>();

  /** Lista filtrada por la tab activa (seguridad ya aplicada por el service) */
  readonly filteredNotifications$: Observable<AppNotification[]> = combineLatest([
    this.notifService.all$,
    this.activeFilter$
  ]).pipe(
    map(([all, filter]) =>
      filter === 'all' ? all : all.filter(n => n.category === filter)
    )
  );

  /** Getter sincrónico para la plantilla */
  get activeFilter(): NotificationCategory | 'all' {
    return this.activeFilter$.getValue();
  }

  constructor(
    public notifService: NotificationCenterService,
    private router: Router,
    private elRef: ElementRef
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Acciones ──────────────────────────────────────────────────────────────

  toggle(event: Event): void {
    event.stopPropagation();
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.activeFilter$.next('all');
    }
  }

  close(): void {
    this.isOpen = false;
  }

  setFilter(filter: NotificationCategory | 'all'): void {
    this.activeFilter$.next(filter);
  }

  markAllRead(): void {
    this.notifService.markAllRead();
  }

  onItemClick(notif: AppNotification): void {
    this.notifService.markRead(notif.id);
    if (notif.actionRoute) {
      this.router.navigate(
        [notif.actionRoute],
        notif.actionQueryParams ? { queryParams: notif.actionQueryParams } : {}
      );
    }
    this.close();
  }

  onAction(event: Event, notif: AppNotification): void {
    event.stopPropagation();
    this.notifService.markRead(notif.id);
    if (notif.actionRoute) {
      this.router.navigate(
        [notif.actionRoute],
        notif.actionQueryParams ? { queryParams: notif.actionQueryParams } : {}
      );
    }
    this.close();
  }

  onDismiss(event: Event, id: string): void {
    event.stopPropagation();
    this.notifService.dismiss(id);
  }

  clearAll(): void {
    this.notifService.clearRead();
  }

  trackById(_index: number, item: AppNotification): string {
    return item.id;
  }

  categoryLabel(cat: NotificationCategory): string {
    const labels: Record<NotificationCategory, string> = {
      database: 'Base de Datos',
      inventory: 'Inventario',
      users: 'Usuarios',
      orders: 'Órdenes',
      system: 'Sistema'
    };
    return labels[cat] || cat;
  }

  // ── Cerrar al hacer clic fuera ────────────────────────────────────────────

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (this.isOpen && !this.elRef.nativeElement.contains(event.target)) {
      this.close();
    }
  }

  // ── Cerrar con Escape ─────────────────────────────────────────────────────

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen) {
      this.close();
    }
  }
}
