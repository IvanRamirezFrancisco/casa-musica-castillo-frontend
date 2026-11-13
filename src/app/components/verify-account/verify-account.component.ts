import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, timeout } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ApiResponse } from '../../models/api-response.model';

@Component({
  selector: 'app-verify-account',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './verify-account.component.html',
  styleUrl: './verify-account.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerifyAccountComponent {
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  readonly busy = signal(false);
  readonly verified = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  email = '';
  code = '';

  constructor() {
    const token = inject(ActivatedRoute).snapshot.queryParamMap.get('token');
    if (!token) return;
    this.submit(this.auth.verifyEmail(token), true);
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  activate(): void {
    if (this.busy() || !/^\d{6}$/.test(this.code)) return;
    this.submit(this.auth.verifyEmailCode(this.email.trim(), this.code), true);
  }

  resend(): void {
    if (this.busy() || !this.email.trim()) return;
    this.submit(this.auth.resendAccountVerification(this.email.trim()), false);
  }

  private submit(request: Observable<ApiResponse<unknown>>, activation: boolean): void {
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    request.pipe(timeout(15000), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.busy.set(false);
        if (!response.success) {
          this.error.set('No se pudo completar la solicitud.');
          return;
        }
        this.code = '';
        if (activation) this.verified.set(true);
        else this.notice.set('Si tu cuenta puede recibir un reenvío, revisa tu correo y la carpeta de no deseados.');
      },
      error: (error: { status?: number }) => {
        this.busy.set(false);
        if (error.status === 400 && activation) {
          this.error.set('El enlace o código es inválido o ha vencido. Puedes solicitar uno nuevo.');
        } else if (error.status === 429) {
          this.error.set('Demasiadas solicitudes. Intenta nuevamente en unos minutos.');
        } else {
          this.error.set('No pudimos completar la solicitud. Comprueba tu conexión e inténtalo de nuevo.');
        }
      },
    });
  }
}
