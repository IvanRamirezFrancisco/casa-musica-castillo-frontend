import { Injectable, OnDestroy, computed, signal } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, distinctUntilChanged, fromEvent, merge, map } from 'rxjs';
import Swal from 'sweetalert2';

export type ConnectivityState = 'ONLINE' | 'OFFLINE_DEVICE' | 'SERVER_UNAVAILABLE';

/**
 * Única fuente de verdad del estado de conectividad de la aplicación.
 * Distingue entre:
 * - OFFLINE_DEVICE: el dispositivo no tiene conexión a Internet (navigator.onLine === false)
 * - SERVER_UNAVAILABLE: hay red local, pero el backend (Render) está despertando o no responde temporalmente
 * - ONLINE: conexión y servidor operativos
 */
@Injectable({
  providedIn: 'root'
})
export class ConnectivityService implements OnDestroy {
  private readonly status$ = new BehaviorSubject<boolean>(this.readNavigatorStatus());
  private readonly subscription = new Subscription();
  private lastToastTime = 0;
  private reconnectedTimer: ReturnType<typeof setTimeout> | null = null;

  /** Estado reactivo (signal) de red del navegador para plantillas/componentes. */
  readonly online = signal<boolean>(this.status$.value);

  /** Indica si el backend está tardando en responder o devolvió 5xx/timeout aunque haya Internet. */
  readonly serverUnavailable = signal<boolean>(false);

  /** Indica brevemente que la conexión acaba de restablecerse. */
  readonly justReconnected = signal<boolean>(false);

  /** Estado combinado de conectividad para la UI. */
  readonly state = computed<ConnectivityState>(() => {
    if (!this.online()) {
      return 'OFFLINE_DEVICE';
    }
    if (this.serverUnavailable()) {
      return 'SERVER_UNAVAILABLE';
    }
    return 'ONLINE';
  });

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }

    this.subscription.add(
      merge(
        fromEvent(window, 'online').pipe(map(() => true)),
        fromEvent(window, 'offline').pipe(map(() => false))
      ).pipe(distinctUntilChanged()).subscribe(isOnline => {
        const wasOffline = !this.status$.value;
        this.status$.next(isOnline);
        this.online.set(isOnline);

        if (isOnline) {
          this.serverUnavailable.set(false);
          if (wasOffline) {
            this.triggerReconnectedBanner();
          }
          this.notifyStatusChange(true);
        } else {
          this.justReconnected.set(false);
          this.notifyStatusChange(false);
        }
      })
    );
  }

  /** Estado actual del navegador (síncrono). */
  get isOnline(): boolean {
    return this.status$.value;
  }

  /** Estado como Observable (true = online, false = offline). */
  get isOnline$(): Observable<boolean> {
    return this.status$.asObservable().pipe(distinctUntilChanged());
  }

  /**
   * Registra que el backend respondió correctamente, limpiando el estado de espera del servidor.
   */
  reportServerRecovered(): void {
    if (this.serverUnavailable()) {
      this.serverUnavailable.set(false);
      this.triggerReconnectedBanner();
    }
  }

  /**
   * Registra que el backend tardó en responder o devolvió un error temporal (502/503/504/timeout)
   * mientras el navegador sí cuenta con conexión a Internet.
   */
  reportServerUnavailable(): void {
    if (!this.isOnline) {
      return;
    }
    if (!this.serverUnavailable()) {
      this.serverUnavailable.set(true);
    }
  }

  /**
   * Aviso discreto (toast) con deduplicación cuando el usuario intenta realizar una acción
   * que requiere conexión activa (login, carrito, checkout, pago, mutaciones).
   */
  notifyOfflineAction(customMessage?: string): void {
    const now = Date.now();
    if (now - this.lastToastTime < 3500) {
      return;
    }
    this.lastToastTime = now;

    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'warning',
      title: customMessage || 'Esta acción requiere conexión a Internet.',
      text: 'Puedes seguir consultando el contenido guardado.',
      showConfirmButton: false,
      timer: 4500,
      timerProgressBar: true,
      iconColor: '#C5A059'
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    if (this.reconnectedTimer) {
      clearTimeout(this.reconnectedTimer);
    }
  }

  private triggerReconnectedBanner(): void {
    this.justReconnected.set(true);
    if (this.reconnectedTimer) {
      clearTimeout(this.reconnectedTimer);
    }
    this.reconnectedTimer = setTimeout(() => {
      this.justReconnected.set(false);
    }, 4000);
  }

  private readNavigatorStatus(): boolean {
    return typeof navigator === 'undefined' ? true : navigator.onLine;
  }

  private notifyStatusChange(isOnline: boolean): void {
    const now = Date.now();
    if (now - this.lastToastTime < 2000) {
      return;
    }
    this.lastToastTime = now;

    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: isOnline ? 'success' : 'warning',
      title: isOnline
        ? 'Conexión restablecida'
        : 'Sin conexión a Internet',
      text: isOnline
        ? 'Actualizando la información disponible.'
        : 'Puedes seguir consultando contenido disponible sin conexión.',
      showConfirmButton: false,
      timer: isOnline ? 3000 : 4500,
      timerProgressBar: true,
      iconColor: isOnline ? '#722F37' : '#C5A059'
    });
  }
}

