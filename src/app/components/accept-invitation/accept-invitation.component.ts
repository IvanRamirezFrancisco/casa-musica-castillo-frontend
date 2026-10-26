import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { StaffService } from '../../services/staff.service';
import { InvitationInfoDto } from '../../models/staff.model';

@Component({
  selector: 'app-accept-invitation',
  standalone: true,
  imports: [FormsModule, RouterModule],
  templateUrl: './accept-invitation.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./accept-invitation.component.css']
})
export class AcceptInvitationComponent implements OnInit {
  token = '';
  loading = true;
  submitting = false;
  error = '';
  success = false;

  invitationInfo: InvitationInfoDto | null = null;

  password = '';
  confirmPassword = '';
  showPassword = false;
  showConfirmPassword = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private staffService: StaffService
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') || '';

    if (!this.token) {
      this.error = 'Enlace de invitación inválido. No se encontró el token de activación.';
      this.loading = false;
      return;
    }

    this.validateToken();
  }

  /**
   * Valida el token contra el backend
   */
  validateToken(): void {
    this.loading = true;
    this.error = '';

    this.staffService.validateInvitationToken(this.token).subscribe({
      next: (info) => {
        this.invitationInfo = info;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || err.error?.error ||
          'La invitación no es válida o ha expirado. Contacta al administrador.';
      }
    });
  }

  /**
   * Validación de fortaleza de contraseña
   */
  get passwordStrength(): { score: number; label: string; color: string } {
    const p = this.password;
    if (!p) return { score: 0, label: '', color: '' };

    let score = 0;
    if (p.length >= 8) score++;
    if (/[a-z]/.test(p)) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/\d/.test(p)) score++;
    if (/[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>/?]/.test(p)) score++;

    const labels: { [key: number]: { label: string; color: string } } = {
      0: { label: '', color: '' },
      1: { label: 'Muy débil', color: '#dc3545' },
      2: { label: 'Débil', color: '#fd7e14' },
      3: { label: 'Regular', color: '#ffc107' },
      4: { label: 'Buena', color: '#20c997' },
      5: { label: 'Fuerte', color: '#198754' }
    };

    return { score, ...labels[score] };
  }

  get passwordsMatch(): boolean {
    return !!this.password && !!this.confirmPassword && this.password === this.confirmPassword;
  }

  get passwordsDontMatch(): boolean {
    return !!this.confirmPassword && this.password !== this.confirmPassword;
  }

  get isFormValid(): boolean {
    return this.passwordStrength.score >= 4 &&
           this.passwordsMatch &&
           !this.submitting;
  }

  /**
   * Envía el formulario para activar la cuenta
   */
  onSubmit(): void {
    if (!this.isFormValid) return;

    this.submitting = true;
    this.error = '';

    this.staffService.acceptInvitation(this.token, {
      password: this.password,
      confirmPassword: this.confirmPassword
    }).subscribe({
      next: () => {
        this.submitting = false;
        this.success = true;

        // Redirigir al login después de 3 segundos
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 3000);
      },
      error: (err) => {
        this.submitting = false;
        this.error = err.error?.message || err.error?.error ||
          'Error al activar la cuenta. Intenta de nuevo.';
      }
    });
  }

  // Password requirement checks
  hasLowercase(): boolean { return /[a-z]/.test(this.password); }
  hasUppercase(): boolean { return /[A-Z]/.test(this.password); }
  hasNumber(): boolean { return /\d/.test(this.password); }
  hasSpecial(): boolean { return /[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>/?]/.test(this.password); }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }
}
