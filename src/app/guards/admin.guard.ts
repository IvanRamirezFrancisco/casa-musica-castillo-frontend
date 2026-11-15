import { Injectable } from '@angular/core';
import { Router, CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

/**
 * AdminGuard — Protege todas las rutas bajo /admin.
 *
 * Delega completamente la decisión a `AuthService.isStaff()`, que:
 *  - Lee las authorities desde el JWT (roles + permisos expandidos).
 *  - Retorna true para ROLE_SUPER_ADMIN, ROLE_ADMIN, o cualquier rol
 *    que NO sea ROLE_USER (empleados con roles personalizados como
 *    ROLE_VR_DASHBOARD también pasan correctamente).
 *  - Retorna false para clientes que solo tienen ROLE_USER.
 *
 * Las restricciones por sub-módulo son responsabilidad de PermissionGuard.
 */
@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    return this.authService.getCurrentUser().pipe(
      take(1),
      map(user => {
        // Sin usuario → redirigir al login
        if (!user) {
          this.router.navigate(['/login'], {
            queryParams: { returnUrl: state.url },
            replaceUrl: true
          });
          return false;
        }

        // isStaff() usa JWT para cubrir roles personalizados como ROLE_VR_DASHBOARD
        if (this.authService.isStaff()) {
          return true;
        }

        // Cliente normal (solo ROLE_USER) → tienda pública
        this.router.navigate(['/home'], { replaceUrl: true });
        return false;
      })
    );
  }
}
