import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';

import { AuthService } from '../../services/auth.service';
import { GoogleAuthService } from '../../google-auth.service';
import { User } from '../../models/user.model';

interface SecurityMethod {
  id: string;
  name: string;
  description: string;
  icon: string;
  isActive: boolean;
  canToggle: boolean;
  actionText: string;
}

@Component({
  selector: 'app-user-profile',
  imports: [],
  templateUrl: './user-profile.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './user-profile.component.css'
})
export class UserProfileComponent implements OnInit {
  
  currentUser: User | null = null;
  isLoading = true;
  
  securityMethods: SecurityMethod[] = [
    {
      id: 'email_verification',
      name: 'Verificación por Email',
      description: 'Tu email está verificado y seguro',
      icon: 'mark_email_read',
      isActive: false,
      canToggle: false,
      actionText: 'Verificado'
    },
    {
      id: 'google_auth',
      name: 'Autenticación Google',
      description: 'Usa tu cuenta de Google para mayor seguridad',
      icon: 'security',
      isActive: false,
      canToggle: true,
      actionText: 'Configurar'
    },
    {
      id: 'backup_codes',
      name: 'Códigos de Respaldo',
      description: 'Códigos de emergencia para acceso seguro',
      icon: 'backup',
      isActive: false,
      canToggle: true,
      actionText: 'Generar'
    }
  ];

  constructor(
    private authService: AuthService,
    private googleAuthService: GoogleAuthService
  ) {}

  ngOnInit(): void {
    this.loadUserProfile();
  }

  loadUserProfile(): void {
    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        this.currentUser = user;
        this.updateSecurityStatus();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading user profile:', error);
        this.isLoading = false;
      }
    });
  }

  updateSecurityStatus(): void {
    if (!this.currentUser) return;

    // Actualizar el estado de verificación de email
    const emailVerification = this.securityMethods.find(m => m.id === 'email_verification');
    if (emailVerification) {
      emailVerification.isActive = this.currentUser?.emailVerified || false;
    }

    // Verificar el estado de Google Auth
    this.googleAuthService.getGoogleAuthSetup().subscribe({
      next: (setup) => {
        const googleAuth = this.securityMethods.find(m => m.id === 'google_auth');
        if (googleAuth) {
          googleAuth.isActive = setup.isSetup;
          googleAuth.actionText = setup.isSetup ? 'Configurado' : 'Configurar';
        }
      },
      error: (error) => {
        console.error('Error checking Google Auth status:', error);
      }
    });

    // Verificar códigos de respaldo (simulado por ahora)
    const backupCodes = this.securityMethods.find(m => m.id === 'backup_codes');
    if (backupCodes) {
      // Por ahora simulamos que están disponibles
      backupCodes.isActive = true;
      backupCodes.actionText = 'Ver Códigos';
    }
  }

  getUserInitials(): string {
    if (!this.currentUser) return 'U';
    const firstName = this.currentUser.firstName || '';
    const lastName = this.currentUser.lastName || '';
    return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
  }

  getFullName(): string {
    if (!this.currentUser) return 'Usuario';
    return `${this.currentUser.firstName || ''} ${this.currentUser.lastName || ''}`.trim() || 'Usuario';
  }

  getMemberSince(): string {
    if (!this.currentUser?.createdAt) return 'No disponible';
    const date = new Date(this.currentUser.createdAt);
    return date.toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'long' 
    });
  }

  onSecurityAction(method: SecurityMethod): void {
    switch (method.id) {
      case 'google_auth':
        this.configureGoogleAuth();
        break;
      case 'backup_codes':
        this.generateBackupCodes();
        break;
      case 'email_verification':
        this.sendEmailVerification();
        break;
    }
  }

  private configureGoogleAuth(): void {
    // Lógica para configurar Google Auth
    console.log('Configuring Google Auth...');
  }

  private generateBackupCodes(): void {
    // Lógica para generar códigos de respaldo
    console.log('Generating backup codes...');
  }

  private sendEmailVerification(): void {
    // Lógica para enviar verificación de email
    console.log('Sending email verification...');
  }

  editPersonalInfo(): void {
    // Lógica para editar información personal
    console.log('Edit personal info...');
  }

  changePassword(): void {
    // Lógica para cambiar contraseña
    console.log('Change password...');
  }
}
