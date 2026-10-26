import { Router } from '@angular/router';
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';

import { GoogleAuthService } from '../google-auth.service';

import { FormsModule } from '@angular/forms';


@Component({
  selector: 'app-google-auth-setup',
  templateUrl: './google-auth-setup.component.html',
  styleUrls: ['./google-auth-setup.component.css'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [FormsModule]
})

export class GoogleAuthSetupComponent implements OnInit {
  qrCodeUrl: string = '';
  secret: string = '';
  code: string = '';
  successMessage: string = '';
  errorMessage: string = '';

  constructor(private googleAuthService: GoogleAuthService, 
    private router: Router
  ) {}

  ngOnInit(): void {
    this.googleAuthService.getGoogleAuthSetup().subscribe({
      next: (response) => {
      // Si la respuesta es { success, message, data: { qrCodeUrl, secret } }
      if (response.data) {
        this.qrCodeUrl = response.data.qrCodeUrl;
        this.secret = response.data.secret;
      } else {
        this.errorMessage = 'No se recibió el QR desde el backend.';
      }
    },
    error: () => {
      this.errorMessage = 'Error obteniendo el QR de Google Authenticator.';
    }
  });
  }

  confirmActivation(): void {
    this.googleAuthService.confirmGoogleAuth(this.code).subscribe({
      next: () => {
        this.successMessage = 'Google Authenticator activado correctamente.';
        this.errorMessage = '';
      },
      error: () => {
        this.errorMessage = 'Código inválido. Intenta nuevamente.';
        this.successMessage = '';
      }
    });
  }
  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  cancelActivation(): void {
    this.router.navigate(['/dashboard']);
  }

}