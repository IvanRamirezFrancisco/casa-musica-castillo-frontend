import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { ConnectivityService } from '../services/connectivity.service';

/**
 * Resuelve el origen del backend a partir de environment.apiUrl.
 * Solo las peticiones dirigidas a ese origen (o a rutas relativas /api/)
 * se consideran "operaciones dinámicas que requieren Internet".
 */
const apiOrigin = (() => {
  try {
    return new URL(environment.apiUrl).origin;
  } catch {
    return null;
  }
})();

function isBackendRequest(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin);
    if (apiOrigin && parsed.origin === apiOrigin) {
      return true;
    }
    return parsed.origin === window.location.origin && parsed.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

/**
 * Si no hay conexión, las llamadas al backend fallan de inmediato y de forma
 * controlada (status 0 + mensaje explicativo) en lugar de quedar colgadas o
 * parecer exitosas. No toca headers (Authorization), no persiste nada y no
 * interviene en recursos estáticos, CDNs ni en el Service Worker.
 */
export const offlineInterceptor: HttpInterceptorFn = (req, next) => {
  const connectivity = inject(ConnectivityService);

  if (!connectivity.isOnline && isBackendRequest(req.url)) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      // Solo las acciones del usuario (escritura) muestran aviso, y es un toast discreto.
      connectivity.notifyOfflineAction();
    }
    return throwError(() => new HttpErrorResponse({
      url: req.url,
      status: 0,
      statusText: 'Offline',
      error: {
        offline: true,
        message: 'Sin conexión. Esta acción requiere conexión a Internet.'
      }
    }));
  }

  return next(req);
};
