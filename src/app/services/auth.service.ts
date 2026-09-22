import { Injectable, inject, Injector } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, catchError, throwError, map, of } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

import { AuthResponse, User } from '../models/user.model';
import { ApiResponse } from '../models/api-response.model';
import { CartService } from './cart.service';
import { NotificationCenterService } from '../core/services/notification-center.service';
// En auth.service.ts, asegúrate de importar User desde models

// export interface User {
//   id: string;
//   email: string;
//   name: string;
// }



// // REEMPLAZAR POR:
// export interface User {
//   id: number;
//   firstName: string;
//   lastName: string;
//   email: string;
//   phone?: string;
//   enabled: boolean;
//   twoFactorEnabled: boolean;
//   roles: string[];
//   createdAt: string;
//   updatedAt: string;
// }

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

// Interfaz para la respuesta de Spring Boot
export interface SpringBootAuthResponse {
  success: boolean;
  message: string;
  data?: {
    // ✅ AGREGADO: Estructura para respuesta con jwtResponse
    jwtResponse?: {
      accessToken?: string;
      tokenType?: string;
      expiresIn?: number;
      user?: User;
    };
    sessionManagement?: {
      activeSessions?: number;
      maxSessions?: number;
      sessionInfo?: string;
    };
    // Estructura anterior para compatibilidad
    accessToken?: string;
    tokenType?: string;
    expiresIn?: number;
    expiresAt?: string | null;
    user?: User;
    twoFactorRequired?: boolean;
    pendingUser?: User;
  };
  // Soporta todos los formatos posibles en la raíz:
  accessToken?: string;
  tokenType?: string;
  token?: string; // <-- AGREGA ESTA LÍNEA
  user?: User;
  twoFactorRequired?: boolean;
  pendingUser?: User;
}

// Interfaz que usará internamente el frontend
// export interface AuthResponse {
//   token?: string;
//   user?: User;
//   twoFactorRequired?: boolean;
//   pendingUser?: User;
//   message?: string;
//   // Si tu backend responde con un objeto "data", puedes agregarlo así:
//   data?: {
//     twoFactorRequired?: boolean;
//     user?: User;
//     [key: string]: any;
//   };
// }
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = `${environment.apiUrl}/auth`;
  private tokenSubject = new BehaviorSubject<string | null>(this.getStoredToken());
  private userSubject = new BehaviorSubject<User | null>(this.getStoredUser());

  public token$ = this.tokenSubject.asObservable();
  public user$ = this.userSubject.asObservable();
  public isLoggedIn$ = new BehaviorSubject<boolean>(this.isAuthenticated());

  // Inyección lazy para evitar dependencia circular AuthService ↔ CartService
  private cartService = inject(CartService);

  // Inyección lazy para evitar dependencia circular AuthService ↔ NotificationCenterService
  private injector = inject(Injector);
  private _notifService: NotificationCenterService | null = null;
  private get notifService(): NotificationCenterService {
    if (!this._notifService) {
      this._notifService = this.injector.get(NotificationCenterService);
    }
    return this._notifService;
  }

  constructor(private http: HttpClient, private router: Router) {
    // FASE 0 - Seguridad - 2026-05-15
    // window.debugPermissions se expone globalmente SOLO en desarrollo local.
    // En producción este bloque no se ejecuta, evitando filtrar
    // información de permisos/roles en DevTools.
    if (!environment.production) {
      (window as any).debugPermissions = () => this.debugPermissions();
    }
  }






  



login(credentials: LoginRequest): Observable<AuthResponse> {
  return this.http.post<SpringBootAuthResponse>(`${this.API_URL}/login`, credentials)
    .pipe(
      map(response => {
        // Maneja el caso donde la respuesta indica que se requiere 2FA
        if (response.data?.twoFactorRequired || response.twoFactorRequired) {
          return {
            twoFactorRequired: true,
            pendingUser: response.data?.user ?? response.user
          } as AuthResponse;
        }
        
        // Buscar token en la estructura correcta de respuesta
        const token = response.data?.jwtResponse?.accessToken ?? 
                     response.data?.accessToken ?? 
                     response.accessToken ?? 
                     response.token;
                     
        const user = response.data?.jwtResponse?.user ?? 
                    response.data?.user ?? 
                    response.user;
        
        if (token && user) {
          return {
            token,
            user
          } as AuthResponse;
        }
        
        // Si no hay token ni usuario, respuesta inválida
        return {
          message: 'Respuesta de login inválida'
        } as AuthResponse;
      }),
      tap(response => {
        if (response.token && response.user) {
          this.setSession(response);
        }
      }),
      catchError(error => throwError(() => error))
    );
}
   getCurrentUserFromBackend(): Observable<User | null> {
    const token = this.getStoredToken();

    // Si no hay token válido, no llamar al backend
    if (!token) {
      return of(null);
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.get<any>(`${environment.apiUrl}/users/profile`, { headers }).pipe(
      map(response => {
        // El endpoint devuelve ApiResponse con los datos en .data
        if (response.success && response.data) {
          return response.data as User;
        }
        return null;
      }),
      catchError(err => {
        if (err?.status === 401) {
          this.logout();
        }
        return of(null);
      })
    );
  }

  register(userData: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<SpringBootAuthResponse>(`${this.API_URL}/register`, userData)
      .pipe(
        map(response => {
          const adaptedResponse: AuthResponse = {
            token: response.accessToken,
            user: response.user
          };
          return adaptedResponse;
        }),
        tap(response => {
          this.setSession(response);
        }),
        catchError(error => {
          return throwError(() => error);
        })
      );
  }

  logout(): void {
    const currentUrl = this.router.url;
    
    if (['/login', '/register', '/'].includes(currentUrl)) {
      return;
    }
    
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.tokenSubject.next(null);
    this.userSubject.next(null);
    this.isLoggedIn$.next(false);
    this.cartService.clearLocal();
    this.notifService.clearAll();
    
    this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    const token = this.getStoredToken();
    const isValid = !!token && !this.isTokenExpired(token);
    return isValid;
  }

  private setSession(authResult: AuthResponse): void {
    if (authResult.token && authResult.token.trim() !== '') {
      localStorage.setItem('token', authResult.token);
      this.tokenSubject.next(authResult.token);
    } else {
      localStorage.removeItem('token');
      this.tokenSubject.next(null);
    }

    // Guardar usuario solo si existe
    if (authResult.user) {
      localStorage.setItem('user', JSON.stringify(authResult.user));
      this.userSubject.next(authResult.user);
    } else {
      localStorage.removeItem('user');
      this.userSubject.next(null);
    }

    const token = this.getStoredToken();
    this.isLoggedIn$.next(!!token && !this.isTokenExpired(token));

    // Cargar carrito del backend SOLO para clientes (empleados no tienen carrito)
    if (token && !this.isStaff()) {
      this.cartService.loadCart();
    }
  }


  public completeLogin(token: string, user: User): void {
    if (token && token.trim() !== '') {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      this.tokenSubject.next(token);
      this.userSubject.next(user);
      this.isLoggedIn$.next(true);
      // Cargar carrito del backend SOLO para clientes (empleados no tienen carrito y reciben 403)
      if (!this.isStaff()) {
        this.cartService.loadCart();
      }
    }
  }

  private getStoredToken(): string | null {
    try {
      const token = localStorage.getItem('token');
      return token && token !== 'null' && token !== 'undefined' ? token : null;
    } catch (error) {
      localStorage.removeItem('token');
      return null;
    }
  }
  
  private getStoredUser(): User | null {
    try {
      const userData = localStorage.getItem('user');
      
      if (!userData || userData === 'null' || userData === 'undefined') {
        return null;
      }
      
      return JSON.parse(userData);
    } catch (error) {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      return null;
    }
  }
  
  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const isExpired = payload.exp * 1000 < Date.now();
      return isExpired;
    } catch (error) {
      return true;
    }
  }


  verifyTwoFactor(payload: { email: string; code: string; method: string }): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/2fa/verify`, payload);
  }

  /**
   * Enviar código 2FA por email durante el login
   */
  sendTwoFactorCode(email: string, method: 'EMAIL'): Observable<any> {
    // El endpoint en el backend es /api/2fa/send-login-code
    return this.http.post<any>(`${environment.apiUrl}/2fa/send-login-code`, {
      email: email,
      method: method
    });
  }

  // ===== NUEVOS MÉTODOS PARA MÚLTIPLES 2FA =====

  /**
   * Desactivar método específico de 2FA
   */
  disableSpecificTwoFactor(method: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${environment.apiUrl}/2fa/disable/${method}`, {});
  }

  /**
   * Obtener métodos 2FA disponibles
   */
  getAvailableTwoFactorMethods(): Observable<ApiResponse<{[key: string]: boolean}>> {
    return this.http.get<ApiResponse<{[key: string]: boolean}>>(`${environment.apiUrl}/2fa/methods`);
  }

  /**
   * Obtener usuario actual como observable (asíncrono)
   */
  getCurrentUser(): Observable<User | null> {
    return this.userSubject.asObservable();
  }

  /**
   * Obtener usuario actual de forma sincrónica (snapshot).
   * Útil para guards y lógica de permisos que no pueden esperar un Observable.
   * Lee del BehaviorSubject primero; si es null, intenta localStorage como fallback.
   */
  getCurrentUserSnapshot(): User | null {
    return this.userSubject.getValue() ?? this.getStoredUser();
  }

  /**
   * Extrae el array COMPLETO de authorities (roles + permisos granulares).
   *
   * El backend ahora envía tanto `roles` (nombres de rol) como `permissions`
   * (permisos granulares expandidos) en el UserResponse. Además, el JWT
   * contiene ambos aplanados en la claim "roles".
   *
   * Fuentes de datos en orden de prioridad:
   *  1. user.roles + user.permissions del localStorage (más confiable, viene del UserResponse)
   *  2. JWT "roles" claim → conjunto completo (rol + permisos expandidos)
   *
   * @returns string[] con todos los roles y permisos del usuario activo.
   */
  getRolesAndPermissions(): string[] {
    // --- Fuente 1: user.roles + user.permissions del localStorage (UserResponse del backend) ---
    const user = this.getCurrentUserSnapshot();
    if (user) {
      const combined: string[] = [];
      if (Array.isArray(user.roles)) {
        combined.push(...user.roles);
      }
      if (Array.isArray(user.permissions)) {
        // Agregar solo permisos que no estén ya en roles (evitar duplicados)
        user.permissions.forEach(p => {
          if (!combined.includes(p)) combined.push(p);
        });
      }
      if (combined.length > 0) return combined;
    }

    // --- Fuente 2: JWT claim "roles" (fallback por si localStorage no tiene permissions) ---
    const token = this.getStoredToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const jwtRoles: unknown = payload['roles'];
        if (Array.isArray(jwtRoles) && jwtRoles.length > 0) {
          return jwtRoles as string[];
        }
        if (jwtRoles && typeof jwtRoles === 'object') {
          const vals = Object.values(jwtRoles as Record<string, string>);
          if (vals.length > 0) return vals;
        }
      } catch {
        // token mal formado → retornar vacío
      }
    }

    return [];
  }

  /**
   * Verifica si el usuario actual tiene un permiso o rol específico.
   *
   * Reglas:
   *  1. ROLE_SUPER_ADMIN tiene acceso universal.
   *  2. ROLE_ADMIN tiene acceso a todos los módulos excepto los exclusivos de SUPER_ADMIN.
   *  3. Para el resto, se verifica pertenencia exacta al array de authorities.
   *
   * @param permission  Nombre del permiso o rol a verificar (ej. 'PRODUCT_READ')
   */
  hasPermission(permission: string): boolean {
    const allAuthorities = this.getRolesAndPermissions();
    if (allAuthorities.length === 0) return false;

    // SUPER_ADMIN tiene acceso total
    if (allAuthorities.includes('ROLE_SUPER_ADMIN')) return true;

    // Removemos el bypass implícito de ROLE_ADMIN. 
    // Ahora debe tener el permiso explícitamente asignado.
    return allAuthorities.includes(permission);
  }

  /**
   * Verifica si el usuario tiene AL MENOS UNO de los permisos indicados.
   */
  hasAnyPermission(permissions: string[]): boolean {
    return permissions.some(p => this.hasPermission(p));
  }

  isProtectedOwner(): boolean {
    const user = this.getCurrentUserSnapshot();
    return !!user?.protectedOwner;
  }

  canAccessOwnerFeatures(): boolean {
    return this.isProtectedOwner() && this.getRolesAndPermissions().includes('ROLE_SUPER_ADMIN');
  }

  isStoreManager(): boolean {
    return this.getRolesAndPermissions().includes('ROLE_STORE_MANAGER');
  }

  isTechnicalAdmin(): boolean {
    const authorities = this.getRolesAndPermissions();
    return authorities.includes('ROLE_SUPER_ADMIN') || authorities.includes('ROLE_ADMIN');
  }

  /**
   * Determina si el usuario activo es un empleado/staff del panel admin.
   *
   * Lógica de decisión (en orden de prioridad):
   *  1. Si el backend envió `isCustomer` === true  → es cliente → NO es staff.
   *  2. Si el backend envió `isCustomer` === false → es empleado → SÍ es staff.
   *  3. Fallback (por si isCustomer no llegó): si tiene ROLE_SUPER_ADMIN/ROLE_ADMIN → staff.
   *  4. Fallback: si NO tiene ROLE_USER → es staff (los empleados nunca reciben ROLE_USER).
   *  5. Si solo tiene ROLE_USER → es cliente.
   */
  isStaff(): boolean {
    const user = this.getCurrentUserSnapshot();

    // Fuente más confiable: el flag isCustomer del backend
    if (user && user.isCustomer === true) return false;
    if (user && user.isCustomer === false) return true;

    // Fallback: inferir desde authorities
    const allAuthorities = this.getRolesAndPermissions();
    if (allAuthorities.length === 0) return false;

    // Admins explícitos → siempre staff
    if (allAuthorities.includes('ROLE_SUPER_ADMIN') ||
        allAuthorities.includes('ROLE_ADMIN') ||
        allAuthorities.includes('ADMIN')) {
      return true;
    }

    // Un empleado NUNCA tiene ROLE_USER; un cliente SIEMPRE tiene ROLE_USER
    if (!allAuthorities.includes('ROLE_USER')) {
      return true;
    }

    return false;
  }

  /**
   * Verifica si el usuario actual tiene un rol específico.
   * @param roleName  Nombre del rol (ej. 'ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_USER')
   */
  hasRole(roleName: string): boolean {
    const allAuthorities = this.getRolesAndPermissions();
    return allAuthorities.includes(roleName);
  }

  /**
   * Verifica si el usuario actual es SUPER_ADMIN.
   * SUPER_ADMIN tiene acceso universal a todo el sistema.
   */
  isSuperAdmin(): boolean {
    return this.hasRole('ROLE_SUPER_ADMIN');
  }

  /**
   * Verifica si el usuario actual es ADMIN o SUPER_ADMIN.
   * Útil para mostrar/ocultar elementos que requieren nivel administrativo base.
   */
  isAdmin(): boolean {
    return this.hasRole('ROLE_ADMIN') || this.isSuperAdmin();
  }

  /**
   * Navega al primer módulo al que el usuario tiene acceso tras el login.
   * Si se proporciona una returnUrl, valida que pertenezca al Allowlist estricto.
   */
  public resolveSafeReturnUrl(url: string | null): string | null {
    if (!url) return null;

    // Minimal Allowlist de rutas protegidas que pueden requerir redirección tras login
    const ALLOWED_ROUTES = [
      '/orders/my',
      '/checkout',
      '/carrito',
      '/wishlist'
    ];

    try {
      // Usar URL API para validar path y bloquear open redirects (http://, javascript:, etc.)
      // Al anteponer un dummy origin, podemos parsear de forma segura si la URL intenta salir del dominio.
      const parsedUrl = new URL(url, 'http://dummy.local');
      
      // Bloquear explícitamente redirects que intentan escapar o inyectar schemes
      if (parsedUrl.origin !== 'http://dummy.local') {
        return null;
      }
      
      const path = parsedUrl.pathname;
      
      // Verificar si el path exacto o su base está en el allowlist
      // Utilizamos === o validación estricta de segmentos para evitar ataques como /orders/my-malicious
      const isAllowed = ALLOWED_ROUTES.some(allowedRoute => {
        // Coincidencia exacta
        if (path === allowedRoute) return true;
        // Coincidencia de subrutas seguras (ej. /orders/my/123)
        if (path.startsWith(allowedRoute + '/')) return true;
        return false;
      });

      if (isAllowed) {
        // Reconstruimos la url solo con pathname y search params, ignorando posibles payloads XSS en el hash
        return path + parsedUrl.search;
      }
    } catch (e) {
      return null;
    }

    return null;
  }

  redirectAfterLogin(requestedReturnUrl?: string | null): void {
    const user = this.getCurrentUserSnapshot();
    const allAuthorities = this.getRolesAndPermissions();
    const isStaffResult = this.isStaff();
    
    // 1. Intentar validar y usar returnUrl
    const safeUrl = this.resolveSafeReturnUrl(requestedReturnUrl || null);
    if (safeUrl) {
      if (!environment.production) {
        console.log(`✅ Redirigiendo a returnUrl seguro: ${safeUrl}`);
      }
      this.router.navigateByUrl(safeUrl, { replaceUrl: true });
      return;
    }

    // FASE 0 - Seguridad - 2026-05-15
    // Los logs de auditoría con roles, permisos y datos del usuario
    // solo se imprimen en entornos de desarrollo (!environment.production).
    if (!environment.production) {
      console.group('%c🔐 Auditoría de Login', 'color:#722f37;font-weight:bold;');
      console.log('Usuario:', user?.email);
      console.log('isCustomer (backend):', user?.isCustomer);
      console.log('Roles:', user?.roles);
      console.log('Permissions:', user?.permissions);
      console.log('Authorities completas:', allAuthorities);
      console.log('¿Es Staff?', isStaffResult);
      console.groupEnd();
    }

    // Cliente normal → tienda pública
    if (!isStaffResult) {
      this.router.navigate(['/home'], { replaceUrl: true });
      return;
    }

    // Cascada de permisos para empleados y administradores
    const cascade: Array<{ permission: string; route: string }> = [
      { permission: 'ROLE_SUPER_ADMIN',  route: '/admin/dashboard'  },
      { permission: 'ROLE_ADMIN',        route: '/admin/dashboard'  },
      { permission: 'DASHBOARD_VIEW',    route: '/admin/dashboard'  },
      { permission: 'PRODUCT_READ',      route: '/admin/products'   },
      { permission: 'ORDER_READ',        route: '/admin/orders'     },
      { permission: 'CUSTOMER_READ',     route: '/admin/customers'  },
      { permission: 'USER_READ',         route: '/admin/staff'      },
      { permission: 'ROLE_READ',         route: '/admin/roles'      },
      { permission: 'BRAND_MANAGE',      route: '/admin/brands'     },
      { permission: 'CATEGORY_MANAGE',   route: '/admin/categories' },
      { permission: 'DATABASE_BACKUP',   route: '/admin/backups'    },
      { permission: 'DATABASE_VIEW',     route: '/admin/gestion-db' },
    ];

    for (const entry of cascade) {
      if (this.hasPermission(entry.permission)) {
        if (!environment.production) {
          // FASE 0 - Seguridad - 2026-05-15: log de redirección solo en dev
          console.log(`✅ Redirigiendo a: ${entry.route} (permiso: ${entry.permission})`);
        }
        this.router.navigate([entry.route], { replaceUrl: true });
        return;
      }
    }

    // Staff autenticado pero sin ningún permiso de módulo conocido
    if (!environment.production) {
      console.warn('⚠️ Staff sin permiso de módulo reconocido, redirigiendo a /admin');
    }
    this.router.navigate(['/admin'], { replaceUrl: true });
  }

  /**
   * Actualizar usuario en el BehaviorSubject y localStorage
   */
  updateCurrentUser(user: User | null): void {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
      this.userSubject.next(user);
    } else {
      localStorage.removeItem('user');
      this.userSubject.next(null);
    }
  }

  /**
   * Generar códigos de respaldo
   */
  generateBackupCodes(): Observable<ApiResponse<{codes: string[]}>> {
    return this.http.post<ApiResponse<{codes: string[]}>>(`${environment.apiUrl}/2fa/backup-codes/generate`, {});
  }

  /**
   * Obtener estado de códigos de respaldo
   */
  getBackupCodesStatus(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${environment.apiUrl}/2fa/backup-codes/status`);
  }

  /**
   * Verificar código de respaldo
   */
  verifyBackupCode(payload: { email: string; code: string }): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${environment.apiUrl}/2fa/backup-codes/verify`, payload);
  }

  /**
   * Verificar código de respaldo para login (devuelve JWT)
   */
  verifyBackupCodeForLogin(email: string, code: string): Observable<any> {
    const payload = {
      email: email,
      code: code,
      method: 'BACKUP_CODE'
    };
    
    return this.http.post<any>(`${environment.apiUrl}/2fa/verify`, payload).pipe(
      catchError(error => {
        return throwError(() => error);
      })
    );
  }

  verifyEmail(token: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${environment.apiUrl}/auth/verify-email`, { token })
      .pipe(
        catchError(error => {
          return throwError(() => error);
        })
      );
  }

  /**
   * Desactivar códigos de respaldo
   */
  disableBackupCodes(): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${environment.apiUrl}/2fa/backup-codes/disable`, {});
  }

  // =====================================================================
  //  DEBUG: Herramienta de diagnóstico de permisos (consola del navegador)
  //  Uso: Abrir DevTools → Console → escribir debugPermissions()
  // =====================================================================

  /**
   * Imprime en consola un reporte completo del estado de permisos del usuario
   * activo. Incluye datos del localStorage, JWT, flags derivados y el resultado
   * de hasPermission() para TODOS los permisos del sistema.
   *
   * Callable desde la consola del navegador: `debugPermissions()`
   */
  debugPermissions(): void {
    // FASE 0 - Seguridad - 2026-05-15
    // El método completo es noop en producción.
    // Aunque window.debugPermissions ya está guardado con !environment.production en el constructor,
    // envolver aquí también protege frente a llamadas programáticas desde otros puntos del código.
    if (!environment.production) {
      const user = this.getCurrentUserSnapshot();
      const token = this.getStoredToken();
      const allAuthorities = this.getRolesAndPermissions();

      // ── Decodificar JWT ──
      let jwtPayload: any = null;
      let jwtRoles: string[] = [];
      if (token) {
        try {
          jwtPayload = JSON.parse(atob(token.split('.')[1]));
          const raw = jwtPayload['roles'];
          if (Array.isArray(raw)) jwtRoles = raw;
          else if (raw && typeof raw === 'object') jwtRoles = Object.values(raw) as string[];
        } catch { /* token inválido */ }
      }

      // ── Todos los permisos del sistema ──
      const ALL_PERMISSIONS = [
        'DASHBOARD_VIEW',
        'CUSTOMER_READ', 'CUSTOMER_MANAGE',
        'DATABASE_VIEW', 'DATABASE_BACKUP', 'DATABASE_MAINTAIN', 'DATABASE_AUTOMATE',
        'ORDER_READ',
        'PERMISSION_READ', 'PERMISSION_ASSIGN',
        'PRODUCT_READ', 'PRODUCT_CREATE', 'PRODUCT_UPDATE', 'PRODUCT_DELETE',
        'BRAND_MANAGE', 'CATEGORY_MANAGE',
        'REPORT_VIEW', 'REPORT_EXPORT',
        'ROLE_CREATE', 'ROLE_READ', 'ROLE_UPDATE', 'ROLE_DELETE',
        'SYSTEM_SETTINGS',
        'USER_CREATE', 'USER_READ', 'USER_UPDATE', 'USER_DELETE', 'USER_MANAGE_ROLES'
      ];

      // ── Calcular tabla de permisos ──
      const permissionTable = ALL_PERMISSIONS.map(p => ({
        permiso: p,
        'hasPermission()': this.hasPermission(p) ? '✅' : '❌',
        'en authorities': allAuthorities.includes(p) ? '✅' : '❌'
      }));

      // ── Imprimir reporte ──
      console.group('%c🔐 DEBUG PERMISOS — Reporte completo', 'font-size:14px;font-weight:bold;color:#722f37');

      console.group('👤 Usuario (localStorage)');
      console.log('Email:', user?.email ?? '(no disponible)');
      console.log('ID:', user?.id ?? '(no disponible)');
      console.log('isCustomer:', user?.isCustomer);
      console.log('roles[]:', user?.roles ?? []);
      console.log('permissions[]:', user?.permissions ?? []);
      console.groupEnd();

      console.group('🎫 JWT Token');
      console.log('Token presente:', !!token);
      console.log('JWT roles claim:', jwtRoles);
      if (jwtPayload) {
        console.log('JWT sub:', jwtPayload.sub);
        console.log('JWT exp:', jwtPayload.exp ? new Date(jwtPayload.exp * 1000).toLocaleString() : 'N/A');
      }
      console.groupEnd();

      console.group('🔑 Authorities combinadas (getRolesAndPermissions)');
      console.log('Total:', allAuthorities.length);
      console.log('Lista:', allAuthorities);
      console.groupEnd();

      console.group('🏷️ Flags derivados');
      console.log('isStaff():', this.isStaff());
      console.log('isAuthenticated():', this.isAuthenticated());
      console.log('Es SUPER_ADMIN:', allAuthorities.includes('ROLE_SUPER_ADMIN'));
      console.log('Es ADMIN:', allAuthorities.includes('ROLE_ADMIN'));
      console.log('Tiene ROLE_USER:', allAuthorities.includes('ROLE_USER'));
      console.groupEnd();

      console.group('📋 Resultado hasPermission() por cada permiso del sistema');
      console.table(permissionTable);
      console.groupEnd();

      // ── Diagnóstico automático ──
      console.group('🩺 Diagnóstico');
      const issues: string[] = [];
      if (!user) issues.push('⚠️ No hay usuario en localStorage');
      if (!token) issues.push('⚠️ No hay JWT token almacenado');
      if (user && !Array.isArray(user.permissions)) issues.push('⚠️ user.permissions no es un array — el backend puede no estar enviando permisos');
      if (user && user.isCustomer === undefined) issues.push('⚠️ user.isCustomer es undefined — el backend puede no estar enviando este campo');
      if (user && !user.isCustomer && !allAuthorities.some(a => a !== 'ROLE_USER' && !a.startsWith('ROLE_'))) {
        issues.push('⚠️ El usuario es staff pero no tiene permisos granulares — revisa la asignación de permisos en su rol');
      }
      if (allAuthorities.length === 0) issues.push('🚨 Sin authorities — el usuario no podrá acceder a ningún módulo admin');
      if (issues.length === 0) {
        console.log('%c✅ Sin problemas detectados', 'color:green;font-weight:bold');
      } else {
        issues.forEach(i => console.warn(i));
      }
      console.groupEnd();

      console.groupEnd();

      // Retorno para uso en consola
      console.log('%c💡 Tip: También puedes inspeccionar el objeto retornado', 'color:gray;font-style:italic');
      // FASE 0 - Seguridad - 2026-05-15
      // __lastDebugPermissions solo existe en desarrollo local para depuración.
      // No se expone en producción.
      (window as any).__lastDebugPermissions = {
        user: user ? { email: user.email, id: user.id, isCustomer: user.isCustomer, roles: user.roles, permissions: user.permissions } : null,
        jwtRoles,
        allAuthorities,
        isStaff: this.isStaff(),
        permissionResults: ALL_PERMISSIONS.reduce((acc, p) => ({ ...acc, [p]: this.hasPermission(p) }), {} as Record<string, boolean>)
      };
    }
  }
}
