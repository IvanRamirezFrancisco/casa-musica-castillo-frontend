import { Component, EventEmitter, Input, OnChanges, OnInit, OnDestroy, Output, SimpleChanges, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';

import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { StaffService } from '../../../services/staff.service';
import { SecurityConfirmationService } from '../../../services/security-confirmation.service';
import { StaffUser, Role, AssignableRole, CreateStaffRequest, UpdateStaffRequest } from '../../../models/staff.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-staff-form-modal',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './staff-form-modal.component.html',
  styleUrls: ['./staff-form-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  encapsulation: ViewEncapsulation.None
})
export class StaffFormModalComponent implements OnInit, OnChanges, OnDestroy {
  @Input() isEditMode = false;
  @Input() user: StaffUser | null = null;
  @Input() roles: AssignableRole[] = [];
  
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  staffForm!: FormGroup;
  loading = false;
  errorMessage = '';
  selectedRoleIds: number[] = [];
  
  // Roles filtrados (sin ROLE_USER)
  filteredRoles: AssignableRole[] = [];

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private staffService: StaffService,
    private securityConfirmation: SecurityConfirmationService
  ) { }

  /** True si el usuario que está operando tiene el rol SUPER_ADMIN */
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
    } catch {
      return false;
    }
  }

  /**
   * True si el usuario que se está editando es el mismo que el usuario logueado.
   * En ese caso, la asignación de roles se deshabilita (prevención de auto-edición).
   */
  get rolesDisabled(): boolean {
    if (!this.isEditMode || !this.user) return false;
    if (this.user.canChangeRoles === false) return true;
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return false;
      const currentUser = JSON.parse(raw);
      return currentUser?.id === this.user.id || currentUser?.email === this.user.email;
    } catch {
      return false;
    }
  }

  get rolesDisabledReason(): string {
    if (!this.isEditMode || !this.user) return '';
    if (this.user.currentUser) {
      return 'Por seguridad, no puedes modificar tus propios roles desde este formulario.';
    }
    if (this.user.canChangeRoles === false) {
      return 'No tienes jerarquía suficiente para modificar los roles de este usuario.';
    }
    return 'Operación restringida.';
  }

  /** True si el usuario es protegido y no somos nosotros (Modo solo lectura total) */
  get isProtectedViewOnly(): boolean {
    if (!this.isEditMode || !this.user) return false;
    return !!this.user.protectedOwner && !this.user.currentUser;
  }

  /** True si no se puede editar ni datos ni roles */
  get isCompletelyReadOnly(): boolean {
    if (!this.isEditMode || !this.user) return false;
    return this.isProtectedViewOnly || (this.user.canEdit === false && this.user.canChangeRoles === false);
  }

  /** Verifica si ha habido cambios en el formulario para habilitar el botón */
  hasChanges(): boolean {
    if (!this.isEditMode) return true;
    if (this.staffForm.dirty) return true;
    
    // Comparar roles si están permitidos
    if (!this.rolesDisabled && this.user) {
      const originalRoles = this.user.rolesDetail?.map(r => r.id) || 
                            (this.user.roles ? this.roles.filter(r => this.user!.roles!.some(ur => ur.name === r.name)).map(r => r.id) : []);
      if (originalRoles.length !== this.selectedRoleIds.length) return true;
      const sortedOriginal = [...originalRoles].sort();
      const sortedSelected = [...this.selectedRoleIds].sort();
      for (let i = 0; i < sortedOriginal.length; i++) {
        if (sortedOriginal[i] !== sortedSelected[i]) return true;
      }
    }
    return false;
  }

  ngOnInit(): void {
    this.filterRoles();
    this.initializeForm();
    
    if (this.isEditMode && this.user) {
      this.loadUserData();
    }
  }
  
  ngOnChanges(changes: SimpleChanges): void {
    // Cuando lleguen los roles (pueden llegar después del ngOnInit)
    if (changes['roles'] && this.roles && this.roles.length > 0) {
      this.filterRoles();
      // Re-cargar selección de roles si estamos en modo edición
      if (this.isEditMode && this.user) {
        this.populateSelectedRoles();
      }
    }
  }
  
  /**
   * Filtra los roles para excluir ROLE_USER
   * y roles sin nombre válido
   */
  private filterRoles(): void {
    this.filteredRoles = this.roles.filter(role => 
      role.name && 
      role.name.trim() !== '' && 
      role.name !== 'ROLE_USER'
    );
  }

  /**
   * Inicializa el formulario reactivo
   */
  private initializeForm(): void {
    this.staffForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s]+$/)]],
      lastName: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s]+$/)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', this.isEditMode ? [] : [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/)
      ]],
      confirmPassword: ['']
    }, { validators: this.passwordMatchValidator });
  }

  /**
   * Carga los datos del usuario en modo edición
   */
  private loadUserData(): void {
    if (this.user) {
      this.staffForm.patchValue({
        firstName: this.user.firstName,
        lastName: this.user.lastName,
        email: this.user.email
      });

      this.populateSelectedRoles();
    }
  }

  private populateSelectedRoles(): void {
    if (!this.user) return;

    if (this.user.rolesDetail && this.user.rolesDetail.length > 0) {
      this.selectedRoleIds = this.user.rolesDetail.map(r => r.id);
    } else if (this.user.roles && this.user.roles.length > 0) {
      const userRoleNames = this.user.roles.map(r => r.name);
      this.selectedRoleIds = this.roles
        .filter(r => userRoleNames.includes(r.name))
        .map(r => r.id);
    } else {
      this.selectedRoleIds = [];
    }
  }

  /**
   * Validador personalizado para confirmar contraseña
   */
  private passwordMatchValidator(group: FormGroup): { [key: string]: boolean } | null {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    
    if (password && confirmPassword && password !== confirmPassword) {
      return { passwordMismatch: true };
    }
    
    return null;
  }

  /**
   * Toggle selección de rol.
   * Bloqueado si se está editando a sí mismo (prevención de auto-edición de roles).
   */
  toggleRole(roleId: number): void {
    if (this.rolesDisabled) return; // Protección contra edición de roles

    const index = this.selectedRoleIds.indexOf(roleId);
    
    if (index > -1) {
      this.selectedRoleIds.splice(index, 1);
    } else {
      this.selectedRoleIds.push(roleId);
    }
  }

  /**
   * Verifica si un rol está seleccionado
   */
  isRoleSelected(roleId: number): boolean {
    return this.selectedRoleIds.includes(roleId);
  }
  
  /**
   * Traduce el nombre técnico del rol a español (reemplaza el pipe)
   */
  translateRole(roleName: string): string {
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

  /**
   * Obtiene la descripción de lo que puede hacer cada rol
   */
  getRoleDescription(roleName: string): string {
    const descriptions: { [key: string]: string } = {
      'ROLE_SUPER_ADMIN': 'Acceso total al sistema. Puede gestionar todo, incluyendo otros administradores.',
      'ROLE_ADMIN': 'Administrador del sistema. Gestiona usuarios, productos, órdenes y configuraciones.',
      'ROLE_MODERATOR': 'Moderador de contenido. Puede revisar y aprobar publicaciones, comentarios y reseñas.',
      'ROLE_MANAGER': 'Gerente de tienda. Gestiona inventario, órdenes y reportes de ventas.',
      'ROLE_STAFF': 'Personal de apoyo. Acceso limitado para tareas operativas básicas.',
      'ROLE_SALES': 'Equipo de ventas. Puede gestionar órdenes, clientes y cupones de descuento.',
      'ROLE_INVENTORY': 'Encargado de inventario. Gestiona productos, categorías y stock.',
      'ROLE_SUPPORT': 'Soporte al cliente. Atiende consultas, reseñas y carritos abandonados.'
    };
    
    return descriptions[roleName] || 'Rol personalizado del sistema.';
  }
  
  /**
   * Obtiene el icono apropiado para cada rol
   */
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

  /**
   * Guardar (crear o actualizar)
   */
  async onSubmit(): Promise<void> {
    if (this.staffForm.invalid && !this.isCompletelyReadOnly) {
      this.markFormGroupTouched(this.staffForm);
      return;
    }

    if (!this.rolesDisabled && this.selectedRoleIds.length === 0) {
      this.errorMessage = 'Debe seleccionar al menos un rol';
      return;
    }

    // --- Validación de Seguridad Extra para PROTECTED_OWNER ---
    if (!this.rolesDisabled) {
      const originalRoleIds = this.isEditMode && this.user ? 
        (this.user.rolesDetail?.map(r => r.id) || 
         this.roles.filter(r => this.user!.roles?.some(ur => ur.name === r.name)).map(r => r.id)) : 
        [];
      
      const changes = this.securityConfirmation.detectCriticalRoleChanges(
        originalRoleIds,
        this.selectedRoleIds,
        this.roles
      );

      if (changes.isCritical) {
        const formValue = this.staffForm.value;
        const userAffected = {
          fullName: `${formValue.firstName} ${formValue.lastName}`,
          email: formValue.email
        };
        const confirmed = await this.securityConfirmation.confirmCriticalRoleAction(userAffected, changes);
        if (!confirmed) {
          return; // Detener guardado si se cancela
        }
      }
    }
    // ------------------------------------------------------------

    this.loading = true;
    this.errorMessage = '';

    const formValue = this.staffForm.value;

    if (this.isEditMode && this.user) {
      this.updateUser(formValue);
    } else {
      this.createUser(formValue);
    }
  }

  /**
   * Crear nuevo usuario
   */
  private createUser(formValue: any): void {
    const request: CreateStaffRequest = {
      firstName: formValue.firstName,
      lastName: formValue.lastName,
      email: formValue.email,
      password: formValue.password,
      roleIds: this.selectedRoleIds
    };

    this.staffService.createStaff(request).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.loading = false;
        Swal.fire({
          icon: 'success',
          title: '¡Usuario creado!',
          text: `${formValue.firstName} ${formValue.lastName} fue registrado correctamente.`,
          timer: 2000,
          showConfirmButton: false,
          timerProgressBar: true
        }).then(() => {
          this.saved.emit();   // notifica al padre → loadStaff() + closeModal()
        });
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error.error?.message || 'Error al crear el usuario';
        console.error('Error al crear usuario:', error);
      }
    });
  }

  /**
   * Actualizar usuario existente
   */
  private updateUser(formValue: any): void {
    if (!this.user) return;

    const request: UpdateStaffRequest = {
      firstName: formValue.firstName,
      lastName: formValue.lastName,
      email: formValue.email
    };

    // Solo enviar roles si no somos currentUser, tenemos canChangeRoles y no es protectedOwner (al menos no ajeno)
    if (this.user.canChangeRoles === true && !this.user.currentUser && !this.isProtectedViewOnly) {
      // Filtrar y enviar SOLO roles que existen en assignableRoles
      const validIds = this.roles.map(r => r.id);
      request.roleIds = this.selectedRoleIds.filter(id => validIds.includes(id));
    }

    // Solo incluir password si fue ingresado
    if (formValue.password) {
      request.password = formValue.password;
    }

    this.staffService.updateStaff(this.user.id, request).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.loading = false;
        Swal.fire({
          icon: 'success',
          title: '¡Usuario actualizado!',
          text: `Los datos de ${formValue.firstName} ${formValue.lastName} fueron guardados.`,
          timer: 2000,
          showConfirmButton: false,
          timerProgressBar: true
        }).then(() => {
          this.saved.emit();   // notifica al padre → loadStaff() + closeModal()
        });
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error.error?.message || 'Error al actualizar el usuario';
        console.error('Error al actualizar usuario:', error);
      }
    });
  }

  /**
   * Marcar todos los campos como tocados para mostrar errores
   */
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  /**
   * Cerrar modal
   */
  onClose(): void {
    this.close.emit();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Obtener mensaje de error para un campo
   */
  getErrorMessage(fieldName: string): string {
    const control = this.staffForm.get(fieldName);
    
    if (!control || !control.touched || !control.errors) {
      return '';
    }

    if (control.errors['required']) {
      return 'Este campo es obligatorio';
    }
    
    if (control.errors['email']) {
      return 'Ingresa un email válido';
    }
    
    if (control.errors['minlength']) {
      const minLength = control.errors['minlength'].requiredLength;
      return `Debe tener al menos ${minLength} caracteres`;
    }

    if (control.errors['pattern']) {
      if (fieldName === 'password') {
        return 'Debe tener mayúscula, minúscula, número y carácter especial (@$!%*?&#...)';
      }
      if (fieldName === 'firstName' || fieldName === 'lastName') {
        return 'Solo se permiten letras, números y espacios';
      }
    }

    return '';
  }

  /**
   * Obtener clase de validación para un campo
   */
  getValidationClass(fieldName: string): string {
    const control = this.staffForm.get(fieldName);
    
    if (!control || !control.touched) {
      return '';
    }
    
    return control.valid ? 'is-valid' : 'is-invalid';
  }

  /**
   * Verifica si hay error de contraseñas no coincidentes
   */
  hasPasswordMismatch(): boolean {
    const control = this.staffForm.get('confirmPassword');
    return !!(control?.touched && this.staffForm.errors?.['passwordMismatch']);
  }
}
