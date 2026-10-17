import { ApplicationRef, Injectable, OnDestroy } from '@angular/core';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { Subscription, concat, first, interval } from 'rxjs';
import Swal from 'sweetalert2';

/**
 * Gestiona las actualizaciones del Service Worker de Angular.
 * - Solo actúa si el SW está habilitado (producción).
 * - Avisa al usuario cuando hay una nueva versión lista y le deja decidir.
 * - Activa la versión nueva UNA vez y recarga UNA vez (sin bucles).
 */
@Injectable({
  providedIn: 'root'
})
export class PwaUpdateService implements OnDestroy {
  private readonly subscription = new Subscription();
  private promptOpen = false;
  private reloading = false;
  private warmUpInProgress = false;
  private recoveryAttempted = false;

  constructor(private appRef: ApplicationRef, private swUpdate: SwUpdate) {
    if (!this.swUpdate.isEnabled) {
      return;
    }

    this.subscription.add(
      this.swUpdate.versionUpdates.subscribe((event: VersionEvent) => {
        if (event.type === 'VERSION_READY') {
          // Asignar el cliente actual al nuevo manifestHash inmediatamente para que el warmup
          // almacene /index.html en la versión más reciente incluso antes de recargar con F5.
          this.swUpdate.activateUpdate()
            .then(() => this.warmUpAppShellCache(true))
            .catch(() => {})
            .finally(() => this.promptUserToUpdate());
        } else if (event.type === 'NO_NEW_VERSION_DETECTED') {
          this.warmUpAppShellCache(false);
        }
      })
    );

    // Si el SW queda en un estado irrecuperable, se recarga una única vez.
    this.subscription.add(
      this.swUpdate.unrecoverable.subscribe(() => this.reloadOnce())
    );

    // Buscar actualizaciones cada 6 horas, cuando la app ya es estable y hay conexión.
    const appIsStable$ = this.appRef.isStable.pipe(first(isStable => isStable));
    const everySixHours$ = interval(6 * 60 * 60 * 1000);
    this.subscription.add(
      concat(appIsStable$, everySixHours$).subscribe(() => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          return;
        }
        this.swUpdate.checkForUpdate().catch(() => { /* sin red: se reintenta en el siguiente ciclo */ });
      })
    );

    this.setupAppShellWarmUpListeners();
  }

  /**
   * Garantiza que todos los recursos de app-shell (/index.html, /main-*.js, /polyfills-*.js, /styles-*.css, etc.)
   * y los chunks iniciales ya cargados por el navegador queden almacenados inmediatamente en el Cache Storage
   * del Service Worker apenas tome control del cliente.
   *
   * Además verifica /ngsw/state cuando hay red para recuperar automáticamente al Service Worker si una versión
   * previa quedó degradada en EXISTING_CLIENTS_ONLY o SAFE_MODE en Vercel Preview.
   */
  private setupAppShellWarmUpListeners(): void {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    if (navigator.serviceWorker.controller) {
      this.warmUpAppShellCache(false);
    }
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      this.warmUpAppShellCache(true);
    });
    navigator.serviceWorker.ready
      .then(() => this.warmUpAppShellCache(false))
      .catch(() => {});
    window.addEventListener('online', () => {
      this.warmUpAppShellCache(false);
    });
  }

  private async warmUpAppShellCache(forceRefreshIndex: boolean): Promise<void> {
    if (
      this.warmUpInProgress ||
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !navigator.onLine ||
      !navigator.serviceWorker.controller
    ) {
      return;
    }

    this.warmUpInProgress = true;
    try {
      const urlsToWarm = new Set<string>(['/index.html', '/manifest.webmanifest', '/favicon.ico']);
      let expectedMainBundle: string | null = null;

      // 1. Obtener las URLs exactas de app-shell desde ngsw.json sin usar caché HTTP obsoleto
      const ngswRes = await fetch(`/ngsw.json?ngsw-cache-bust=${Date.now()}`, {
        credentials: 'same-origin',
        cache: 'no-store'
      });
      if (ngswRes.ok) {
        const manifest = await ngswRes.json();
        const appShellGroup = manifest?.assetGroups?.find((g: any) => g.name === 'app-shell');
        if (Array.isArray(appShellGroup?.urls)) {
          for (const u of appShellGroup.urls) {
            urlsToWarm.add(u);
            if (typeof u === 'string' && u.startsWith('/main-') && u.endsWith('.js')) {
              expectedMainBundle = u.slice(1);
            }
          }
        }
      }

      // 2. Si se fuerza refresco de /index.html tras una actualización o el /index.html en caché
      // corresponde a un bundle anterior, limpiar la entrada previa en app-shell:cache antes de pedirla al SW.
      if (typeof caches !== 'undefined') {
        const allCacheNames = await caches.keys();
        const appShellCaches = allCacheNames.filter(name => name.endsWith(':assets:app-shell:cache'));
        for (const cacheName of appShellCaches) {
          const cache = await caches.open(cacheName);
          const cachedIndex = await cache.match('/index.html');
          if (cachedIndex) {
            if (forceRefreshIndex) {
              await cache.delete('/index.html');
            } else if (expectedMainBundle) {
              const htmlText = await cachedIndex.clone().text();
              if (!htmlText.includes(expectedMainBundle)) {
                await cache.delete('/index.html');
              }
            }
          }
        }
      }

      // 3. Incluir únicamente los scripts y hojas de estilo del mismo origen ya cargados en el arranque
      if (typeof performance !== 'undefined' && performance.getEntriesByType) {
        const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        for (const entry of resources) {
          try {
            const parsed = new URL(entry.name);
            if (
              parsed.origin === window.location.origin &&
              (parsed.pathname.endsWith('.js') || parsed.pathname.endsWith('.css')) &&
              !parsed.pathname.includes('ngsw-worker.js')
            ) {
              urlsToWarm.add(parsed.pathname);
            }
          } catch {}
        }
      }

      // 4. Poblar el Cache Storage del Service Worker activo
      await Promise.allSettled(
        Array.from(urlsToWarm).map(url =>
          fetch(url, {
            credentials: 'same-origin',
            cache: url === '/index.html' ? 'no-cache' : 'default'
          })
        )
      );

      // 5. Verificar /ngsw/state mientras hay conexión para recuperar estados degradados heredados
      await this.verifyAndHealServiceWorkerState();
    } catch {
      // Ignorar errores silenciosamente si la red cae durante el warmup
    } finally {
      this.warmUpInProgress = false;
    }
  }

  private async verifyAndHealServiceWorkerState(): Promise<void> {
    if (this.recoveryAttempted || !navigator.onLine || !navigator.serviceWorker.controller) {
      return;
    }
    try {
      const stateRes = await fetch('/ngsw/state', { credentials: 'same-origin', cache: 'no-store' });
      if (!stateRes.ok) {
        return;
      }
      const stateText = await stateRes.text();
      if (stateText.includes('EXISTING_CLIENTS_ONLY') || stateText.includes('SAFE_MODE')) {
        this.recoveryAttempted = true;
        if (typeof caches !== 'undefined') {
          const keys = await caches.keys();
          await Promise.allSettled(
            keys.filter(k => k.includes('ngsw:')).map(k => caches.delete(k))
          );
        }
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.unregister();
          await navigator.serviceWorker.register('/ngsw-worker.js', { scope: '/' });
        }
      }
    } catch {
      // Ignorar si /ngsw/state no está disponible
    }
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  private promptUserToUpdate(): void {
    if (this.promptOpen) {
      return;
    }
    this.promptOpen = true;

    Swal.fire({
      title: 'Hay una nueva versión disponible.',
      text: '¿Deseas actualizar ahora? Se recargará la página.',
      icon: 'info',
      showCancelButton: true,
      confirmButtonColor: '#722F37',
      confirmButtonText: 'Actualizar',
      cancelButtonText: 'Más tarde'
    }).then(result => {
      this.promptOpen = false;
      if (result.isConfirmed) {
        this.swUpdate.activateUpdate()
          .catch(() => { /* si falla, igualmente se recarga una vez */ })
          .finally(() => this.reloadOnce());
      }
    });
  }

  private reloadOnce(): void {
    if (this.reloading) {
      return;
    }
    this.reloading = true;
    document.location.reload();
  }
}
