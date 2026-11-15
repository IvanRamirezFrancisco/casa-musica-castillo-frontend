import { Injectable } from '@angular/core';
import { HttpResponse, HttpInterceptor, HttpRequest, HttpHandler } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

/**
 * Interceptor HTTP para sanitización automática de respuestas
 */
@Injectable()
export class SanitizationInterceptor implements HttpInterceptor {

  constructor() { }

  /**
   * Interceptar y sanitizar respuesta HTTP
   */
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<any> {
    return next.handle(req).pipe(
      map((response: any) => {
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

          // Sanitizar el cuerpo de la respuesta si es necesario
          if (typeof response.body === 'object') {
            const sanitizedBody = this.sanitizeResponse(response.body);
            return response.clone({ body: sanitizedBody });
          }
        }
        return response;
      }),
      catchError((error: any) => {
        // Sanitizar mensajes de error
        if (error?.error?.message) {
          error.error.message = this.sanitizeText(error.error.message);
        }
        return throwError(() => error);
      })
    );
  }

  /**
   * Sanitizar respuesta del servidor
   */
  private sanitizeResponse(data: any): any {
    if (!data) return data;
    
    if (typeof data === 'string') {
      return this.sanitizeText(data);
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeResponse(item));
    }
    
    if (typeof data === 'object') {
      const sanitized: any = {};
      Object.keys(data).forEach(key => {
        sanitized[key] = this.sanitizeResponse(data[key]);
      });
      return sanitized;
    }
    
    return data;
  }

  /**
   * Sanitizar texto eliminando HTML peligroso
   */
  private sanitizeText(text: string): string {
    if (!text) return '';
    
    // Eliminar scripts y contenido peligroso
    let clean = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    clean = clean.replace(/javascript:/gi, '');
    clean = clean.replace(/on\w+\s*=/gi, '');
    
    return clean;
  }
}