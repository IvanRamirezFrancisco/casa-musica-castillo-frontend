import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, ChangeDetectionStrategy } from '@angular/core';

import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { PasswordResetService } from '../../services/password-reset.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule],
  templateUrl: './forgot-password.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./forgot-password.component.css']
})
export class ForgotPasswordComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('emailInput') emailInput!: ElementRef;
  
  forgotPasswordForm: FormGroup;
  loading = false;
  submitted = false;
  message = '';
  error = '';
  isBlocked = false;
  blockTimeLeft = 0;
  blockSecondsLeft = 0;
  attemptCount = 0;
  maxAttempts = 3;
  private blockTimer: any;

  constructor(
    private fb: FormBuilder,
    private passwordResetService: PasswordResetService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  ngOnInit(): void {
    // Leer email del query param si existe
    this.route.queryParams.subscribe(params => {
      if (params['email']) {
        this.forgotPasswordForm.patchValue({ email: params['email'] });
      }
    });
  }

  ngAfterViewInit(): void {
    // Enfocar el campo de email
    setTimeout(() => {
      if (this.emailInput) {
        this.emailInput.nativeElement.focus();
      }
    }, 100);
  }

  get f() {
    return this.forgotPasswordForm.controls;
  }

  onSubmit(): void {
    this.submitted = true;
    this.message = '';
    this.error = '';

    if (this.forgotPasswordForm.invalid) {
      return;
    }

    // Verificar si está bloqueado
    if (this.isBlocked) {
      this.error = `Demasiados intentos. Espera ${this.blockTimeLeft} minutos antes de intentar nuevamente.`;
      return;
    }

    this.loading = true;
    const email = this.forgotPasswordForm.get('email')?.value;

    this.passwordResetService.forgotPassword(email).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success) {
          this.message = response.message || 'Se ha enviado un enlace de recuperación a tu email.';
          this.forgotPasswordForm.reset();
          this.submitted = false;
          this.resetAttemptCount(); // Resetear contador en caso de éxito
          
          // Redirigir al login después de 3 segundos
          setTimeout(() => {
            this.router.navigate(['/login'], { 
              queryParams: { message: 'Revisa tu email para restablecer tu contraseña' }
            });
          }, 3000);
        } else {
          this.error = response.message || 'Error al procesar la solicitud';
          this.incrementAttemptCount();
        }
      },
      error: (err) => {
        this.loading = false;
        
        if (err.status === 429) {
          this.handleRateLimitError(err.error);
        } else if (err.error?.message) {
          this.error = err.error.message;
          this.incrementAttemptCount();
        } else if (err.status === 404) {
          this.error = 'No se encontró una cuenta con ese email';
          this.incrementAttemptCount();
        } else {
          this.error = 'Error del servidor. Intenta nuevamente más tarde';
          this.incrementAttemptCount();
        }
      }
    });
  }

  /**
   * Maneja errores de rate limiting del servidor
   */
  private handleRateLimitError(errorResponse?: any): void {
    this.isBlocked = true;
    
    if (errorResponse?.remainingTimeSeconds) {
      // Usar tiempo real del servidor
      const totalSeconds = errorResponse.remainingTimeSeconds;
      this.blockTimeLeft = Math.floor(totalSeconds / 60);
      this.blockSecondsLeft = totalSeconds % 60;
      this.attemptCount = errorResponse.attemptCount || this.attemptCount;
      this.maxAttempts = errorResponse.maxAttempts || this.maxAttempts;
      
      this.error = errorResponse.message || 
        `Has excedido el límite de ${this.maxAttempts} intentos. Espera ${this.formatTimeLeft()} antes de intentar nuevamente.`;
      
      // Iniciar countdown con tiempo real
      this.startRealTimeCountdown(totalSeconds);
    } else {
      // Fallback al método anterior
      this.blockTimeLeft = 5; // 5 minutos
      this.blockSecondsLeft = 0;
      this.error = errorResponse?.message || `Has excedido el límite de ${this.maxAttempts} intentos. Espera ${this.blockTimeLeft} minutos.`;
      this.startBlockCountdown();
    }
  }

  /**
   * Incrementa el contador de intentos
   */
  private incrementAttemptCount(): void {
    this.attemptCount++;
    
    if (this.attemptCount >= this.maxAttempts) {
      this.isBlocked = true;
      this.blockTimeLeft = 5; // 5 minutos
      this.error = `Has realizado ${this.attemptCount} intentos. Espera ${this.blockTimeLeft} minutos antes de intentar nuevamente.`;
      this.startBlockCountdown();
    } else {
      const remainingAttempts = this.maxAttempts - this.attemptCount;
      this.error += ` Te quedan ${remainingAttempts} intentos.`;
    }
  }

  /**
   * Resetea el contador de intentos
   */
  private resetAttemptCount(): void {
    this.attemptCount = 0;
    this.isBlocked = false;
    this.blockTimeLeft = 0;
    this.blockSecondsLeft = 0;
    if (this.blockTimer) {
      clearInterval(this.blockTimer);
    }
  }

  /**
   * Formatea el tiempo restante para mostrar al usuario
   */
  private formatTimeLeft(): string {
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
   * Inicia un countdown en tiempo real con la información del servidor
   */
  private startRealTimeCountdown(totalSeconds: number): void {
    let remainingSeconds = totalSeconds;
    
    this.blockTimer = setInterval(() => {
      remainingSeconds--;
      
      if (remainingSeconds <= 0) {
        this.resetAttemptCount();
        this.error = '';
        this.message = 'Ya puedes intentar nuevamente.';
        // Esperar un momento para que el usuario vea el mensaje y luego redirigir al login
        setTimeout(() => {
          const email = this.forgotPasswordForm.get('email')?.value?.trim();
          if (email) {
            this.router.navigate(['/login'], { queryParams: { email } });
          } else {
            this.router.navigate(['/login']);
          }
        }, 2000);
      } else {
        this.blockTimeLeft = Math.floor(remainingSeconds / 60);
        this.blockSecondsLeft = remainingSeconds % 60;
        this.error = `Has excedido el límite de intentos. Espera ${this.formatTimeLeft()} antes de intentar nuevamente.`;
      }
    }, 1000); // Cada segundo para mayor precisión
  }

  /**
   * Inicia el countdown de bloqueo (método legacy)
   */
  private startBlockCountdown(): void {
    this.blockTimer = setInterval(() => {
      this.blockTimeLeft--;
      
      if (this.blockTimeLeft <= 0) {
        this.resetAttemptCount();
        this.error = '';
        this.message = 'Ya puedes intentar nuevamente.';
        // Redirigir al login después de un momento para que el usuario vea el mensaje
        setTimeout(() => {
          const email = this.forgotPasswordForm.get('email')?.value?.trim();
          if (email) {
            this.router.navigate(['/login'], { queryParams: { email } });
          } else {
            this.router.navigate(['/login']);
          }
        }, 2000);
      } else {
        this.error = `Has excedido el límite de intentos. Espera ${this.blockTimeLeft} minutos antes de intentar nuevamente.`;
      }
    }, 60000); // Cada minuto
  }

  /**
   * Navegar de regreso al login
   */
  goBack(): void {
    const currentEmail = this.forgotPasswordForm.get('email')?.value || '';
    if (currentEmail && currentEmail.trim()) {
      this.router.navigate(['/login'], { queryParams: { email: currentEmail.trim() } });
    } else {
      this.router.navigate(['/login']);
    }
  }

  /**
   * Cleanup al destruir el componente
   */
  ngOnDestroy(): void {
    if (this.blockTimer) {
      clearInterval(this.blockTimer);
    }
  }
}