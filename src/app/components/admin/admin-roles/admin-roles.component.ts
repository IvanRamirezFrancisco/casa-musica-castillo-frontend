import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { RoleService } from '../../../services/role.service';
import { AuthService } from '../../../services/auth.service';
import { Role, Permission, PermissionsByCategory, RoleUserDTO, PageResponse } from '../../../models/staff.model';
import { User } from '../../../models/user.model';
import { SecurityConfirmationService } from '../../../services/security-confirmation.service';

declare const Swal: any;

@Component({
  selector: 'app-admin-roles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-roles.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./admin-roles.component.css']
})
export class AdminRolesComponent implements OnInit, OnDestroy {

  roles: Role[] = [];
  allPermissions: Permission[] = [];
  permissionsByCategory: PermissionsByCategory = {};
  loading = false;
  currentUser: User | null = null;
  private destroy$ = new Subject<void>();

  // ── Search ─────────────────────────────────────────────────────
  searchTerm = '';

  // ── Permissions Modal ──────────────────────────────────────────
  showPermissionsModal = false;
  selectedRole: Role | null = null;
  /** IDs de permisos seleccionados. Usamos number[] (inmutable en cada cambio)
   *  para que Angular detecte el cambio y re-renderice el template. */
  selectedPermissions: number[] = [];
  savingPermissions = false;
  /** When true, the permissions modal is read-only (system roles) */
  permissionsModalReadOnly = false;

  // ── Create Role Modal ──────────────────────────────────────────
  showRoleModal = false;
  savingRole = false;
  roleFormData = { name: '', description: '' };

  // ── Role Users Modal ──────────────────────────────────────────
  showUsersModal = false;
  usersModalRole: Role | null = null;
  usersModalLoading = false;
  usersPage: PageResponse<RoleUserDTO> | null = null;
  usersCurrentPage = 0;
  readonly usersPageSize = 8;

  // ── Accordion state (collapsed categories) ────────────────────
  collapsedCategories: Set<string> = new Set();
  createCollapsedCategories: Set<string> = new Set();

  constructor(
    private roleService: RoleService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private securityConfirmation: SecurityConfirmationService
  ) {}

  ngOnInit(): void {
    this.authService.getCurrentUser().pipe(takeUntil(this.destroy$)).subscribe(user => {
      this.currentUser = user;
    });
    this.loadRoles();
    this.loadPermissionsByCategory();

    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        if (params['action'] === 'create' && this.canCreateRole() && !this.showRoleModal) {
          this.openCreateRoleModal();
          this.clearActionParam();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== SEGURIDAD ====================

  isSuperAdmin(): boolean {
    const roles = this.currentUser?.roles;
    if (!roles || roles.length === 0) return false;
    return roles.some(r => {
      const normalized = r?.toUpperCase().replace('ROLE_', '');
      return normalized === 'SUPER_ADMIN';
    });
  }

  isImmutableRole(role: Role): boolean {
    return role.immutable === true;
  }

  /**
   * Determina si el usuario puede editar los permisos de un rol.
   * Requiere: rol no inmutable + (SUPER_ADMIN o tiene PERMISSION_ASSIGN).
   */
  canEditPermissions(role: Role): boolean {
    if (this.isImmutableRole(role)) return false;
    return this.isSuperAdmin() || this.authService.hasPermission('PERMISSION_ASSIGN');
  }

  /**
   * Determina si el usuario puede eliminar un rol.
   * Requiere: rol no inmutable + (SUPER_ADMIN o tiene ROLE_DELETE).
   */
  canDelete(role: Role): boolean {
    if (this.isImmutableRole(role)) return false;
    return this.isSuperAdmin() || this.authService.hasPermission('ROLE_DELETE');
  }

  /**
   * Determina si el usuario puede crear roles nuevos.
   * Requiere: SUPER_ADMIN o ROLE_CREATE.
   */
  canCreateRole(): boolean {
    return this.isSuperAdmin() || this.authService.hasPermission('ROLE_CREATE');
  }

  /**
   * Determina si el usuario tiene acceso de solo lectura a los roles
   * (tiene ROLE_READ pero NO puede crear/editar/eliminar).
   */
  get isReadOnlyMode(): boolean {
    return !this.isSuperAdmin()
      && !this.authService.hasPermission('ROLE_CREATE')
      && !this.authService.hasPermission('ROLE_DELETE')
      && !this.authService.hasPermission('PERMISSION_ASSIGN');
  }

  /**
   * Verifica si un rol es el propio rol del usuario actual.
   * Previene auto-edición de permisos del rol que uno mismo tiene asignado.
   */
  isOwnRole(role: Role): boolean {
    const userRoles = this.currentUser?.roles ?? [];
    return userRoles.some(r => r?.toUpperCase() === role.name?.toUpperCase());
  }

  // ==================== CARGA DE DATOS ====================

  /** Roles filtrados por el termino de busqueda */
  get filteredRoles(): Role[] {
    if (!this.searchTerm.trim()) return this.roles;
    const term = this.searchTerm.trim().toLowerCase();
    return this.roles.filter(r =>
      r.name.toLowerCase().includes(term) ||
      (r.description ?? '').toLowerCase().includes(term)
    );
  }

  loadRoles(): void {
    this.loading = true;
    this.roleService.getAllRoles().pipe(takeUntil(this.destroy$)).subscribe({
      next: (roles) => { this.roles = roles; this.loading = false; },
      error: (err: any) => { console.error('loadRoles error:', err); this.loading = false; }
    });
  }

  loadPermissionsByCategory(): void {
    this.roleService.getPermissionsByCategory().pipe(takeUntil(this.destroy$)).subscribe({
      next: (permissions) => {
        this.permissionsByCategory = permissions;
        this.allPermissions = Object.values(permissions).flat();
      },
      error: (err: any) => { console.error('loadPermissionsByCategory error:', err); }
    });
  }

  // ==================== MODAL DE PERMISOS ====================

  /** Abre el modal de permisos. Se decide el modo (edición/lectura) automáticamente. */
  openPermissionsModal(role: Role): void {
    this.selectedRole = { ...role };
    this.selectedPermissions = role.permissions?.map(p => p.id) ?? [];
    this.collapsedCategories.clear();

    // Forzar lectura si: rol inmutable, usuario sin PERMISSION_ASSIGN, o es su propio rol
    if (this.isImmutableRole(role) || !this.canEditPermissions(role) || this.isOwnRole(role)) {
      this.permissionsModalReadOnly = true;
    } else {
      this.permissionsModalReadOnly = false;
    }

    this.showPermissionsModal = true;
  }

  /** Abre el modal de permisos en modo solo-lectura explícito */
  openPermissionsModalReadOnly(role: Role): void {
    this.selectedRole = { ...role };
    this.selectedPermissions = role.permissions?.map(p => p.id) ?? [];
    this.permissionsModalReadOnly = true;
    this.collapsedCategories.clear();
    this.showPermissionsModal = true;
  }

  closePermissionsModal(): void {
    this.showPermissionsModal = false;
    this.selectedRole = null;
    this.selectedPermissions = [];
    this.permissionsModalReadOnly = false;
  }

  togglePermission(permissionId: number): void {
    if (this.permissionsModalReadOnly) return;
    if (this.selectedPermissions.includes(permissionId)) {
      // Crea un nuevo array sin el elemento → Angular detecta el cambio
      this.selectedPermissions = this.selectedPermissions.filter(id => id !== permissionId);
    } else {
      // Crea un nuevo array con el elemento agregado
      this.selectedPermissions = [...this.selectedPermissions, permissionId];
    }
  }

  isPermissionSelected(permissionId: number): boolean {
    return this.selectedPermissions.includes(permissionId);
  }

  toggleCategory(category: string, selected: boolean): void {
    if (this.permissionsModalReadOnly) return;
    const perms = this.permissionsByCategory[category] ?? [];
    if (selected) {
      // Agrega los IDs de la categoría que no estén ya seleccionados
      const newIds = perms.map(p => p.id).filter(id => !this.selectedPermissions.includes(id));
      this.selectedPermissions = [...this.selectedPermissions, ...newIds];
    } else {
      // Elimina todos los IDs de la categoría
      const categoryIds = new Set(perms.map(p => p.id));
      this.selectedPermissions = this.selectedPermissions.filter(id => !categoryIds.has(id));
    }
  }

  isCategoryFullySelected(category: string): boolean {
    const perms = this.permissionsByCategory[category] ?? [];
    return perms.length > 0 && perms.every(p => this.selectedPermissions.includes(p.id));
  }

  isCategoryPartiallySelected(category: string): boolean {
    const perms = this.permissionsByCategory[category] ?? [];
    const count = perms.filter(p => this.selectedPermissions.includes(p.id)).length;
    return count > 0 && count < perms.length;
  }

  async savePermissions(): Promise<void> {
    if (!this.selectedRole || this.permissionsModalReadOnly) return;

    // --- Validación de Seguridad Extra para PROTECTED_OWNER ---
    const originalPermIds = this.selectedRole.permissions?.map(p => p.id) ?? [];
    const changes = this.securityConfirmation.detectCriticalPermissionChanges(
      originalPermIds,
      this.selectedPermissions,
      this.allPermissions
    );

    if (changes.isCritical) {
      const roleAffected = {
        name: this.selectedRole.name,
        description: this.selectedRole.description
      };
      const confirmed = await this.securityConfirmation.confirmCriticalPermissionAction(roleAffected, changes);
      if (!confirmed) {
        return; // Detener guardado si se cancela
      }
    }
    // ------------------------------------------------------------

    this.savingPermissions = true;
    this.roleService.updateRolePermissions(
      this.selectedRole.id,
      this.selectedPermissions
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        this.savingPermissions = false;
        this.closePermissionsModal();
        const idx = this.roles.findIndex(r => r.id === response.role.id);
        if (idx !== -1) { this.roles[idx] = response.role; }
        Swal.fire({
          title: 'Permisos actualizados',
          text: `Los permisos del rol "${response.role.name}" fueron guardados correctamente.`,
          icon: 'success',
          confirmButtonColor: '#722f37',
          timer: 3000,
          timerProgressBar: true
        });
      },
      error: (err: any) => {
        this.savingPermissions = false;
        Swal.fire({
          title: 'Error',
          text: err.error?.message ?? 'No se pudieron guardar los permisos.',
          icon: 'error',
          confirmButtonColor: '#722f37'
        });
      }
    });
  }

  // ==================== MODAL CREAR ROL ====================

  /** Verifica si el nombre del rol ya existe en el sistema */
  isNameDuplicate(): boolean {
    const rawName = this.roleFormData.name.trim().toUpperCase();
    const fullName = rawName.startsWith('ROLE_') ? rawName : 'ROLE_' + rawName;
    return this.roles.some(r => r.name.toUpperCase() === fullName);
  }

  openCreateRoleModal(): void {
    this.roleFormData = { name: '', description: '' };
    this.selectedPermissions = [];
    this.createCollapsedCategories.clear();
    this.showRoleModal = true;
  }

  closeRoleModal(): void {
    this.showRoleModal = false;
    this.roleFormData = { name: '', description: '' };
    this.selectedPermissions = [];
  }

  private clearActionParam(): void {
    this.router.navigate([], {
      queryParams: { action: null },
      queryParamsHandling: 'merge'
    });
  }

  async saveRole(): Promise<void> {
    let rawName = this.roleFormData.name.trim().toUpperCase();
    if (!rawName) {
      Swal.fire({
        title: 'Campo obligatorio',
        text: 'El nombre del rol es requerido.',
        icon: 'warning',
        confirmButtonColor: '#722f37'
      });
      return;
    }

    if (!rawName.startsWith('ROLE_')) {
      rawName = 'ROLE_' + rawName;
    }

    // Validar nombre duplicado
    if (this.roles.some(r => r.name.toUpperCase() === rawName)) {
      Swal.fire({
        title: 'Nombre duplicado',
        text: `Ya existe un rol con el nombre "${rawName}". Elige un nombre diferente.`,
        icon: 'warning',
        confirmButtonColor: '#722f37'
      });
      return;
    }

    if (this.selectedPermissions.length === 0) {
      Swal.fire({
        title: 'Selecciona al menos un permiso',
        text: 'El rol debe tener al menos un permiso asignado para ser creado.',
        icon: 'warning',
        confirmButtonColor: '#722f37'
      });
      return;
    }

    // --- Validación de Seguridad Extra para PROTECTED_OWNER ---
    const changes = this.securityConfirmation.detectCriticalPermissionChanges(
      [], // originales vacío porque es un rol nuevo
      this.selectedPermissions,
      this.allPermissions
    );

    if (changes.isCritical) {
      const roleAffected = {
        name: rawName,
        description: this.roleFormData.description.trim()
      };
      const confirmed = await this.securityConfirmation.confirmCriticalPermissionAction(roleAffected, changes);
      if (!confirmed) {
        return; // Detener guardado si se cancela
      }
    }
    // ------------------------------------------------------------

    this.savingRole = true;
    this.roleService.createRole({
      name: rawName,
      description: this.roleFormData.description.trim(),
      permissionIds: this.selectedPermissions
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        this.savingRole = false;
        this.closeRoleModal();
        this.roles.push(response.role);
        Swal.fire({
          title: 'Rol creado',
          text: `El rol "${response.role.name}" fue creado correctamente.`,
          icon: 'success',
          confirmButtonColor: '#722f37',
          timer: 3000,
          timerProgressBar: true
        });
      },
      error: (err: any) => {
        this.savingRole = false;
        Swal.fire({
          title: 'Error',
          text: err.error?.message ?? 'No se pudo crear el rol.',
          icon: 'error',
          confirmButtonColor: '#722f37'
        });
      }
    });
  }

  // ==================== MODAL USUARIOS POR ROL ====================

  openRoleUsersModal(role: Role): void {
    this.usersModalRole = role;
    this.usersCurrentPage = 0;
    this.usersPage = null;
    this.showUsersModal = true;
    this.loadRoleUsers();
  }

  closeUsersModal(): void {
    this.showUsersModal = false;
    this.usersModalRole = null;
    this.usersPage = null;
    this.usersCurrentPage = 0;
  }

  loadRoleUsers(): void {
    if (!this.usersModalRole) return;
    this.usersModalLoading = true;
    this.roleService.getUsersByRole(
      this.usersModalRole.id,
      this.usersCurrentPage,
      this.usersPageSize
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: (page) => { this.usersPage = page; this.usersModalLoading = false; },
      error: (err: any) => {
        this.usersModalLoading = false;
        Swal.fire({
          title: 'Error',
          text: err.error?.message ?? 'No se pudieron cargar los usuarios.',
          icon: 'error',
          confirmButtonColor: '#722f37'
        });
      }
    });
  }

  goToUsersPage(page: number): void {
    if (!this.usersPage) return;
    if (page < 0 || page >= this.usersPage.totalPages) return;
    this.usersCurrentPage = page;
    this.loadRoleUsers();
  }

  getUsersPageNumbers(): number[] {
    if (!this.usersPage) return [];
    return Array.from({ length: this.usersPage.totalPages }, (_, i) => i);
  }

  // ==================== ELIMINAR ROL ====================

  deleteRole(role: Role): void {
    this.roleService.getUsersCountForRole(role.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response: { roleId: number; userCount: number }) => {
        const userCount = response.userCount;

        if (userCount > 0) {
          Swal.fire({
            title: 'No se puede eliminar',
            html: `El rol <strong>${role.name}</strong> tiene <strong>${userCount}</strong> usuario(s) asignado(s).<br><br>
                   Primero reasigna a estos <strong>${userCount}</strong> usuarios a otro rol antes de eliminar.`,
            icon: 'warning',
            confirmButtonColor: '#722f37'
          });
          return;
        }

        Swal.fire({
          title: 'Eliminar Rol',
          html: `
            <p style="color:#555; margin-bottom:.5rem;">
              Está por eliminar el rol <strong>${role.name}</strong>.
            </p>
            <p style="color:#722f37; font-size:.875rem;">
              Esta acción no se puede deshacer.
            </p>
          `,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Sí, eliminar',
          cancelButtonText: 'Cancelar',
          confirmButtonColor: '#722f37',
          cancelButtonColor: '#6c757d'
        }).then((result: any) => {
          if (!result.isConfirmed) return;
          this.roleService.deleteRole(role.id).pipe(takeUntil(this.destroy$)).subscribe({
            next: () => {
              this.roles = this.roles.filter(r => r.id !== role.id);
              Swal.fire({
                title: 'Rol eliminado',
                text: `El rol "${role.name}" fue eliminado correctamente.`,
                icon: 'success',
                confirmButtonColor: '#722f37',
                timer: 3000,
                timerProgressBar: true
              });
            },
            error: (err: any) => {
              Swal.fire({
                title: 'No se puede eliminar',
                text: err.error?.message ?? 'No se pudo eliminar el rol.',
                icon: 'error',
                confirmButtonColor: '#722f37'
              });
            }
          });
        });
      },
      error: (err: any) => {
        Swal.fire({
          title: 'Error al verificar usuarios',
          text: err.error?.message ?? 'No se pudo verificar el número de usuarios asignados al rol.',
          icon: 'error',
          confirmButtonColor: '#722f37'
        });
      }
    });
  }

  // ==================== HELPERS ====================

  getCategories(): string[] {
    return Object.keys(this.permissionsByCategory).sort();
  }

  displayName(roleName: string): string {
    return roleName?.replace(/^ROLE_/, '') ?? roleName;
  }

  translateCategory(category: string): string {
    const map: { [k: string]: string } = {
      USER: 'Gestion de Usuarios',
      ROLE: 'Gestion de Roles',
      PERMISSION: 'Permisos del Sistema',
      SYSTEM: 'Configuracion del Sistema',
      PRODUCT: 'Gestion de Productos',
      ORDER: 'Gestion de Pedidos',
      ADMIN: 'Panel de Administracion',
      DATABASE: 'Base de Datos',
      CUSTOMER: 'Gestion de Clientes',
      REPORT: 'Reportes y Exportacion',
      // Legacy categories (backwards compatibility)
      USER_MANAGEMENT: 'Gestion de Usuarios',
      PRODUCT_MANAGEMENT: 'Gestion de Productos',
      ORDER_MANAGEMENT: 'Gestion de Pedidos',
      CONTENT_MANAGEMENT: 'Gestion de Contenido',
      ANALYTICS: 'Analitica y Reportes',
      SECURITY: 'Seguridad',
      ROLE_MANAGEMENT: 'Gestion de Roles'
    };
    return map[category] ?? category.replace(/_/g, ' ');
  }

  getCategoryAbbr(category: string): string {
    const map: { [k: string]: string } = {
      USER: 'US',
      ROLE: 'RL',
      PERMISSION: 'PM',
      SYSTEM: 'SI',
      PRODUCT: 'PR',
      ORDER: 'OR',
      ADMIN: 'AD',
      DATABASE: 'DB',
      CUSTOMER: 'CL',
      REPORT: 'RP',
      // Legacy
      USER_MANAGEMENT: 'US',
      PRODUCT_MANAGEMENT: 'PR',
      ORDER_MANAGEMENT: 'OR',
      CONTENT_MANAGEMENT: 'CN',
      ANALYTICS: 'AN',
      SECURITY: 'SE',
      ROLE_MANAGEMENT: 'RL'
    };
    return map[category] ?? category.slice(0, 2);
  }

  getCategoryIcon(category: string): string {
    const map: { [k: string]: string } = {
      USER: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2|M9 7a4 4 0 1 0 0-0.01|M23 21v-2a4 4 0 0 0-3-3.87|M16 3.13a4 4 0 0 1 0 7.75',
      ROLE: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z|M9 12l2 2 4-4',
      PERMISSION: 'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4',
      SYSTEM: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z|M12 12a3 3 0 1 0 0-0.01',
      PRODUCT: 'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z|M3 6h18|M16 10a4 4 0 0 1-8 0',
      ORDER: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6|M16 13H8|M16 17H8|M10 9H8',
      ADMIN: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z|M9 22V12h6v10',
      DATABASE: 'M12 2C6.48 2 2 4.02 2 6.5v11C2 19.98 6.48 22 12 22s10-2.02 10-4.5v-11C22 4.02 17.52 2 12 2z|M2 6.5C2 8.98 6.48 11 12 11s10-2.02 10-4.5|M2 12c0 2.48 4.48 4.5 10 4.5s10-2.02 10-4.5',
      CUSTOMER: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2|M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
      REPORT: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6|M8 13h8|M8 17h8',
      // Legacy
      USER_MANAGEMENT: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2|M9 7a4 4 0 1 0 0-0.01|M23 21v-2a4 4 0 0 0-3-3.87|M16 3.13a4 4 0 0 1 0 7.75',
      PRODUCT_MANAGEMENT: 'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z|M3 6h18|M16 10a4 4 0 0 1-8 0',
      ORDER_MANAGEMENT: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6|M16 13H8|M16 17H8|M10 9H8',
      CONTENT_MANAGEMENT: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7|M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
      ANALYTICS: 'M18 20V10|M12 20V4|M6 20v-6',
      SECURITY: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
      ROLE_MANAGEMENT: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z|M9 12l2 2 4-4'
    };
    return map[category] ?? 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z';
  }

  /** Traduce un nombre de permiso tecnico a una etiqueta legible */
  translatePermission(permName: string): string {
    const map: { [k: string]: string } = {
      // Usuarios (5)
      USER_CREATE: 'Crear Usuario',
      USER_READ: 'Ver Usuarios',
      USER_UPDATE: 'Actualizar Usuario',
      USER_DELETE: 'Eliminar Usuario',
      USER_MANAGE_ROLES: 'Gestionar Roles de Usuario',
      // Roles (4)
      ROLE_CREATE: 'Crear Rol',
      ROLE_READ: 'Ver Roles',
      ROLE_UPDATE: 'Actualizar Rol',
      ROLE_DELETE: 'Eliminar Rol',
      // Permisos (2)
      PERMISSION_READ: 'Ver Permisos',
      PERMISSION_ASSIGN: 'Asignar Permisos',
      // Sistema (1)
      SYSTEM_SETTINGS: 'Configuracion del Sistema',
      // Productos (6)
      PRODUCT_READ: 'Ver Productos',
      PRODUCT_CREATE: 'Crear Producto',
      PRODUCT_UPDATE: 'Actualizar Producto',
      PRODUCT_DELETE: 'Eliminar Producto',
      BRAND_MANAGE: 'Gestionar Marcas',
      CATEGORY_MANAGE: 'Gestionar Categorias',
      // Pedidos (1)
      ORDER_READ: 'Ver Pedidos',
      // Admin / Dashboard (1)
      DASHBOARD_VIEW: 'Ver Dashboard',
      // Base de Datos (4)
      DATABASE_VIEW: 'Ver Metricas de BD',
      DATABASE_BACKUP: 'Gestionar Respaldos',
      DATABASE_MAINTAIN: 'Mantenimiento de BD',
      DATABASE_AUTOMATE: 'Automatizaciones del Sistema',
      // Clientes (2)
      CUSTOMER_READ: 'Ver Clientes',
      CUSTOMER_MANAGE: 'Gestionar Clientes',
      // Reportes (2)
      REPORT_VIEW: 'Ver Reportes',
      REPORT_EXPORT: 'Exportar Datos'
    };
    return map[permName] ?? permName.replace(/_/g, ' ');
  }

  /** Extrae la accion del permiso (CREATE, READ, UPDATE, DELETE, etc.) */
  getPermissionAction(permName: string): string {
    const parts = permName.split('_');
    const actionWords = ['VIEW', 'READ', 'CREATE', 'UPDATE', 'DELETE', 'MANAGE',
                          'ASSIGN', 'BACKUP', 'MAINTAIN', 'AUTOMATE', 'EXPORT', 'SETTINGS'];
    const action = parts.find(p => actionWords.includes(p));
    return action ?? parts[parts.length - 1] ?? '';
  }

  /** Color CSS por tipo de accion */
  getActionClass(permName: string): string {
    const action = this.getPermissionAction(permName);
    const classMap: { [k: string]: string } = {
      VIEW: 'action--view',
      READ: 'action--view',
      CREATE: 'action--create',
      UPDATE: 'action--edit',
      DELETE: 'action--delete',
      MANAGE: 'action--manage',
      ASSIGN: 'action--manage',
      BACKUP: 'action--create',
      MAINTAIN: 'action--edit',
      AUTOMATE: 'action--manage',
      EXPORT: 'action--view',
      SETTINGS: 'action--manage'
    };
    return classMap[action] ?? '';
  }

  // ── Accordion toggle ──────────────────────────────────────────

  toggleCategoryCollapse(category: string): void {
    if (this.collapsedCategories.has(category)) {
      this.collapsedCategories.delete(category);
    } else {
      this.collapsedCategories.add(category);
    }
  }

  isCategoryCollapsed(category: string): boolean {
    return this.collapsedCategories.has(category);
  }

  toggleCreateCategoryCollapse(category: string): void {
    if (this.createCollapsedCategories.has(category)) {
      this.createCollapsedCategories.delete(category);
    } else {
      this.createCollapsedCategories.add(category);
    }
  }

  isCreateCategoryCollapsed(category: string): boolean {
    return this.createCollapsedCategories.has(category);
  }

  /** Cuenta el total de permisos únicos asignados en todos los roles */
  getTotalPermissionsCount(): number {
    const allIds = new Set<number>();
    this.roles.forEach(r => r.permissions?.forEach(p => allIds.add(p.id)));
    return allIds.size;
  }

  /** Sanitiza el nombre del rol en tiempo real:
   *  - Convierte a mayúsculas
   *  - Reemplaza espacios y guiones por guión bajo
   *  - Elimina cualquier carácter que no sea A-Z, 0-9 o _
   */
  onRoleNameInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value
      .toUpperCase()
      .replace(/[\s-]/g, '_')
      .replace(/[^A-Z0-9_]/g, '');
    this.roleFormData.name = sanitized;
    input.value = sanitized; // sincroniza el DOM para evitar salto de cursor
  }

  /** Count of selected permissions within a category */
  categorySelectedCount(category: string): number {
    const perms = this.permissionsByCategory[category] ?? [];
    return perms.filter(p => this.selectedPermissions.includes(p.id)).length;
  }

  /** Count of functional categories assigned to a role */
  getRoleCategoryCount(role: Role): number {
    const categories = new Set<string>();
    role.permissions?.forEach(p => {
      if (p.category) categories.add(p.category);
    });
    return categories.size;
  }
}
