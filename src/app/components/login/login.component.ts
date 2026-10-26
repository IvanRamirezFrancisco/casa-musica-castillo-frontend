import { Component, ViewChild, ElementRef, AfterViewInit, OnDestroy, OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { SanitizationService } from '../../services/sanitization.service';
import { CommonModule } from '@angular/common';
import { AuthResponse, User, AvailableLoginMethods, LoginFactorMethod } from '../../models/user.model';
import { environment } from '../../../environments/environment';

// Interface para métodos 2FA disponibles
interface TwoFactorMethod {
  id: string;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, CommonModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('emailInput') emailInput!: ElementRef;
  @ViewChild('twoFactorInput') twoFactorInput!: ElementRef;
  
  loginForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  showTwoFactorForm = false;
  pendingUser: { email: string; googleAuthEnabled: boolean; emailEnabled: boolean; backupCodesEnabled: boolean } | null = null;
  twoFactorCode: string = '';
  showPassword = false;
  searchQuery = ''; // Para la barra de búsqueda del header
  rememberMe = false;
  returnUrl: string | null = null;
  
  // Estados para 2FA
  selectedMethod: string = '';
  codeSent = false;
  availableMethods: TwoFactorMethod[] = [];

  // Estados para códigos de respaldo
  useBackupCode = false;
  backupCode = '';
  backupCodesAvailable = false; // Indica si el usuario tiene códigos de respaldo activos

  // Estados para rate limiting y cuenta regresiva
  isBlocked = false;
  blockTimeLeft = 0;
  blockSecondsLeft = 0;
  private countdownTimer: any;

  cancelTwoFactor(): void {
    this.authService.clearPendingLogin();
    this.showTwoFactorForm = false;
    this.twoFactorCode = ''; // Reset como string vacío
    this.pendingUser = null;
    this.selectedMethod = '';
    this.codeSent = false;
    this.useBackupCode = false; // Reset backup code mode
    this.backupCode = ''; // Reset backup code input
    this.backupCodesAvailable = false; // Reset backup codes availability
    this.errorMessage = '';
  }

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private sanitizationService: SanitizationService,
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpClient
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit(): void {
    // Leer email del query param si existe
    this.route.queryParams.subscribe(params => {
      if (params['email']) {
        this.loginForm.patchValue({ email: params['email'] });
      }
      if (params['returnUrl']) {
        this.returnUrl = params['returnUrl'];
      }
    });
  }

  ngAfterViewInit(): void {
    // Enfocar automáticamente el campo de email al cargar
    setTimeout(() => {
      if (this.emailInput) {
        this.emailInput.nativeElement.focus();
      }
    }, 100);
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      // Marcar todos los campos como touched para mostrar errores
      Object.keys(this.loginForm.controls).forEach(key => {
        this.loginForm.get(key)?.markAsTouched();
      });
      this.errorMessage = 'Por favor, completa todos los campos correctamente';
      return;
    }

    // Sanitizar datos antes de enviar
    const rawFormData = this.loginForm.value;
    const formData = {
      email: this.sanitizationService.sanitizeUserInput(rawFormData.email || ''),
      password: rawFormData.password || ''
    };
    
    // Validación adicional de seguridad
    if (!this.sanitizationService.isValidEmail(formData.email)) {
      this.errorMessage = 'Por favor, ingresa un email válido';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.login(formData).subscribe({
      next: (response) => {
        this.isLoading = false;
        
        // Si el backend indica que se requiere 2FA
        if (response.data?.twoFactorRequired || response.twoFactorRequired) {
          this.showTwoFactorForm = true;
          const methods = response.availableMethods;
          this.pendingUser = methods ? { email: formData.email, googleAuthEnabled: methods.GOOGLE_AUTHENTICATOR,
            emailEnabled: methods.EMAIL, backupCodesEnabled: methods.BACKUP_CODE } : null;
          this.loginForm.patchValue({password: ''});
          this.setupTwoFactorMethods();
          return;
        }
        
        // Login exitoso sin 2FA
        const token = response.data?.accessToken ?? response.accessToken ?? response.token;
        const user = response.data?.user ?? response.user;
        
        if (token && user) {
          this.authService.completeLogin(token, user);
          // Enrutamiento inteligente post-login validando el returnUrl seguro
          this.authService.redirectAfterLogin(this.returnUrl);
        } else {
          this.errorMessage = 'Error al procesar la respuesta del servidor';
        }
      },
      error: (error) => {
        this.isLoading = false;
        
        // Verificar si es un error de rate limiting (429)
        if (error.status === 429) {
          // ✅ SOLO actualizar el bloqueo si NO estábamos previamente bloqueados
          // Esto evita que intentos adicionales reinicien el countdown
          if (!error.error?.remainingTimeSeconds) {
            this.errorMessage = 'Demasiados intentos. Espera unos minutos antes de intentarlo nuevamente.';
          } else if (!this.isBlocked) {
            this.handleRateLimitError(error.error);
          } else {
            // Ya estábamos bloqueados, solo mostrar mensaje sin reiniciar countdown
            this.errorMessage = `Ya tienes un bloqueo activo. Espera ${this.formatTimeLeft()}.`;
          }
        } else {
          // ✅ Mensajes genéricos anti-enumeración: NO revelar si el email existe o la cuenta está bloqueada
          if (error.status === 401 || error.status === 403) {
            this.errorMessage = 'Credenciales incorrectas. Verifica tus datos e intenta nuevamente.';
          } else if (error.status === 0) {
            // ✅ Error de conexión - NO debe contar como intento de fuerza bruta
            this.errorMessage = 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
          } else {
            this.errorMessage = 'Ocurrió un error inesperado. Intenta nuevamente más tarde.';
          }
          // Limpiar countdown solo para errores que NO son rate limit
          if (error.status !== 429) {
            this.clearCountdown();
          }
        }
      }
    });
  }

  /**
   * Configurar métodos de 2FA disponibles basado en los métodos ACTIVOS del usuario
   * 
   * CASOS DE USO:
   * Caso 1: Google=on, Email=off, Backup=exists → Muestra Google Auth + opción backup
   * Caso 2: Google=off, Email=on, Backup=exists → Muestra Email + opción backup
   * Caso 3: Google=off, Email=off, Backup=exists → Login normal (no llega aquí)
   * Caso 4: Google=on, Email=on, Backup=none → Muestra ambos métodos sin backup
   */
  setupTwoFactorMethods(): void {
    this.availableMethods = [];
    this.backupCodesAvailable = false;
    
    if (this.pendingUser) {
      // Google Authenticator - método principal
      if (this.pendingUser.googleAuthEnabled) {
        this.availableMethods.push({
          id: 'GOOGLE_AUTHENTICATOR',
          name: 'Google Authenticator',
          description: 'Usa la aplicación Google Authenticator',
          icon: 'smartphone',
          enabled: true
        });
      }

      // Email - método principal
      if (this.pendingUser.emailEnabled) {
        this.availableMethods.push({
          id: 'EMAIL',
          name: 'Email',
          description: `Enviar código a ${this.maskEmail(this.pendingUser.email)}`,
          icon: 'mail',
          enabled: true
        });
      }

      // Códigos de respaldo - disponibles como ALTERNATIVA solo si:
      // 1. El usuario los tiene generados Y
      // 2. Hay al menos un método principal activo (Google o Email)
      if (this.pendingUser.backupCodesEnabled && this.availableMethods.length > 0) {
        this.backupCodesAvailable = true;
      }

      // Si solo hay un método disponible, seleccionarlo automáticamente
      if (this.availableMethods.length === 1) {
        this.selectMethod(this.availableMethods[0].id);
      }
    }
  }

  /**
   * Enmascarar email para mostrar parcialmente (ej: u***@gmail.com)
   */
  private maskEmail(email: string): string {
    if (!email) return '';
    const [local, domain] = email.split('@');
    if (local.length <= 2) return email;
    return `${local[0]}***@${domain}`;
  }

  /**
   * Seleccionar método de verificación
   */
  selectMethod(methodId: string): void {
    this.selectedMethod = methodId;
    this.errorMessage = '';
    this.codeSent = false;

    // Si es Google Authenticator, no necesita envío de código
    if (methodId === 'GOOGLE_AUTHENTICATOR') {
      this.codeSent = true;
      // Enfocar automáticamente el campo de código
      setTimeout(() => {
        if (this.twoFactorInput) {
          this.twoFactorInput.nativeElement.focus();
        }
      }, 100);
      return;
    }

    // Para Email, enviar código automáticamente
    this.sendVerificationCode();
  }

  /**
   * Enviar código de verificación por Email
   */
  sendVerificationCode(): void {
    if (!this.selectedMethod || !this.pendingUser) return;

    this.isLoading = true;
    this.errorMessage = '';

    const method = this.selectedMethod as 'EMAIL';
    
    this.authService.sendTwoFactorCode(method).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.success) {
          this.codeSent = true;
          this.errorMessage = '';
          // Enfocar automáticamente el campo de código
          setTimeout(() => {
            if (this.twoFactorInput) {
              this.twoFactorInput.nativeElement.focus();
            }
          }, 100);
        } else {
          this.errorMessage = response.message || 'Error enviando código';
        }
      },
      error: (error: any) => {
        this.isLoading = false;
        this.cancelTwoFactor();
        this.errorMessage = 'No se pudo completar la verificación. Inicia sesión nuevamente.';
      }
    });
  }

  /**
   * Verificar código 2FA
   */
  verifyTwoFactor(): void {
    if (!this.twoFactorCode || !this.pendingUser || !this.selectedMethod) {
      this.errorMessage = 'Por favor ingresa el código de verificación';
      return;
    }
    
    // Limpiar y validar código
    let codeString = String(this.twoFactorCode).trim();
    
    // Validar que solo contenga dígitos
    if (!/^\d+$/.test(codeString)) {
      this.errorMessage = 'El código debe contener solo dígitos';
      return;
    }
    
    // Normalizar a 6 dígitos
    codeString = codeString.padStart(6, '0');
    if (codeString.length > 6) {
      codeString = codeString.substring(0, 6);
    }
    
    this.isLoading = true;
    this.errorMessage = '';

    const payload = {
      code: codeString,
      method: this.selectedMethod as LoginFactorMethod
    };

    this.authService.verifyTwoFactor(payload).subscribe({
      next: (response) => {
        this.isLoading = false;
        const token = response.data?.accessToken;
        const user = response.data?.user;
        
        if (token && user) {
          this.authService.completeLogin(token, user);
          // Enrutamiento inteligente post-login con 2FA
          this.authService.redirectAfterLogin(this.returnUrl);
        } else {
          this.errorMessage = 'Código inválido o expirado';
        }
      },
      error: (err: any) => {
        this.cancelTwoFactor();
        this.errorMessage = 'No se pudo completar la verificación. Inicia sesión nuevamente.';
        this.isLoading = false;
      }
    });
  }

  /**
   * Volver a selección de método
   */
  goBackToMethodSelection(): void {
    this.selectedMethod = '';
    this.codeSent = false;
    this.twoFactorCode = ''; // Reset como string vacío
    this.useBackupCode = false; // Reset backup code state
    this.backupCode = ''; // Reset backup code input
    this.errorMessage = '';
  }

  /**
   * Alternar entre código de 6 dígitos y código de respaldo
   */
  toggleBackupCodeMode(): void {
    this.useBackupCode = !this.useBackupCode;
    this.twoFactorCode = '';
    this.backupCode = '';
    this.errorMessage = '';
  }

  /**
   * Verificar código de respaldo
   */
  verifyBackupCode(): void {
    if (!this.backupCode || !this.pendingUser) {
      this.errorMessage = 'Ingresa un código de respaldo válido';
      return;
    }

    // Limpiar el código de respaldo (solo números y guiones)
    const cleanCode = this.backupCode.replace(/[^0-9-]/g, '').trim();
    
    if (cleanCode.length < 8) {
      this.errorMessage = 'El código de respaldo debe tener al menos 8 dígitos';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    // Llamar al AuthService para verificar el código de respaldo
    this.authService.verifyBackupCodeForLogin(cleanCode).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.success) {
          const token = response.data?.accessToken;
          const user = response.data?.user;
          
          if (token && user) {
            this.authService.completeLogin(token, user);
            // Enrutamiento inteligente post-login con código de respaldo
            this.authService.redirectAfterLogin(this.returnUrl);
          } else {
            this.errorMessage = 'Respuesta de login inválida';
          }
        } else {
          this.errorMessage = response.message || 'Código de respaldo inválido';
        }
      },
      error: (error: any) => {
        this.isLoading = false;
        this.cancelTwoFactor();
        this.errorMessage = 'No se pudo completar la verificación. Inicia sesión nuevamente.';
      }
    });
  }

  /**
   * Enviar código por email (wrapper para compatibilidad con HTML)
   */
  sendEmailCode(): void {
    this.sendVerificationCode();
  }

  /**
   * Verificar código 2FA (wrapper para formularios con event)
   */
  verifyTwoFactorCode(event?: Event): void {
    if (event) {
      event.preventDefault();
    }
    this.verifyTwoFactor();
  }

  /**
   * Verificar código de respaldo (wrapper para formularios con event)
   */
  verifyBackupCodeSubmit(event?: Event): void {
    if (event) {
      event.preventDefault();
    }
    this.verifyBackupCode();
  }

  /**
   * Formatear número de teléfono para mostrar
   */
  public formatPhone(phone: string): string {
    if (!phone) return '';
    
    if (phone.length >= 4) {
      const hidden = '*'.repeat(phone.length - 4);
      return hidden + phone.slice(-4);
    }
    return phone;
  }

  /**
   * Obtener mensaje de error legible
   */
  private getErrorMessage(error: any): string {
    if (error?.error?.message) {
      return error.error.message;
    }
    if (error?.message) {
      return error.message;
    }
    return 'Error de conexión. Intenta nuevamente.';
  }

  /**
   * Obtener método seleccionado
   */
  getSelectedMethodInfo(): TwoFactorMethod | null {
    return this.availableMethods.find(m => m.id === this.selectedMethod) || null;
  }

  /**
   * MÉTODO para manejar entrada de código 2FA
   */
  onCodeInput(event: any): void {
    const rawValue = event.target.value;
    
    // Conversión a string
    let stringValue = String(rawValue || '');
    
    // Solo permitir dígitos
    stringValue = stringValue.replace(/[^0-9]/g, '');
    
    // Limitar a 6 dígitos
    if (stringValue.length > 6) {
      stringValue = stringValue.substring(0, 6);
    }
    
    // Asignar con Object.defineProperty para forzar tipo
    Object.defineProperty(this, 'twoFactorCode', {
      value: stringValue,
      writable: true,
      enumerable: true,
      configurable: true
    });
    
    // Actualizar DOM también
    event.target.value = stringValue;
  }

  // Getter que siempre retorna string
  get typeof() {
    return typeof this.twoFactorCode;
  }

  /**
   * Alternar visibilidad de contraseña
   */
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  /**
   * Navegar a forgot-password con el email actual
   */
  goToForgotPassword(): void {
    const currentEmail = this.loginForm.get('email')?.value || '';
    if (currentEmail && currentEmail.trim()) {
      this.router.navigate(['/forgot-password'], { queryParams: { email: currentEmail.trim() } });
    } else {
      this.router.navigate(['/forgot-password']);
    }
  }

  /**
   * Navegar a register con el email actual
   */
  goToRegister(): void {
    const currentEmail = this.loginForm.get('email')?.value || '';
    if (currentEmail && currentEmail.trim()) {
      this.router.navigate(['/register'], { queryParams: { email: currentEmail.trim() } });
    } else {
      this.router.navigate(['/register']);
    }
  }

  /**
   * Formatear el tiempo restante para mostrar al usuario
   */
  formatTimeLeft(): string {
    if (this.blockTimeLeft > 0 && this.blockSecondsLeft > 0) {
      return `${this.blockTimeLeft} minutos y ${this.blockSecondsLeft} segundos`;
    } else if (this.blockTimeLeft > 0) {
      return `${this.blockTimeLeft} minutos`;
    } else if (this.blockSecondsLeft > 0) {
      return `${this.blockSecondsLeft} segundos`;
    }
    return '0 segundos';
  }

  /**
   * Manejar errores de rate limiting con cuenta regresiva
   */
  private handleRateLimitError(errorResponse: any): void {
    this.isBlocked = true;
    
    if (errorResponse.remainingTimeSeconds) {
      const totalSeconds = errorResponse.remainingTimeSeconds;
      this.blockTimeLeft = Math.floor(totalSeconds / 60);
      this.blockSecondsLeft = totalSeconds % 60;
      
      // Mensaje inicial
      this.updateBlockMessage();
      
      // Iniciar countdown con tiempo real
      this.startCountdown(totalSeconds);
    } else {
      this.errorMessage = errorResponse.message || 'Cuenta bloqueada temporalmente. Intenta más tarde.';
    }
  }

  /**
   * Iniciar countdown en tiempo real
   */
  private startCountdown(totalSeconds: number): void {
    let remainingSeconds = totalSeconds;
    
    this.countdownTimer = setInterval(() => {
      remainingSeconds--;
      
      if (remainingSeconds <= 0) {
        this.clearCountdown();
        this.errorMessage = '';
        this.isBlocked = false;
      } else {
        this.blockTimeLeft = Math.floor(remainingSeconds / 60);
        this.blockSecondsLeft = remainingSeconds % 60;
        this.updateBlockMessage();
      }
    }, 1000);
  }

  /**
   * Actualizar mensaje de bloqueo con tiempo restante
   */
  private updateBlockMessage(): void {
    if (this.blockTimeLeft > 0 && this.blockSecondsLeft > 0) {
      this.errorMessage = `Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intenta de nuevo en ${this.blockTimeLeft} minutos y ${this.blockSecondsLeft} segundos.`;
    } else if (this.blockTimeLeft > 0) {
      this.errorMessage = `Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intenta de nuevo en ${this.blockTimeLeft} minutos.`;
    } else if (this.blockSecondsLeft > 0) {
      this.errorMessage = `Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intenta de nuevo en ${this.blockSecondsLeft} segundos.`;
    }
  }

  /**
   * Limpiar countdown
   */
  private clearCountdown(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    this.isBlocked = false;
    this.blockTimeLeft = 0;
    this.blockSecondsLeft = 0;
  }

  /**
   * Cleanup al destruir el componente
   */
  ngOnDestroy(): void {
    this.authService.clearPendingLogin();
    this.clearCountdown();
  }

  // Métodos de navegación para el header
  navigateToHome(): void {
    this.router.navigate(['/']);
  }

  navigateToRegister(): void {
    this.router.navigate(['/register']);
  }

  performSearch(): void {
    if (this.searchQuery.trim()) {
      this.router.navigate(['/search'], { queryParams: { q: this.searchQuery } });
    }
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  backToLogin(): void {
    this.showTwoFactorForm = false;
    this.twoFactorCode = '';
    this.errorMessage = '';
  }

  loginWithGoogle(): void {
    // TODO: Implementar login con Google OAuth
    // this.router.navigate(['/google-auth']);
  }

  get email() { return this.loginForm.get('email'); }
  get password() { return this.loginForm.get('password'); }
}
 
