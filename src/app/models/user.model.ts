export interface User {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    enabled: boolean;
    emailVerified?: boolean;
    twoFactorEnabled: boolean;
    roles: string[];
    permissions?: string[];
    isCustomer?: boolean;
    createdAt: string;
    updatedAt: string;
    googleAuthEnabled?: boolean;
    smsEnabled?: boolean;
    emailEnabled?: boolean; // <-- Para Email 2FA
    backupCodesEnabled?: boolean; // <-- Para Backup Codes
    protectedOwner?: boolean; // <-- Flag de jerarquia
  }
  
  export interface RegisterRequest {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone?: string;
  }
  
  export interface LoginRequest {
    email: string;
    password: string;
    twoFactorCode?: string;
  }
  
export interface AuthResponse {
  token?: string;
  accessToken?: string; // <-- debe estar aquí
  user?: User;
  twoFactorRequired?: boolean;
  pendingUser?: User;
  availableMethods?: AvailableLoginMethods;
  message?: string;
  data?: {
    accessToken?: string; // <-- también aquí
    user?: User;
    twoFactorRequired?: boolean;
    availableMethods?: AvailableLoginMethods;
  };
}
export type LoginFactorMethod = 'EMAIL' | 'GOOGLE_AUTHENTICATOR' | 'BACKUP_CODE';
export type AvailableLoginMethods = Record<LoginFactorMethod, boolean>;
export interface SendLoginCodeRequest { preAuthChallenge: string; method: 'EMAIL'; }
export interface VerifyLoginFactorRequest { preAuthChallenge: string; method: LoginFactorMethod; code: string; }
export interface LoginJwtResponse { accessToken: string; tokenType: string; expiresIn: number; user: User; }
export interface LoginFactorResponse { success: boolean; message: string; data?: LoginJwtResponse; }
