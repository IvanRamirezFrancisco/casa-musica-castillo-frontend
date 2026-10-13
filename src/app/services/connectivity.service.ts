import { Injectable, OnDestroy, signal } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, distinctUntilChanged, fromEvent, merge, map } from 'rxjs';
import Swal from 'sweetalert2';

/**
 * Única fuente de verdad del estado de conectividad de la aplicación.
 * Registra exactamente un par de listeners (online/offline) para toda la app.
 */
@Injectable({
  providedIn: 'root'
})
export class ConnectivityService implements OnDestroy {
  private readonly status$ = new BehaviorSubject<boolean>(this.readNavigatorStatus());
  private readonly subscription = new Subscription();

  /** Estado reactivo (signal) para plantillas/componentes. */
  readonly online = signal<boolean>(this.status$.value);

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }

    this.subscription.add(
      merge(
        fromEvent(window, 'online').pipe(map(() => true)),
        fromEvent(window, 'offline').pipe(map(() => false))
      ).pipe(distinctUntilChanged()).subscribe(isOnline => {
        this.status$.next(isOnline);
        this.online.set(isOnline);
        this.notify(isOnline);
      })
    );
  }

  /** Estado actual (síncrono). */
  get isOnline(): boolean {
    return this.status$.value;
  }

  /** Estado como Observable (true = online, false = offline). */
  get isOnline$(): Observable<boolean> {
    return this.status$.asObservable().pipe(distinctUntilChanged());
  }

  /**
   * Aviso discreto (toast) que requiere conexión. Se reutiliza desde el
   * interceptor para no mostrar múltiples avisos simultáneos.
   */
  notifyOfflineAction(): void {
    this.notify(false);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  private readNavigatorStatus(): boolean {
    return typeof navigator === 'undefined' ? true : navigator.onLine;
  }

  private notify(isOnline: boolean): void {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: isOnline ? 'success' : 'warning',
      title: isOnline
        ? 'Conexión restablecida.'
        : 'Sin conexión. Algunas funciones no están disponibles.',
      showConfirmButton: false,
      timer: isOnline ? 3000 : 5000,
      timerProgressBar: true,
      iconColor: isOnline ? '#722F37' : '#E2B84F'
    });
  }
}
