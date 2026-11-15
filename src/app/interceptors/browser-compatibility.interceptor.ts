import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, finalize } from 'rxjs/operators';
import { throwError } from 'rxjs';

// FASE 1.3 — CORS fix — 2026-05-16
//
// CAUSA RAÍZ: El interceptor original agregaba estos headers a TODA petición HTTP:
//   - 'Expires: 0'
//   - 'Pragma: no-cache'
//   - 'Cache-Control: no-cache, no-store, must-revalidate'
//   - 'Content-Type: application/json' (forzado si no existía)
//
// 'Expires' NO es un CORS-safelisted request header (ver fetch spec §2.2.2).
// Cuando Angular enviaba esta petición cross-origin, el navegador incluía
// 'expires' en el header Access-Control-Request-Headers del preflight OPTIONS.
// Si el backend no responde con 'expires' en Access-Control-Allow-Headers,
// el navegador BLOQUEA la petición real (POST /api/auth/login, etc.).
//
// FIX: Eliminar todos los headers custom del interceptor. No enviar Expires,
// Pragma ni Cache-Control como request headers globales. El anti-caché
// debe manejarse desde el backend (response headers) o con query params.

/**
 * Interceptor de compatibilidad cross-browser.
 *
 * Responsabilidad post-FASE 1.3:
 *  - Manejo amigable de errores de red (status 0 / -1).
 *  - NO agrega headers custom a las peticiones (previene bloqueo CORS).
 */
export const browserCompatibilityInterceptor: HttpInterceptorFn = (req, next) => {

  // FASE 1.3: Ya NO se clonan headers. La petición pasa tal cual.
  // Angular/HttpClient agrega Content-Type automáticamente cuando hay body.

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Error de red real (CORS, desconexión, timeout de red)
      if (error.status === 0 || error.status === -1) {
        const friendlyError = new HttpErrorResponse({
          error: {
            message: 'Problema de conectividad. Verifica tu conexión a internet.',
            originalStatus: error.status
          },
          status: 0,
          statusText: 'Network Error'
        });
        return throwError(() => friendlyError);
      }

      // 401/403 los maneja authInterceptor — aquí solo pasamos
      return throwError(() => error);
    }),
    finalize(() => {
      // Debug solo cuando window.debug = true (desarrollo manual)
      if (typeof window !== 'undefined' && (window as any)['debug']) {
        console.debug('[BrowserCompat] Request completed:', req.url);
      }
    })
  );
};