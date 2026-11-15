import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';
import { AssignableRole, Permission } from '../models/staff.model';

export interface CriticalRoleChanges {
  added: AssignableRole[];
  removed: AssignableRole[];
  isCritical: boolean;
}

export interface CriticalPermissionChanges {
  added: Permission[];
  removed: Permission[];
  isCritical: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SecurityConfirmationService {

  private readonly CRITICAL_ROLES = ['ROLE_SUPER_ADMIN'];
  
  // Lista fallback defensiva por si backend no envía los flags correctamente
  private readonly FALLBACK_CRITICAL_PERMISSIONS = [
    'SYSTEM_OWNER_MANAGE',
    'SUPER_ADMIN_MANAGE',
    'ROLE_SYSTEM_UPDATE',
    'ROLE_SYSTEM_DELETE',
    'PERMISSION_CRITICAL_ASSIGN',
    'USER_ROLE_ASSIGN_SUPER_ADMIN',
    'USER_ROLE_REMOVE_SUPER_ADMIN',
    'USER_DISABLE_SUPER_ADMIN',
    'USER_DELETE_SUPER_ADMIN',
    'DATABASE_DROP',
    'DATABASE_RESTORE'
  ];

  constructor() {}

  /**
   * Verifica si el usuario logueado es PROTECTED_OWNER y tiene ROLE_SUPER_ADMIN.
   * Si no, la confirmación no debe aplicarse (las acciones sensibles estarán bloqueadas por backend).
   */
  isCurrentUserProtectedOwner(): boolean {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return false;
      const user = JSON.parse(raw);
      
      const isProtected = user.protectedOwner === true;
      const roles: any[] = user?.roles ?? [];
      const isSuperAdmin = roles.some((r: any) => {
        const name = (typeof r === 'string' ? r : r?.name ?? r?.authority ?? '') as string;
        return name.toUpperCase().replace('ROLE_', '') === 'SUPER_ADMIN';
      });

      return isProtected && isSuperAdmin;
    } catch {
      return false;
    }
  }

  isCriticalRole(roleName: string): boolean {
    return this.CRITICAL_ROLES.includes(roleName.toUpperCase());
  }

  isCriticalPermission(permission: Permission): boolean {
    if (permission.critical === true || permission.ownerOnly === true) {
      return true;
    }
    return this.FALLBACK_CRITICAL_PERMISSIONS.includes(permission.name.toUpperCase());
  }

  /**
   * Detecta si se agregaron o quitaron roles críticos.
   */
  detectCriticalRoleChanges(
    originalRoleIds: number[], 
    newRoleIds: number[], 
    allRoles: AssignableRole[]
  ): CriticalRoleChanges {
    const originalSet = new Set(originalRoleIds);
    const newSet = new Set(newRoleIds);
    
    const addedIds = newRoleIds.filter(id => !originalSet.has(id));
    const removedIds = originalRoleIds.filter(id => !newSet.has(id));
    
    const added = allRoles.filter(r => addedIds.includes(r.id) && this.isCriticalRole(r.name));
    const removed = allRoles.filter(r => removedIds.includes(r.id) && this.isCriticalRole(r.name));
    
    return {
      added,
      removed,
      isCritical: added.length > 0 || removed.length > 0
    };
  }

  /**
   * Detecta si se agregaron o quitaron permisos críticos/ownerOnly.
   */
  detectCriticalPermissionChanges(
    originalPermIds: number[],
    newPermIds: number[],
    allPermissions: Permission[]
  ): CriticalPermissionChanges {
    const originalSet = new Set(originalPermIds);
    const newSet = new Set(newPermIds);
    
    const addedIds = newPermIds.filter(id => !originalSet.has(id));
    const removedIds = originalPermIds.filter(id => !newSet.has(id));
    
    const added = allPermissions.filter(p => addedIds.includes(p.id) && this.isCriticalPermission(p));
    const removed = allPermissions.filter(p => removedIds.includes(p.id) && this.isCriticalPermission(p));
    
    return {
      added,
      removed,
      isCritical: added.length > 0 || removed.length > 0
    };
  }

  /**
   * Muestra la alerta de confirmación para cambios de roles.
   */
  async confirmCriticalRoleAction(
    userAffected: { fullName: string; email: string },
    changes: CriticalRoleChanges
  ): Promise<boolean> {
    if (!this.isCurrentUserProtectedOwner() || !changes.isCritical) {
      return true; // Continuar normal
    }

    const isAssigning = changes.added.length > 0;
    const isRemoving = changes.removed.length > 0;

    let title = 'Confirmar acción crítica';
    let warning = 'Este rol otorga privilegios elevados dentro del sistema. Continúa solo si estás seguro.';
    
    if (isAssigning && !isRemoving) {
      title = 'Confirmar asignación crítica';
      warning = 'Estás a punto de asignar privilegios de Super Administrador. Continúa solo si estás seguro.';
    } else if (isRemoving && !isAssigning) {
      title = 'Confirmar degradación crítica';
      warning = 'Estás a punto de quitar privilegios de Super Administrador a este usuario. Continúa solo si estás seguro.';
    }

    let htmlChanges = '<ul style="text-align: left; margin: 10px 0; padding-left: 20px;">';
    changes.added.forEach(r => {
      htmlChanges += `<li><strong>Se asignará:</strong> ${this.translateRole(r.name)} (${r.name})</li>`;
    });
    changes.removed.forEach(r => {
      htmlChanges += `<li><strong>Se quitará:</strong> ${this.translateRole(r.name)} (${r.name})</li>`;
    });
    htmlChanges += '</ul>';

    const htmlContent = `
      <div style="font-size: 0.95rem; color: #333; text-align: left;">
        <p style="margin-bottom: 10px;"><strong>Usuario afectado:</strong><br>
        ${userAffected.fullName}<br>
        <span style="color: #666; font-size: 0.85rem;">${userAffected.email}</span></p>
        
        <p style="margin-bottom: 5px;"><strong>Cambio crítico:</strong></p>
        ${htmlChanges}
        
        <p style="margin-top: 15px; font-weight: bold; color: #722f37;">
          <i class="bi bi-shield-exclamation"></i> ${warning}
        </p>
      </div>
    `;

    const result = await Swal.fire({
      title: title,
      html: htmlContent,
      icon: 'warning',
      showCancelButton: true,
      allowOutsideClick: false,
      confirmButtonText: 'Confirmar acción',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#722f37',
      cancelButtonColor: '#6c757d'
    });

    return result.isConfirmed;
  }

  /**
   * Muestra la alerta de confirmación para cambios de permisos en un rol.
   */
  async confirmCriticalPermissionAction(
    roleAffected: { name: string; description?: string },
    changes: CriticalPermissionChanges
  ): Promise<boolean> {
    if (!this.isCurrentUserProtectedOwner() || !changes.isCritical) {
      return true; // Continuar normal
    }

    const title = 'Confirmar permisos críticos';
    const warning = 'Estos permisos pueden afectar la seguridad, administración o integridad del sistema. Confirma que deseas continuar.';

    let htmlChanges = '<ul style="text-align: left; margin: 10px 0; padding-left: 20px; font-size: 0.85rem;">';
    changes.added.forEach(p => {
      const type = p.ownerOnly ? 'Owner Only' : 'Crítico';
      htmlChanges += `<li><strong>Se agregará:</strong> ${p.name} - ${p.description} <span style="color:#dc2626; font-weight:bold;">[${type}]</span></li>`;
    });
    changes.removed.forEach(p => {
      const type = p.ownerOnly ? 'Owner Only' : 'Crítico';
      htmlChanges += `<li><strong>Se removerá:</strong> ${p.name} - ${p.description} <span style="color:#d97706; font-weight:bold;">[${type}]</span></li>`;
    });
    htmlChanges += '</ul>';

    const htmlContent = `
      <div style="font-size: 0.95rem; color: #333; text-align: left;">
        <p style="margin-bottom: 10px;">Estás a punto de crear o modificar un rol con permisos críticos.</p>
        <p style="margin-bottom: 10px;"><strong>Rol:</strong><br>
        ${roleAffected.name}<br>
        <span style="color: #666; font-size: 0.85rem;">${roleAffected.description || ''}</span></p>
        
        <p style="margin-bottom: 5px;"><strong>Permisos críticos modificados:</strong></p>
        ${htmlChanges}
        
        <p style="margin-top: 15px; font-weight: bold; color: #722f37;">
          <i class="bi bi-shield-exclamation"></i> ${warning}
        </p>
      </div>
    `;

    const result = await Swal.fire({
      title: title,
      html: htmlContent,
      icon: 'warning',
      showCancelButton: true,
      allowOutsideClick: false,
      confirmButtonText: 'Confirmar permisos críticos',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#722f37',
      cancelButtonColor: '#6c757d'
    });

    return result.isConfirmed;
  }

  private translateRole(roleName: string): string {
    const translations: { [key: string]: string } = {
      'ROLE_SUPER_ADMIN': 'Super Administrador',
      'ROLE_ADMIN': 'Administrador',
      'ROLE_MODERATOR': 'Moderador',
      'ROLE_MANAGER': 'Gerente',
      'ROLE_STAFF': 'Personal',
      'ROLE_SALES': 'Ventas',
      'ROLE_INVENTORY': 'Inventario',
      'ROLE_SUPPORT': 'Soporte'
    };
    if (!roleName) return '';
    return translations[roleName] || roleName.replace('ROLE_', '').charAt(0).toUpperCase()
      + roleName.replace('ROLE_', '').slice(1).toLowerCase();
  }
}
