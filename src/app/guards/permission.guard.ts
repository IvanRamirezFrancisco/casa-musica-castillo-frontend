import { Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router
} from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * PermissionGuard — Capa 4 de Ciberseguridad UX.
 *
 * Protege rutas individuales del panel de administración basándose en permisos
 * granulares definidos en el campo `data` de cada ruta:
 *
 *   { path: 'products', component: ..., canActivate: [PermissionGuard],
 *     data: { requiredPermission: 'PRODUCT_READ' } }
 *
 * Lógica de decisión:
 *  - Si la ruta no declara `requiredPermission`, se permite el acceso (ruta pública dentro del admin).
 *  - Si el usuario tiene el permiso, se permite el acceso.
 *  - Si no, se redirige al primer módulo al que SÍ tiene acceso (fallback inteligente).
 *
 * Nota: Este guard asume que AuthGuard / AdminGuard ya verificaron que el usuario
 * está autenticado y tiene rol de admin. PermissionGuard solo evalúa permisos granulares.
 */
@Injectable({
  providedIn: 'root'
})
export class PermissionGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot, _state: RouterStateSnapshot): boolean {
    const requiredPermission: string | string[] | undefined = route.data?.['requiredPermission'];

    // Si la ruta no requiere permiso específico, permitir acceso
    if (!requiredPermission) {
      return true;
    }

    // Verificar si el usuario tiene el permiso requerido
    if (Array.isArray(requiredPermission)) {
      if (this.authService.hasAnyPermission(requiredPermission)) {
        return true;
      }
    } else {
      if (this.authService.hasPermission(requiredPermission)) {
        return true;
      }
    }

    // No tiene permiso: navegar al primer módulo accesible
    this.navigateToFirstAccessibleRoute();
    return false;
  }

  /**
   * Navega al primer módulo al que el usuario tiene acceso.
   * Evita mostrar pantallas de error innecesarias: en lugar de bloquear,
   * redirige silenciosamente al primer módulo disponible.
   */
  private navigateToFirstAccessibleRoute(): void {
    const fallbackRoutes: Array<{ permission: string; route: string }> = [
      { permission: 'DASHBOARD_VIEW',  route: '/admin/dashboard'  },
      { permission: 'PRODUCT_READ',    route: '/admin/products'   },
      { permission: 'ORDER_READ',      route: '/admin/orders'     },
      { permission: 'CUSTOMER_READ',   route: '/admin/customers'  },
      { permission: 'USER_READ',       route: '/admin/staff'      },
      { permission: 'ROLE_READ',       route: '/admin/roles'      },
      { permission: 'BRAND_MANAGE',    route: '/admin/brands'     },
      { permission: 'CATEGORY_MANAGE', route: '/admin/categories' },
    ];

    for (const entry of fallbackRoutes) {
      if (this.authService.hasPermission(entry.permission)) {
        this.router.navigate([entry.route], { replaceUrl: true });
        return;
      }
    }

    // Último fallback: si no tiene ningún permiso de módulo, redirigir al home
    this.router.navigate(['/home'], { replaceUrl: true });
  }
}
