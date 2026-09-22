import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';


export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Rutas públicas que NO deben redirigir a login en caso de 401
  const publicUrls = [
    '/api/public/',                // ← STOREFRONT: todas las rutas públicas del catálogo
    '/auth/check-username',        // Validación username - variante 1
    '/api/auth/check-username',    // Validación username - variante 2
    '/login',                      // Login de usuario
    '/register',                   // Registro de usuario
    '/check-username',             // Validación username - variante 3
    '/forgot-password',            // Recuperación de contraseña
    '/reset-password',             // Reset de contraseña (frontend route)
    '/validate-reset-token',       // Validación del token de reset (backend endpoint)
    '/api/auth/validate-reset-token', // Validación (ruta completa) - coincidencia adicional
    '/verify-email',               // Verificación de email
    '/auth/login',                 // Login alternativo
    '/auth/register',              // Registro alternativo
    '/api/coupons/active',         // Cupones activos (público)
    '/api/coupons/check',          // Verificar disponibilidad de cupón (público)
    '/api/coupons/validate',       // Validar cupón (público)
    '/api/reviews/product',        // Ver reseñas de producto (público)
    '/api/reviews/statistics'      // Estadísticas de reseñas (público)
  ];

  const isPublicUrl = publicUrls.some(url => req.url.includes(url));

  // Rutas explícitamente públicas donde un 401 no debe forzar login si no hay token
  const publicEndpoints = [
    '/api/products',
    '/api/categories',
    '/api/brands',
    '/api/public',
    '/api/alexa',
    '/actuator/health'
  ];
  const isPublicEndpoint = publicEndpoints.some(url => req.url.includes(url));

  // También detectar peticiones marcadas como públicas por headers
  const isMarkedAsPublic = req.headers.has('X-Public-Request');

  const isPublicRequest = isPublicUrl || isMarkedAsPublic || isPublicEndpoint;

  // Rutas del frontend (UI) donde no se debe interrumpir la navegación por un 401 sin token
  const publicFrontendRoutes = ['/catalogo', '/producto', '/inicio', '/login', '/register', '/'];
  const isPublicFrontendRoute = publicFrontendRoutes.some(route => router.url.startsWith(route) && router.url !== '/');
  const isRootRoute = router.url === '/';

  const token = localStorage.getItem('token');

  let authReq = req;
  // NO enviar el JWT a dominios externos (ej. Iconify)
  const isExternalApi = req.url.includes('api.iconify.design');
  
  if (token && !isExternalApi) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(authReq).pipe(
    catchError(error => {
      if (error.status === 401) {
        // Condiciones para redirigir a login:
        // 1. Había un token (sesión expirada real)
        // 2. O el endpoint solicitado es claramente privado (no está en publicEndpoints)
        // 3. Y no estamos ya en una ruta pública del frontend sin token
        const shouldRedirect = token || (!isPublicEndpoint && !(isPublicFrontendRoute || isRootRoute));

        if (shouldRedirect) {
          authService.logout();
          router.navigate(['/login'], {
            queryParams: { reason: 'session_expired' }
          });
        }
      }

      if (error.status === 403 && !isPublicRequest) {
        if (error.error?.code === 'SECURITY_HIERARCHY_VIOLATION') {
          import('sweetalert2').then(module => {
            const Swal = module.default;
            Swal.fire({
              icon: 'warning',
              title: 'Acción restringida',
              text: 'Esta acción está protegida por la jerarquía de seguridad del sistema.',
              footer: '<small>Si necesitas realizar este cambio, solicita autorización al propietario técnico.</small>',
              confirmButtonColor: '#722f37'
            });
          });
        } else if (!environment.production) {
          console.warn('[AuthInterceptor] 403 Forbidden:', req.url);
        }
      }

      return throwError(() => error);
    })
  );
};
