import { Component, OnInit, OnDestroy, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { StaffService } from '../../../services/staff.service';
import { RoleService } from '../../../services/role.service';
import { AuthService } from '../../../services/auth.service';
import { StaffUser, StaffFilters, PageResponse, Role, AssignableRole, StaffInvitationDto, CreateStaffInvitationRequest } from '../../../models/staff.model';
import Swal from 'sweetalert2';
import { StaffFormModalComponent } from './staff-form-modal.component';

@Component({
  selector: 'app-admin-staff',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, StaffFormModalComponent],
  templateUrl: './admin-staff.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./admin-staff.component.css']
})
export class AdminStaffComponent implements OnInit, OnDestroy {
  // Exponer Math al template
  Math = Math;

  private destroy$ = new Subject<void>();
  
  private _staffList: StaffUser[] = [];
  get staffList(): StaffUser[] {
    return this._staffList || [];
  }
  set staffList(value: StaffUser[]) {
    this._staffList = value || [];
  }
  
  private _roles: AssignableRole[] = [];
  get roles(): AssignableRole[] {
    return this._roles || [];
  }
  set roles(value: AssignableRole[]) {
    this._roles = value || [];
  }
  
  loading = false;
  
  // Paginación
  currentPage = 0;
  pageSize = 10;
  totalElements = 0;
  totalPages = 0;

  // Filtros
  searchTerm = '';
  selectedRoleId: number | null = null;
  filterEnabled: boolean | null = null;
  filterLocked: boolean | null = null;

  // Modal de edición (existente)
  showModal = false;
  isEditMode = false;
  selectedUser: StaffUser | null = null;

  // ═══════════════════════════════════════════════════
  // Tabs: 'staff' | 'invitations'
  // ═══════════════════════════════════════════════════
  activeTab: 'staff' | 'invitations' = 'staff';

  // ═══════════════════════════════════════════════════
  // Modal de invitación (nuevo)
  // ═══════════════════════════════════════════════════
  showInviteModal = false;
  inviteSending = false;
  invite = {
    firstName: '',
    lastName: '',
    email: '',
    roleIds: [] as number[]
  };
  
  // Verificación de email en tiempo real
  emailCheckState: 'idle' | 'checking' | 'available' | 'taken' | 'invalid' = 'idle';
  private emailCheckTimeout: any = null;
  
  // Roles filtrados (sin ROLE_USER)
  get filteredRoles(): AssignableRole[] {
    return this.roles.filter(r => r.name && r.name !== 'ROLE_USER');
  }

  // ═══════════════════════════════════════════════════
  // Invitaciones pendientes
  // ═══════════════════════════════════════════════════
  invitations: StaffInvitationDto[] = [];
  invitationsLoading = false;
  pendingCount = 0;

  // Filtros de invitaciones
  invitationFilters = { search: '', status: '' };

  get filteredInvitations(): StaffInvitationDto[] {
    return this.invitations.filter(inv => {
      const matchSearch = !this.invitationFilters.search ||
        inv.email.toLowerCase().includes(this.invitationFilters.search.toLowerCase()) ||
        (inv.firstName + ' ' + inv.lastName).toLowerCase().includes(this.invitationFilters.search.toLowerCase());
      const matchStatus = !this.invitationFilters.status || inv.status === this.invitationFilters.status;
      return matchSearch && matchStatus;
    });
  }

  clearInvitationFilters(): void {
    this.invitationFilters = { search: '', status: '' };
  }

  constructor(
    private staffService: StaffService,
    private roleService: RoleService,
    public authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    this.loadStaff();
    this.loadRoles();
    this.loadInvitations();

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['action'] === 'create' && !this.showModal && !this.showInviteModal) {
        this.openInviteModal();
        this.clearActionParam();
      }
      if (params['action'] === 'export') {
        this.exportToCsv();
        this.clearActionParam();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.emailCheckTimeout) {
      clearTimeout(this.emailCheckTimeout);
    }
  }

  /**
   * Carga la lista de staff con filtros
   */
  loadStaff(): void {
    this.loading = true;
    
    const filters: StaffFilters = {
      search: this.searchTerm || undefined,
      roleId: this.selectedRoleId || undefined,
      enabled: this.filterEnabled !== null ? this.filterEnabled : undefined,
      accountNonLocked: this.filterLocked !== null ? !this.filterLocked : undefined,
      page: this.currentPage,
      size: this.pageSize,
      sort: 'createdAt,desc'
    };

    this.staffService.getAllStaff(filters).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response: PageResponse<StaffUser>) => {
        this.staffList = response.content || [];
        this.totalElements = response.totalElements || 0;
        this.totalPages = response.totalPages || 0;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar staff:', error);
        this.staffList = []; // Asegurar que siempre sea un array
        this.loading = false;
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo cargar la lista de usuarios',
          confirmButtonColor: '#722f37'
        });
      }
    });
  }

  /**
   * Carga los roles que el usuario actual puede asignar
   */
  loadRoles(): void {
    this.staffService.getAssignableRoles().pipe(takeUntil(this.destroy$)).subscribe({
      next: (roles) => {
        this.roles = roles || [];
      },
      error: (error) => {
        console.error('Error al cargar roles asignables:', error);
        this.roles = []; // Asegurar que siempre sea un array
        Swal.fire({
          icon: 'warning',
          title: 'Advertencia',
          text: 'No se pudieron cargar los roles asignables'
        });
      }
    });
  }

  /**
   * Buscar staff
   */
  onSearch(): void {
    this.currentPage = 0;
    this.loadStaff();
  }

  /**
   * Cambiar página
   */
  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadStaff();
  }

  /**
   * Cambiar tamaño de página
   */
  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 0;
    this.loadStaff();
  }

  /**
   * Aplicar filtros
   */
  applyFilters(): void {
    this.currentPage = 0;
    this.loadStaff();
  }

  /**
   * Limpiar filtros
   */
  clearFilters(): void {
    this.searchTerm = '';
    this.selectedRoleId = null;
    this.filterEnabled = null;
    this.filterLocked = null;
    this.currentPage = 0;
    this.loadStaff();
  }

  /**
   * Abrir modal para crear nuevo usuario (ahora abre invitación)
   */
  openCreateModal(): void {
    this.openInviteModal();
  }

  // ═══════════════════════════════════════════════════
  // Tabs
  // ═══════════════════════════════════════════════════
  switchTab(tab: 'staff' | 'invitations'): void {
    this.activeTab = tab;
    if (tab === 'invitations') {
      this.loadInvitations();
    }
  }

  // ═══════════════════════════════════════════════════
  // Modal de invitación
  // ═══════════════════════════════════════════════════
  openInviteModal(): void {
    this.invite = { firstName: '', lastName: '', email: '', roleIds: [] };
    this.emailCheckState = 'idle';
    this.inviteSending = false;
    this.showInviteModal = true;
  }

  closeInviteModal(): void {
    this.showInviteModal = false;
    if (this.emailCheckTimeout) {
      clearTimeout(this.emailCheckTimeout);
    }
  }

  /** Toggle selección de rol en el modal de invitación */
  toggleInviteRole(roleId: number): void {
    const idx = this.invite.roleIds.indexOf(roleId);
    if (idx > -1) {
      this.invite.roleIds.splice(idx, 1);
    } else {
      this.invite.roleIds.push(roleId);
    }
  }

  isInviteRoleSelected(roleId: number): boolean {
    return this.invite.roleIds.includes(roleId);
  }

  /** Verificar email con debounce */
  onEmailInput(): void {
    if (this.emailCheckTimeout) clearTimeout(this.emailCheckTimeout);

    const email = this.invite.email?.trim();
    if (!email || !this.isValidEmail(email)) {
      this.emailCheckState = email ? 'invalid' : 'idle';
      return;
    }

    this.emailCheckState = 'checking';
    this.emailCheckTimeout = setTimeout(() => {
      this.staffService.checkEmailAvailability(email).pipe(takeUntil(this.destroy$)).subscribe({
        next: (available: boolean) => {
          this.emailCheckState = available ? 'available' : 'taken';
        },
        error: (err) => {
          // 401/403 → el usuario no tiene permiso; no bloquear el formulario
          // 4xx distinto → email probablemente inválido
          console.warn('check-email error:', err?.status, err?.message);
          this.emailCheckState = 'idle';
        }
      });
    }, 500);
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /** Validar si el formulario de invitación es completo */
  get isInviteFormValid(): boolean {
    return !!(
      this.invite.firstName?.trim() &&
      this.invite.lastName?.trim() &&
      this.invite.email?.trim() &&
      this.emailCheckState === 'available' &&
      this.invite.roleIds.length > 0 &&
      !this.inviteSending
    );
  }

  /** Enviar invitación */
  sendInvitation(): void {
    if (!this.isInviteFormValid) return;

    this.inviteSending = true;

    const request: CreateStaffInvitationRequest = {
      firstName: this.invite.firstName.trim(),
      lastName: this.invite.lastName.trim(),
      email: this.invite.email.trim(),
      roleIds: [...this.invite.roleIds]
    };

    this.staffService.sendInvitation(request).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.inviteSending = false;
        this.closeInviteModal();
        Swal.fire({
          icon: 'success',
          title: '¡Invitación enviada!',
          html: `Se envió un correo de activación a <strong>${request.email}</strong>.<br><small class="text-muted">El enlace expira en 48 horas.</small>`,
          confirmButtonColor: '#722f37',
          timer: 4000,
          timerProgressBar: true,
          showConfirmButton: false
        });
        this.loadInvitations();
      },
      error: (err) => {
        this.inviteSending = false;
        const msg = err.error?.message || err.error?.error || 'Error al enviar la invitación';
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: msg,
          confirmButtonColor: '#722f37'
        });
      }
    });
  }

  // ═══════════════════════════════════════════════════
  // Invitaciones (listado)
  // ═══════════════════════════════════════════════════
  loadInvitations(): void {
    this.invitationsLoading = true;
    this.staffService.listInvitations().pipe(takeUntil(this.destroy$)).subscribe({
      next: (list) => {
        this.invitations = list || [];
        this.pendingCount = this.invitations.filter(i => i.status === 'PENDING').length;
        this.invitationsLoading = false;
      },
      error: () => {
        this.invitations = [];
        this.pendingCount = 0;
        this.invitationsLoading = false;
      }
    });
  }

  /** Cancelar invitación */
  cancelInvitation(inv: StaffInvitationDto): void {
    Swal.fire({
      title: '¿Cancelar invitación?',
      html: `Se cancelará la invitación de <strong>${inv.firstName} ${inv.lastName}</strong> (${inv.email}).`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, cancelar',
      cancelButtonText: 'No'
    }).then((result) => {
      if (result.isConfirmed) {
        this.staffService.cancelInvitation(inv.id).pipe(takeUntil(this.destroy$)).subscribe({
          next: () => {
            Swal.fire({
              icon: 'success',
              title: 'Cancelada',
              text: 'La invitación fue cancelada correctamente.',
              timer: 2000,
              showConfirmButton: false
            });
            this.loadInvitations();
          },
          error: (err) => {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: err.error?.message || 'No se pudo cancelar la invitación',
              confirmButtonColor: '#722f37'
            });
          }
        });
      }
    });
  }

  /** Reenviar invitación */
  resendInvitation(inv: StaffInvitationDto): void {
    Swal.fire({
      title: '¿Reenviar invitación?',
      html: `Se enviará un nuevo correo a <strong>${inv.email}</strong> con un enlace renovado.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#722f37',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, reenviar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.staffService.resendInvitation(inv.id).pipe(takeUntil(this.destroy$)).subscribe({
          next: () => {
            Swal.fire({
              icon: 'success',
              title: '¡Reenviada!',
              text: 'Se generó un nuevo enlace y se envió al correo.',
              timer: 2500,
              showConfirmButton: false
            });
            this.loadInvitations();
          },
          error: (err) => {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: err.error?.message || 'No se pudo reenviar la invitación',
              confirmButtonColor: '#722f37'
            });
          }
        });
      }
    });
  }

  /** ¿La invitación expira pronto? (<6h) */
  isExpiringSoon(inv: StaffInvitationDto): boolean {
    if (inv.status !== 'PENDING') return false;
    const expires = new Date(inv.expiresAt).getTime();
    const now = Date.now();
    return expires - now < 6 * 60 * 60 * 1000 && expires > now;
  }

  /** Obtener nombre legible del rol */
  getRoleDisplayName(roleName: string): string {
    let isStoreManager = false;
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const user = JSON.parse(raw);
        const roles: any[] = user?.roles ?? [];
        isStoreManager = roles.some((r: any) => {
          const name = (typeof r === 'string' ? r : r?.name ?? r?.authority ?? '') as string;
          return name.toUpperCase() === 'ROLE_STORE_MANAGER';
        });
      }
    } catch {}

    if (isStoreManager) {
      const storeTranslations: { [key: string]: string } = {
        'ROLE_STORE_STAFF': 'Personal de tienda',
        'ROLE_CATALOG_MANAGER': 'Encargado de catálogo',
        'ROLE_ORDER_MANAGER': 'Encargado de pedidos',
        'ROLE_PAYMENT_ASSISTANT': 'Auxiliar de pagos',
        'ROLE_STORE_MANAGER': 'Gerente de tienda'
      };
      
      if (storeTranslations[roleName]) {
        return storeTranslations[roleName];
      }
      return 'Rol no disponible';
    }

    const translations: { [key: string]: string } = {
      'ROLE_SUPER_ADMIN': 'Super Admin',
      'ROLE_ADMIN': 'Administrador',
      'ROLE_MODERATOR': 'Moderador',
      'ROLE_MANAGER': 'Gerente',
      'ROLE_STAFF': 'Personal',
      'ROLE_SALES': 'Ventas',
      'ROLE_INVENTORY': 'Inventario',
      'ROLE_SUPPORT': 'Soporte',
      'ROLE_STORE_STAFF': 'Personal de tienda',
      'ROLE_CATALOG_MANAGER': 'Encargado de catálogo',
      'ROLE_ORDER_MANAGER': 'Encargado de pedidos',
      'ROLE_PAYMENT_ASSISTANT': 'Auxiliar de pagos',
      'ROLE_STORE_MANAGER': 'Gerente de tienda'
    };
    return translations[roleName] || roleName.replace('ROLE_', '');
  }

  /** Icono para cada rol */
  getRoleIcon(roleName: string): string {
    const icons: { [key: string]: string } = {
      'ROLE_SUPER_ADMIN': 'shield-fill-check',
      'ROLE_ADMIN': 'person-badge-fill',
      'ROLE_MODERATOR': 'flag-fill',
      'ROLE_MANAGER': 'briefcase-fill',
      'ROLE_STAFF': 'person-fill',
      'ROLE_SALES': 'cart-fill',
      'ROLE_INVENTORY': 'box-seam-fill',
      'ROLE_SUPPORT': 'headset'
    };
    return icons[roleName] || 'star-fill';
  }

  /** Es superadmin el usuario actual */
  get isCurrentUserSuperAdmin(): boolean {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return false;
      const user = JSON.parse(raw);
      const roles: any[] = user?.roles ?? [];
      return roles.some((r: any) => {
        const name = (typeof r === 'string' ? r : r?.name ?? r?.authority ?? '') as string;
        return name.toUpperCase().replace('ROLE_', '') === 'SUPER_ADMIN';
      });
    } catch { return false; }
  }

  /**
   * Abrir modal para editar usuario
   */
  openEditModal(user: StaffUser): void {
    // Show a loading overlay or just use the card loading state
    this.loading = true;
    this.staffService.getStaffById(user.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (fullUser) => {
        this.loading = false;
        this.isEditMode = true;
        this.selectedUser = fullUser;
        this.showModal = true;
      },
      error: (err) => {
        this.loading = false;
        console.error('Error fetching full user details:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo cargar la información del usuario.',
          confirmButtonColor: '#722f37'
        });
      }
    });
  }

  /**
   * Cerrar modal
   */
  closeModal(): void {
    this.showModal = false;
    this.selectedUser = null;
    this.isEditMode = false;
  }

  private clearActionParam(): void {
    this.router.navigate([], {
      queryParams: { action: null },
      queryParamsHandling: 'merge'
    });
  }

  /**
   * Cuando se guarda desde el modal
   */
  onUserSaved(): void {
    this.closeModal();
    this.loadStaff();
  }

  /**
   * Toggle estado activo/inactivo
   */
  toggleEnabled(user: StaffUser): void {
    const action = user.enabled ? 'desactivar' : 'activar';
    
    Swal.fire({
      title: `¿${action.charAt(0).toUpperCase() + action.slice(1)} usuario?`,
      text: `¿Estás seguro de que deseas ${action} a ${user.firstName} ${user.lastName}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#722f37',
      cancelButtonColor: '#6c757d',
      confirmButtonText: `Sí, ${action}`,
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.staffService.enableUser(user.id).pipe(takeUntil(this.destroy$)).subscribe({
          next: () => {
            user.enabled = !user.enabled;
            Swal.fire({
              icon: 'success',
              title: '¡Actualizado!',
              text: `Usuario ${user.enabled ? 'activado' : 'desactivado'} correctamente`,
              timer: 2000,
              showConfirmButton: false
            });
          },
          error: (error) => {
            console.error('Error al cambiar estado:', error);
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: error?.error?.message || 'No se pudo cambiar el estado del usuario',
              confirmButtonColor: '#722f37'
            });
          }
        });
      }
    });
  }

  /**
   * Toggle bloqueo de cuenta
   */
  toggleLock(user: StaffUser): void {
    const action = user.accountNonLocked ? 'bloquear' : 'desbloquear';
    
    Swal.fire({
      title: `¿${action.charAt(0).toUpperCase() + action.slice(1)} cuenta?`,
      text: `¿Estás seguro de que deseas ${action} la cuenta de ${user.firstName} ${user.lastName}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#722f37',
      cancelButtonColor: '#6c757d',
      confirmButtonText: `Sí, ${action}`,
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.staffService.lockAccount(user.id).pipe(takeUntil(this.destroy$)).subscribe({
          next: () => {
            user.accountNonLocked = !user.accountNonLocked;
            Swal.fire({
              icon: 'success',
              title: '¡Actualizado!',
              text: `Cuenta ${user.accountNonLocked ? 'desbloqueada' : 'bloqueada'} correctamente`,
              timer: 2000,
              showConfirmButton: false
            });
          },
          error: (error) => {
            console.error('Error al cambiar bloqueo:', error);
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: error?.error?.message || 'No se pudo cambiar el estado de bloqueo',
              confirmButtonColor: '#722f37'
            });
          }
        });
      }
    });
  }

  /**
   * Eliminar usuario
   */
  deleteUser(user: StaffUser): void {
    Swal.fire({
      title: '¿Eliminar usuario?',
      html: `¿Estás seguro de que deseas eliminar a <strong>${user.firstName} ${user.lastName}</strong>?<br><small class="text-danger">Esta acción no se puede deshacer</small>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.staffService.deleteStaff(user.id).pipe(takeUntil(this.destroy$)).subscribe({
          next: () => {
            this.loadStaff();
            Swal.fire({
              icon: 'success',
              title: '¡Eliminado!',
              text: 'Usuario eliminado correctamente',
              timer: 2000,
              showConfirmButton: false
            });
          },
          error: (error) => {
            console.error('Error al eliminar usuario:', error);
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: error.error?.message || 'No se pudo eliminar el usuario',
              confirmButtonColor: '#722f37'
            });
          }
        });
      }
    });
  }

  /**
   * Resetear intentos fallidos
   */
  resetFailedAttempts(user: StaffUser): void {
    this.staffService.resetFailedAttempts(user.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        user.failedLoginAttempts = 0;
        Swal.fire({
          icon: 'success',
          title: '¡Reseteado!',
          text: 'Intentos fallidos reseteados correctamente',
          timer: 2000,
          showConfirmButton: false
        });
      },
      error: (error) => {
        console.error('Error al resetear intentos:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo resetear los intentos fallidos',
          confirmButtonColor: '#722f37'
        });
      }
    });
  }

  /**
   * Exportar a CSV
   */
  exportToCsv(): void {
    const filters: StaffFilters = {
      search: this.searchTerm || undefined,
      roleId: this.selectedRoleId || undefined
    };

    this.staffService.exportStaffToCsv(filters).pipe(takeUntil(this.destroy$)).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `staff-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        console.error('Error al exportar:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo exportar la lista',
          confirmButtonColor: '#722f37'
        });
      }
    });
  }

  /**
   * Obtener nombre completo
   */
  getFullName(user: StaffUser): string {
    const first = user.firstName || '';
    const last  = user.lastName  || '';
    return (first + ' ' + last).trim() || user.email || `Usuario #${user.id}`;
  }

  /**
   * TrackBy para *ngFor — evita re-renderizar filas existentes
   */
  trackByUserId(_index: number, user: StaffUser): number {
    return user.id;
  }

  /**
   * Generar array de páginas para el paginador
   */
  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPagesToShow = 5;
    
    let startPage = Math.max(0, this.currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(this.totalPages - 1, startPage + maxPagesToShow - 1);
    
    if (endPage - startPage < maxPagesToShow - 1) {
      startPage = Math.max(0, endPage - maxPagesToShow + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }
}
