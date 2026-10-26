import { ApplicationConfig, Injectable, importProvidersFrom, LOCALE_ID, isDevMode } from '@angular/core';
import { PreloadingStrategy, Route, provideRouter, withInMemoryScrolling, withPreloading } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';
import { provideAnimations } from '@angular/platform-browser/animations';
import { registerLocaleData } from '@angular/common';
import localeEsMx from '@angular/common/locales/es-MX';
import { Observable, of, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';

registerLocaleData(localeEsMx, 'es-MX');

import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { sanitizationInterceptor } from './interceptors/sanitization-functional.interceptor';
import { browserCompatibilityInterceptor } from './interceptors/browser-compatibility.interceptor';
import { offlineInterceptor } from './interceptors/offline.interceptor';

/**
 * Estrategia de precarga selectiva para rutas públicas del storefront e informativas/legales.
 * Permite que los chunks lazy de /catalogo, /producto/:id, /ayuda, /informacion/*, /terminos y /privacidad
 * estén listos en memoria y en el caché del Service Worker sin cargar módulos pesados de administración.
 */
@Injectable({ providedIn: 'root' })
export class PublicStorefrontPreloadingStrategy implements PreloadingStrategy {
  private readonly publicPaths = new Set([
    'catalogo',
    'busqueda',
    'ayuda',
    'informacion/envios',
    'informacion/cancelaciones',
    'informacion/pagos',
    'terminos',
    'privacidad',
    'mapa-sitio',
    'producto/:id'
  ]);

  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return of(null);
    }
    if (route.path && this.publicPaths.has(route.path)) {
      return timer(1800).pipe(switchMap(() => load()));
    }
    return of(null);
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: 'es-MX' },
    provideRouter(
      routes,
      withPreloading(PublicStorefrontPreloadingStrategy),
      withInMemoryScrolling({
        scrollPositionRestoration: 'top', // Scroll al top al navegar entre rutas
        anchorScrolling: 'enabled'        // Soporte para fragmentos #id
      })
    ),
    provideHttpClient(withXhr(), withInterceptors([
      offlineInterceptor,
      browserCompatibilityInterceptor,
      authInterceptor,
      sanitizationInterceptor
    ])),
    importProvidersFrom(ReactiveFormsModule),
    provideAnimations(),
    provideServiceWorker('ngsw-worker.js', {
        enabled: !isDevMode(),
        registrationStrategy: 'registerImmediately'
    })
  ]
};

