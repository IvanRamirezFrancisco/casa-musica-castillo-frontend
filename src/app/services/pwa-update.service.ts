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

  constructor(private appRef: ApplicationRef, private swUpdate: SwUpdate) {
    if (!this.swUpdate.isEnabled) {
      return;
    }

    this.subscription.add(
      this.swUpdate.versionUpdates.subscribe((event: VersionEvent) => {
        if (event.type === 'VERSION_READY') {
          this.promptUserToUpdate();
        }
      })
    );

    // Si el SW queda en un estado irrecuperable, se recarga una única vez.
    this.subscription.add(
      this.swUpdate.unrecoverable.subscribe(() => this.reloadOnce())
    );

    // Buscar actualizaciones cada 6 horas, cuando la app ya es estable.
    const appIsStable$ = this.appRef.isStable.pipe(first(isStable => isStable));
    const everySixHours$ = interval(6 * 60 * 60 * 1000);
    this.subscription.add(
      concat(appIsStable$, everySixHours$).subscribe(() => {
        this.swUpdate.checkForUpdate().catch(() => { /* sin red: se reintenta en el siguiente ciclo */ });
      })
    );

    this.warmUpAppShellCache();
  }

  /**
   * Garantiza que todos los recursos de app-shell (/index.html, /main-*.js, /polyfills-*.js, /styles-*.css, etc.)
   * y los chunks iniciales ya cargados por el navegador queden almacenados inmediatamente en el Cache Storage
   * del Service Worker apenas tome control del cliente.
   *
   * Esto evita que el IdleScheduler de ngsw-worker.js falle en dominios de producción (Vercel)
   * si el usuario pasa a modo Offline antes de que concluya el temporizador idle, previniendo
   * el estado degradado EXISTING_CLIENTS_ONLY y el error HTTP 504 Gateway Timeout al recargar con F5.
   */
  private warmUpAppShellCache(): void {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    let warmedUp = false;
    const triggerWarmUp = async () => {
      if (warmedUp || !navigator.onLine || !navigator.serviceWorker.controller) {
        return;
      }
      warmedUp = true;

      try {
        const urlsToWarm = new Set<string>(['/index.html', '/manifest.webmanifest', '/favicon.ico']);

        // 1. Obtener las URLs exactas de app-shell desde ngsw.json
        const ngswRes = await fetch('/ngsw.json', { credentials: 'same-origin' });
        if (ngswRes.ok) {
          const manifest = await ngswRes.json();
          const appShellGroup = manifest?.assetGroups?.find((g: any) => g.name === 'app-shell');
          if (Array.isArray(appShellGroup?.urls)) {
            appShellGroup.urls.forEach((u: string) => urlsToWarm.add(u));
          }
        }

        // 2. Incluir todos los scripts y hojas de estilo iniciales que cargaron antes de que el SW tomara control
        if (typeof performance !== 'undefined' && performance.getEntriesByType) {
          const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
          for (const entry of resources) {
            try {
              const parsed = new URL(entry.name);
              if (
                parsed.origin === window.location.origin &&
                (parsed.pathname.endsWith('.js') || parsed.pathname.endsWith('.css') || parsed.pathname.endsWith('.woff2')) &&
                !parsed.pathname.includes('ngsw-worker.js')
              ) {
                urlsToWarm.add(parsed.pathname);
              }
            } catch {}
          }
        }

        await Promise.allSettled(
          Array.from(urlsToWarm).map(url => fetch(url, { credentials: 'same-origin' }))
        );
      } catch {
        // Ignorar errores silenciosamente si la red cae durante el warmup
      }
    };

    if (navigator.serviceWorker.controller) {
      triggerWarmUp();
    }
    navigator.serviceWorker.addEventListener('controllerchange', () => triggerWarmUp());
    navigator.serviceWorker.ready.then(() => triggerWarmUp()).catch(() => {});
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
