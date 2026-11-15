import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { map, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { SanitizationService } from '../services/sanitization.service';

/**
 * Interceptor funcional para sanitización automática de respuestas HTTP
 */
export const sanitizationInterceptor: HttpInterceptorFn = (req, next) => {
  const sanitizationService = inject(SanitizationService);

  return next(req).pipe(
    map(response => {
      // Solo sanitizar respuestas HTTP con cuerpo de datos
      if (response instanceof HttpResponse && response.body) {
        // Ignorar descargas de archivos y contenido binario
        if (
          response.body instanceof Blob ||
          response.body instanceof File ||
          response.body instanceof ArrayBuffer ||
          response.body instanceof FormData
        ) {
          return response;
        }

        if (typeof response.body === 'object') {
          const sanitizedBody = sanitizeObject(response.body, sanitizationService);
          return response.clone({ body: sanitizedBody });
        }
      }
      return response;
    }),
    catchError(error => {
      // Sanitizar mensajes de error
      if (error?.error?.message && typeof error.error.message === 'string') {
        error.error.message = sanitizationService.sanitizeText(error.error.message);
      }
      
      // Sanitizar otros mensajes de error
      if (error?.message && typeof error.message === 'string') {
        error.message = sanitizationService.sanitizeText(error.message);
      }
      
      return throwError(() => error);
    })
  );
};

/**
 * Función auxiliar para sanitizar objetos profundamente
 */
function sanitizeObject(obj: any, sanitizationService: SanitizationService): any {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    return sanitizationService.sanitizeText(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, sanitizationService));
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {};
    Object.keys(obj).forEach(key => {
      // No sanitizar campos sensibles como tokens, passwords, etc.
      const skipSanitization = [
        'accesstoken', 'refreshtoken', 'token', 'password', 'hash',
        'preauthchallenge', 'signature', 'secret', 'key', 'id', 'uuid', 'timestamp'
      ];
      
      if (skipSanitization.includes(key.toLowerCase())) {
        sanitized[key] = obj[key]; // Mantener valor original
      } else {
        sanitized[key] = sanitizeObject(obj[key], sanitizationService);
      }
    });
    return sanitized;
  }
  
  return obj;
}