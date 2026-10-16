import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { ConnectivityService } from '../services/connectivity.service';

/**
 * Resuelve el origen del backend a partir de environment.apiUrl.
 * Solo las peticiones dirigidas a ese origen (o a rutas relativas /api/)
 * se consideran operaciones dinámicas hacia el backend.
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
 * Determina si la petición es un GET público y anónimo hacia endpoints públicos del storefront.
 * Estos endpoints están configurados en los dataGroups del Service Worker (con estrategia freshness),
 * por lo que el Service Worker se encargará de resolverlos offline desde el Cache Storage.
 */
function isPublicStorefrontGet(req: { method: string; url: string; headers: { has: (name: string) => boolean } }): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return false;
  }
  // Si lleva header Authorization (JWT), es privada: jamás debe pasar como caché pública
  if (req.headers.has('Authorization')) {
    return false;
  }
  // Endpoints públicos del storefront (/api/public/...)
  return req.url.includes('/api/public/');
}

/**
 * Interceptor de conectividad offline:
 *
 * 1. GET PÚBLICO DEL STOREFRONT (/api/public/...):
 *    NO se bloquea. Se permite salir al navegador (next(req)) para que el Angular Service Worker
 *    lo intercepte mediante sus dataGroups y sirva la respuesta desde Cache Storage en modo offline.
 *
 * 2. OPERACIONES DE ESCRITURA (POST, PUT, PATCH, DELETE) Y ENDPOINTS PRIVADOS:
 *    Se bloquean inmediatamente con un HttpErrorResponse status 0 controlado y explicativo.
 *    En mutaciones se activa el toast de conectividad.
 *    Esto protege login, registro, carrito privado, checkout, pedidos, pagos y administración.
 */
export const offlineInterceptor: HttpInterceptorFn = (req, next) => {
  const connectivity = inject(ConnectivityService);

  if (!connectivity.isOnline && isBackendRequest(req.url)) {
    // Si es una petición pública GET, dejamos que el Service Worker la resuelva desde su caché
    if (isPublicStorefrontGet(req)) {
      return next(req);
    }

    // Acciones de usuario que modifican estado (POST, PUT, PATCH, DELETE)
    if (req.method !== 'GET' && req.method !== 'HEAD') {
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
