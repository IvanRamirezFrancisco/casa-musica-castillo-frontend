/**
 * Interfaces para gestión de Staff/Usuarios del sistema
 */

export interface Permission {
  id: number;
  name: string;
  description: string;
  category: string;
  resource: string;
  action: string;
  assignable?: boolean;
  critical?: boolean;
  ownerOnly?: boolean;
}

export interface Role {
  id: number;
  name: string;
  description: string;
  permissions: Permission[];
  userCount?: number;
  /** true si es un rol base del sistema (no eliminable ni modificable) */
  immutable?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AssignableRole {
  id: number;
  name: string;
  description?: string;
  systemRole?: boolean;
  assignable?: boolean;
  level?: number;
  scope?: string;
  displayName?: string;
}

export interface StaffUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  displayEmail?: string;
  maskedEmail?: string;
  enabled: boolean;
  accountNonLocked: boolean;
  roles: Role[];
  rolesDetail?: Role[];
  createdAt?: string;
  lastLogin?: string;
  failedLoginAttempts?: number;
  
  // Security Context & Visibility
  protectedOwner?: boolean;
  currentUser?: boolean;
  highestRoleLevel?: number;
  technicalUser?: boolean;
  operationalUser?: boolean;
  storeManager?: boolean;

  // Action Permissions for Current Actor
  canManage?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canDisable?: boolean;
  canChangeRoles?: boolean;
  canResetTwoFactor?: boolean;
  canChangePasswordAdmin?: boolean;
  canViewSensitiveFields?: boolean;
}

export interface CreateStaffRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  roleIds: number[];
}

export interface UpdateStaffRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  roleIds?: number[];
}

export interface CreateRoleRequest {
  name: string;
  description: string;
  permissionIds: number[];
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string;
  permissionIds?: number[];
}

export interface StaffFilters {
  search?: string;
  roleId?: number;
  enabled?: boolean;
  accountNonLocked?: boolean;
  page?: number;
  size?: number;
  sort?: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

export interface PermissionsByCategory {
  [category: string]: Permission[];
}

/** Usuario simplificado devuelto por GET /api/admin/roles/{id}/users */
export interface RoleUserDTO {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  enabled: boolean;
  accountNonLocked: boolean;
  roles: string;        // nombres concatenados ("ROLE_ADMIN, ROLE_STAFF")
  createdAt?: string;
}

/** Fila del modal de auditoría "Usuarios por Rol" */
export interface RoleUserDTO {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  enabled: boolean;
  accountNonLocked: boolean;
  roles: string;          // roles concatenados: "ROLE_ADMIN, ROLE_STAFF"
  createdAt?: string;
}

// ═══════════════════════════════════════════════════════
// Interfaces para el flujo de invitaciones de empleados
// ═══════════════════════════════════════════════════════

export interface CreateStaffInvitationRequest {
  firstName: string;
  lastName: string;
  email: string;
  roleIds: number[];
}

export interface AcceptInvitationRequest {
  password: string;
  confirmPassword: string;
}

export interface StaffInvitationDto {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';
  roleNames: string[];
  invitedByName: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
}

export interface InvitationInfoDto {
  firstName: string;
  lastName: string;
  email: string;
  roleNames: string[];
}
