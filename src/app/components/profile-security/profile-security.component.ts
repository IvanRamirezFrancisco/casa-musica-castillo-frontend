import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';

import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { AuthService } from '../../services/auth.service';
import { PasswordResetService } from '../../services/password-reset.service';
import { User } from '../../models/user.model';
import { environment } from '../../../environments/environment';
import { Subscription } from 'rxjs';

interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
}

@Component({
  selector: 'app-profile-security',
  standalone: true,
  imports: [RouterModule, FormsModule],
  templateUrl: './profile-security.component.html',
  styleUrls: ['./profile-security.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-20px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('300ms ease-in', style({ opacity: 0, transform: 'translateY(-20px)' }))
      ])
    ])
  ]
})
export class ProfileSecurityComponent implements OnInit, OnDestroy {

  currentUser: User | null = null;
  loading: boolean = false;
  private subscription: Subscription = new Subscription();
  
  // Saludo personalizado según la hora
  get greeting(): string {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return 'Buenos días';
    } else if (hour >= 12 && hour < 19) {
      return 'Buenas tardes';
    } else {
      return 'Buenas noches';
    }
  }

  get userName(): string {
    if (this.currentUser) {
      return this.currentUser.firstName || 'Usuario';
    }
    return 'Usuario';
  }
  
  // Estados dinámicos basados en currentUser - Google Authenticator
  get isGoogleAuthEnabled(): boolean {
    return this.currentUser?.googleAuthEnabled || false;
  }

  // Estado dinámico - Email 2FA
  get isEmailTwoFactorEnabled(): boolean {
    return this.currentUser?.emailEnabled || false;
  }

  // Estado general de 2FA (cualquier método activo)
  get isTwoFactorEnabled(): boolean {
    return this.isGoogleAuthEnabled || this.isEmailTwoFactorEnabled;
  }
  
  get backupCodesEnabled(): boolean {
    return this.currentUser?.backupCodesEnabled || false;
  }
  
  backupCodesCount: number = 0;
  lastPasswordChange: Date | null = null;
  
  // Estados de formularios
  showPasswordForm: boolean = false;
  show2FASetup: boolean = false;   // Para Google Authenticator
  showEmail2FASetup: boolean = false; // Para Email 2FA
  showBackupCodes: boolean = false;
  
  // Estados para modales de códigos de respaldo
  showBackupCodesModal: boolean = false;
  showBackupCodesWarningModal: boolean = false;
  
  // Formularios de datos
  passwordForm = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };
  
  twoFactorData = {
    qrCode: '',
    secret: '',
    verificationCode: ''
  };
  
  backupCodes: string[] = [];
  
  // Mensajes de estado
  successMessage: string = '';
  errorMessage: string = '';

  constructor(
    private authService: AuthService,
    private passwordResetService: PasswordResetService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadUserData();
    this.loadSecuritySettings();
    // CRÍTICO: Recargar datos frescos del backend al entrar a la página
    this.reloadUserFromBackend();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  private loadUserData(): void {
    this.subscription.add(
      this.authService.user$.subscribe({
        next: (user: User | null) => {
          this.currentUser = user;
          if (user) {
            this.loadBackupCodesStatus();
          }
        },
        error: (error) => {
          this.errorMessage = 'Error al cargar información del usuario';
        }
      })
    );
  }

  private loadSecuritySettings(): void {
    this.loading = true;
    
    // Cargar datos de seguridad reales del usuario
    this.backupCodesCount = 0;
    
    // Obtener información real del perfil de seguridad
    const headers = this.getAuthHeaders();
    
    this.http.get<ApiResponse>(`${environment.apiUrl}/users/profile`, { headers })
      .subscribe({
        next: (response: ApiResponse) => {
          this.loading = false;
          if (response.success && response.data) {
            // Actualizar fecha de último cambio de contraseña si está disponible
            if (response.data.lastPasswordChange) {
              this.lastPasswordChange = new Date(response.data.lastPasswordChange);
            }
          }
        },
        error: (error: any) => {
          this.loading = false;
          this.lastPasswordChange = null;
        }
      });
  }

  private loadBackupCodesStatus(): void {
    if (!this.currentUser?.googleAuthEnabled) {
      this.backupCodesCount = 0;
      return;
    }
    
    // Obtener estado real de los códigos de respaldo del backend
    const headers = this.getAuthHeaders();
    
    this.http.get<ApiResponse>(`${environment.apiUrl}/2fa/backup-codes/status`, { headers })
      .subscribe({
        next: (response: ApiResponse) => {
          if (response.success && response.data) {
            // El backend devuelve el campo "available" para códigos no usados
            this.backupCodesCount = response.data.available || 0;
          } else {
            this.backupCodesCount = 0;
          }
        },
        error: (error: any) => {
          this.backupCodesCount = 0;
        }
      });
  }

  // ===== MÉTODOS DE CAMBIO DE CONTRASEÑA =====
  
  togglePasswordForm(): void {
    this.showPasswordForm = !this.showPasswordForm;
    this.clearMessages();
    if (!this.showPasswordForm) {
      this.resetPasswordForm();
    }
  }

  changePassword(): void {
    if (!this.validatePasswordForm()) {
      return;
    }

    this.loading = true;
    this.clearMessages();

    // Usar el servicio de password reset para cambiar la contraseña
    this.passwordResetService.changePassword(
      this.passwordForm.currentPassword,
      this.passwordForm.newPassword
    ).subscribe({
      next: (response: ApiResponse) => {
        this.loading = false;
        if (response.success) {
          this.successMessage = 'Contraseña actualizada correctamente';
          this.showPasswordForm = false;
          this.resetPasswordForm();
          this.lastPasswordChange = new Date();
        } else {
          this.errorMessage = response.message || 'Error al cambiar contraseña';
        }
      },
      error: (error: any) => {
        this.loading = false;
        this.errorMessage = error.error?.message || 'Error al cambiar contraseña';
      }
    });
  }

  private validatePasswordForm(): boolean {
    const { currentPassword, newPassword, confirmPassword } = this.passwordForm;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      this.errorMessage = 'Todos los campos son obligatorios';
      return false;
    }
    
    if (newPassword.length < 8) {
      this.errorMessage = 'La nueva contraseña debe tener al menos 8 caracteres';
      return false;
    }
    
    if (newPassword !== confirmPassword) {
      this.errorMessage = 'Las contraseñas no coinciden';
      return false;
    }
    
    return true;
  }

  private resetPasswordForm(): void {
    this.passwordForm = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    };
  }

  // ===== MÉTODOS DE AUTENTICACIÓN DE DOS FACTORES =====
  
  toggle2FASetup(): void {
    this.show2FASetup = !this.show2FASetup;
    this.clearMessages();
    
    // Generar QR si se abre el setup y Google Auth NO está habilitado
    if (this.show2FASetup && !this.isGoogleAuthEnabled) {
      this.generate2FAQRCode();
    }
  }

  generate2FAQRCode(): void {
    this.loading = true;
    this.clearMessages();
    
    const headers = this.getAuthHeaders();
    
    this.http.post<ApiResponse>(`${environment.apiUrl}/2fa/google/enable`, {}, { headers })
      .subscribe({
        next: (response: ApiResponse) => {
          if (response.success && response.data) {
            const qrCode = response.data.qrCode;
            const manualKey = response.data.manualEntryKey || response.data.secret;
            
            if (qrCode || manualKey) {
              this.loading = false;
              this.twoFactorData = {
                qrCode: qrCode || '',
                secret: manualKey || 'N/A',
                verificationCode: ''
              };

              this.successMessage = 'QR Code y código manual generados correctamente. Escanea el QR con tu app Google Authenticator.';
              return;
            }
            
            this.fetchQRCodeFallback(headers);
            
          } else {
            this.loading = false;
            this.errorMessage = response.message || 'Error al habilitar Google Authenticator';
          }
        },
        error: (error: any) => {
          const msg = (error.error?.message || '').toString().toLowerCase();
          if (error.status === 400 && (msg.includes('already enabled') || msg.includes('ya está habilitado') || msg.includes('ya esta habilitado'))) {
            this.getExistingQRCode();
          } else {
            this.loading = false;
            this.errorMessage = error.error?.message || 'Error al habilitar Google Authenticator';
          }
        }
      });
  }

  private fetchQRCodeFallback(headers: HttpHeaders): void {
    this.http.get<ApiResponse>(`${environment.apiUrl}/2fa/google/qrcode`, { headers })
      .subscribe({
        next: (qrResponse: ApiResponse) => {
          this.loading = false;

          if (qrResponse.success && qrResponse.data) {
            this.twoFactorData = {
              qrCode: qrResponse.data.qrCode || '',
              secret: qrResponse.data.manualEntryKey || qrResponse.data.secret || 'N/A',
              verificationCode: ''
            };

            this.successMessage = 'QR Code y código manual generados correctamente. Escanea el QR con tu app Google Authenticator.';
          } else {
            this.errorMessage = qrResponse.message || 'No se pudo generar el código QR';
          }
        },
        error: (error: any) => {
          this.loading = false;

          if (error.status === 400) {
            this.errorMessage = error.error?.message || 'Error: Debes habilitar Google Authenticator primero';
          } else {
            this.errorMessage = 'Error de conexión al obtener el código QR';
          }
        }
      });
  }

  enable2FA(): void {
    if (!this.twoFactorData.verificationCode) {
      this.errorMessage = 'Ingrese el código de verificación';
      return;
    }

    this.loading = true;
    this.clearMessages();

    const headers = this.getAuthHeaders();
    const verificationData = {
      code: this.twoFactorData.verificationCode
    };

    this.http.post<ApiResponse>(`${environment.apiUrl}/2fa/google/confirm`, verificationData, { headers })
      .subscribe({
        next: (response: ApiResponse) => {
          this.loading = false;
          if (response.success) {
            this.show2FASetup = false;
            this.successMessage = 'Autenticación de dos factores habilitada correctamente';
            this.generateBackupCodes();
            
            // Recargar usuario del backend para obtener estado actualizado
            this.reloadUserFromBackend();
          } else {
            this.errorMessage = response.message || 'Error al verificar código';
          }
        },
        error: (error: any) => {
          this.loading = false;
          this.errorMessage = error.error?.message || 'Código de verificación incorrecto';
        }
      });
  }

  // ===== MÉTODOS DE EMAIL 2FA =====

  toggleEmail2FA(): void {
    if (this.isEmailTwoFactorEnabled) {
      this.disableEmail2FA();
    } else {
      this.enableEmail2FA();
    }
  }

  enableEmail2FA(): void {
    this.loading = true;
    this.clearMessages();

    const headers = this.getAuthHeaders();

    this.http.post<ApiResponse>(`${environment.apiUrl}/2fa/email/enable`, {}, { headers })
      .subscribe({
        next: (response: ApiResponse) => {
          this.loading = false;
          if (response.success) {
            this.successMessage = 'Verificación por Email activada exitosamente';
            this.reloadUserFromBackend();
          } else {
            this.errorMessage = response.message || 'Error al activar verificación por Email';
          }
        },
        error: (error: any) => {
          this.loading = false;
          this.errorMessage = error.error?.message || 'Error al activar verificación por Email';
        }
      });
  }

  disableEmail2FA(): void {
    if (confirm('¿Estás seguro de que deseas desactivar la verificación por Email?')) {
      this.loading = true;
      this.clearMessages();

      const headers = this.getAuthHeaders();

      this.http.post<ApiResponse>(`${environment.apiUrl}/2fa/email/disable`, {}, { headers })
        .subscribe({
          next: (response: ApiResponse) => {
            this.loading = false;
            if (response.success) {
              this.successMessage = 'Verificación por Email desactivada';
              this.reloadUserFromBackend();
            } else {
              this.errorMessage = response.message || 'Error al desactivar verificación por Email';
            }
          },
          error: (error: any) => {
            this.loading = false;
            this.errorMessage = error.error?.message || 'Error al desactivar verificación por Email';
          }
        });
    }
  }

  // ===== MÉTODOS DE GOOGLE AUTHENTICATOR =====

  disableGoogleAuth(): void {
    if (confirm('¿Estás seguro de que deseas desactivar Google Authenticator?')) {
      this.loading = true;
      this.clearMessages();

      const headers = this.getAuthHeaders();

      this.http.post<ApiResponse>(`${environment.apiUrl}/2fa/google/disable`, {}, { headers })
        .subscribe({
          next: (response: ApiResponse) => {
            this.loading = false;
            if (response.success) {
              this.successMessage = 'Google Authenticator desactivado';
              this.backupCodes = [];
              this.backupCodesCount = 0;
              this.reloadUserFromBackend();
            } else {
              this.errorMessage = response.message || 'Error al desactivar Google Authenticator';
            }
          },
          error: (error: any) => {
            this.loading = false;
            this.errorMessage = error.error?.message || 'Error al desactivar Google Authenticator';
          }
        });
    }
  }

  disable2FA(): void {
    if (confirm('¿Estás seguro de que deseas deshabilitar la autenticación de dos factores?')) {
      this.loading = true;
      this.clearMessages();

      const headers = this.getAuthHeaders();

      this.http.post<ApiResponse>(`${environment.apiUrl}/2fa/disable`, {}, { headers })
        .subscribe({
          next: (response: ApiResponse) => {
            this.loading = false;
            if (response.success) {
              this.backupCodes = [];
              this.backupCodesCount = 0;
              this.successMessage = 'Autenticación de dos factores deshabilitada';
              
              // Recargar usuario del backend
              this.reloadUserFromBackend();
            } else {
              this.errorMessage = response.message || 'Error al desactivar 2FA';
            }
          },
          error: (error: any) => {
            this.loading = false;
            this.errorMessage = error.error?.message || 'Error al desactivar 2FA';
          }
        });
    }
  }

  /**
   * Obtener QR existente cuando Google Auth ya está habilitado
   */
  private getExistingQRCode(): void {
    const headers = this.getAuthHeaders();

    this.http.get<ApiResponse>(`${environment.apiUrl}/2fa/google/qrcode`, { headers })
      .subscribe({
        next: (response: ApiResponse) => {
          this.loading = false;
          
          if (response.success && response.data) {
            this.twoFactorData = {
              qrCode: response.data.qrCode,
              secret: response.data.manualEntryKey || response.data.secret || 'N/A',
              verificationCode: ''
            };
            
            this.show2FASetup = true;
            this.successMessage = 'QR Code existente cargado correctamente';
            
          } else {
            this.errorMessage = response.message || 'Error al obtener código QR existente';
          }
        },
        error: (error: any) => {
          this.loading = false;
          
          this.errorMessage = error.error?.message || 'Error al obtener código QR existente';
        }
      });
  }

  // ===== MÉTODOS DE CÓDIGOS DE RESPALDO =====
  
  /**
   * Generar nuevos códigos de respaldo - Punto de entrada principal
   */
  generateCodes(): void {
    if (!this.isTwoFactorEnabled) {
      this.errorMessage = 'Debes tener al menos un método 2FA activado para generar códigos de respaldo';
      return;
    }

    this.loading = true;
    this.clearMessages();

    const headers = this.getAuthHeaders();

    this.http.post<ApiResponse>(`${environment.apiUrl}/2fa/backup-codes/generate`, {}, { headers })
      .subscribe({
        next: (response: ApiResponse) => {
          this.loading = false;
          if (response.success && response.data) {
            // El backend puede devolver los códigos en diferentes formatos
            const codes = response.data.codes || response.data || [];
            
            if (Array.isArray(codes) && codes.length === 10) {
              this.backupCodes = codes;
              this.backupCodesCount = this.backupCodes.length;
              
              // Recargar datos del usuario desde el backend para obtener estado actualizado
              this.reloadUserFromBackend();
              this.showBackupCodesModal = true; // Mostrar modal profesional
              this.successMessage = 'Códigos de respaldo generados correctamente';
            } else {
              this.errorMessage = 'Error: Se esperaban 10 códigos, pero se recibieron ' + (codes.length || 0);
            }
          } else {
            this.errorMessage = response.message || 'No se pudieron generar los códigos de respaldo';
          }
        },
        error: (error: any) => {
          this.loading = false;
          this.errorMessage = error.error?.message || 'Error al generar códigos de respaldo';
        }
      });
  }

  /**
   * Ver códigos existentes - Muestra advertencia antes de regenerar
   */
  viewExistingCodes(): void {
    this.showBackupCodesWarningModal = true;
  }

  /**
   * Confirmar regeneración desde modal de advertencia
   */
  confirmRegenerateCodes(): void {
    this.showBackupCodesWarningModal = false;
    this.generateCodes(); // Regenerar códigos
  }

  /**
   * Cerrar modales
   */
  closeBackupCodesModal(): void {
    this.showBackupCodesModal = false;
  }

  closeWarningModal(): void {
    this.showBackupCodesWarningModal = false;
  }

  /**
   * Método heredado para compatibilidad - ahora redirige al nuevo flujo
   */
  toggleBackupCodes(): void {
    if (this.backupCodes.length === 0) {
      this.generateCodes();
    } else {
      this.viewExistingCodes();
    }
  }

  /**
   * Método heredado - ahora usa el nuevo flujo
   */
  regenerateBackupCodes(): void {
    this.viewExistingCodes();
  }

  /**
   * Método privado para compatibilidad con enable2FA
   */
  private generateBackupCodes(): void {
    this.generateCodes();
  }

  downloadBackupCodes(): void {
    const codesText = this.backupCodes.join('\n');
    const blob = new Blob([codesText], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'casa-musica-backup-codes.txt';
    link.click();
    
    window.URL.revokeObjectURL(url);
  }

  copyBackupCodes(): void {
    const codesText = this.backupCodes.join('\n');
    navigator.clipboard.writeText(codesText).then(() => {
      this.successMessage = 'Códigos copiados al portapapeles';
    });
  }

  // ===== MÉTODOS UTILITARIOS =====
  
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  private reloadUserFromBackend(): void {
    this.authService.getCurrentUserFromBackend().subscribe({
      next: (user: User | null) => {
        if (user) {
          this.authService.updateCurrentUser(user);
          this.currentUser = user;
          
          this.loadBackupCodesStatus();
        }
      },
      error: (error: any) => {
        this.errorMessage = 'Error al cargar datos de usuario';
      }
    });
  }
  
  clearMessages(): void {
    this.successMessage = '';
    this.errorMessage = '';
  }

  getPasswordStrengthClass(password: string): string {
    if (password.length === 0) return '';
    if (password.length < 6) return 'weak';
    if (password.length < 10) return 'medium';
    return 'strong';
  }

  getPasswordStrengthText(password: string): string {
    if (password.length === 0) return '';
    if (password.length < 6) return 'Débil';
    if (password.length < 10) return 'Media';
    return 'Fuerte';
  }

  getTimeSincePasswordChange(): string {
    if (!this.lastPasswordChange) return 'Nunca';
    
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - this.lastPasswordChange.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Hace 1 día';
    if (diffDays < 30) return `Hace ${diffDays} días`;
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return months === 1 ? 'Hace 1 mes' : `Hace ${months} meses`;
    }
    const years = Math.floor(diffDays / 365);
    return years === 1 ? 'Hace 1 año' : `Hace ${years} años`;
  }

  // ===== MÉTODOS DE RESUMEN DE SEGURIDAD =====
  
  getSecurityScore(): number {
    let score = 0;
    
    // Email verificado (25 puntos)
    if (this.currentUser?.email) score += 25;
    
    // Contraseña reciente (25 puntos)
    if (this.lastPasswordChange) {
      const daysSinceChange = Math.floor((new Date().getTime() - this.lastPasswordChange.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceChange < 180) score += 25; // Menos de 6 meses
    }
    
    // 2FA activado (30 puntos) - basado en el estado real del usuario
    if (this.currentUser?.googleAuthEnabled) score += 30;
    
    // Códigos de respaldo (20 puntos) - basado en el estado real
    if (this.currentUser?.backupCodesEnabled || this.backupCodesCount > 0) score += 20;
    
    return score;
  }

  getSecurityLevel(): string {
    const score = this.getSecurityScore();
    if (score >= 80) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }

  getSecurityLevelText(): string {
    const score = this.getSecurityScore();
    if (score >= 80) return 'Seguridad Alta';
    if (score >= 50) return 'Seguridad Media';
    return 'Seguridad Básica';
  }

  getSecurityDescription(): string {
    const score = this.getSecurityScore();
    if (score >= 80) return 'Tu cuenta tiene un excelente nivel de protección';
    if (score >= 50) return 'Tu cuenta está bien protegida, considera activar todas las medidas de seguridad';
    return 'Tu cuenta necesita medidas adicionales de seguridad';
  }

  // ===== MÉTODOS PARA NUEVAS TARJETAS ESTÁTICAS =====

  getCurrentLocation(): string {
    return 'Ciudad de México, México';
  }

  getCurrentTime(): string {
    return new Date().toLocaleString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  }

}