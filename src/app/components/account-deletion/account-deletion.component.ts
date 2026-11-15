import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';

export interface DeletionReceipt {
  requestId: string;
  status: 'RECEIVED' | 'REVIEW_REQUIRED' | 'COMPLETED' | string;
  receivedAt: string;
  completedAt: string | null;
}

export interface DeletionPolicyMetadata {
  available: boolean;
  publicEmailRequestEnabled?: boolean;
  automaticDeletionEnabled?: boolean;
  supportEmail?: string;
  tokenValidityMinutes?: number;
  retentionPolicyVersion?: string;
}

export interface PublicInitiationResponse {
  accepted: boolean;
  message: string;
}

@Component({
  selector: 'app-account-deletion',
  standalone: true,
  imports: [CommonModule, DatePipe, ReactiveFormsModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-[#FAF8F5] text-[#292524] font-sans pb-16">
      <!-- Encabezado Editorial Casa de Música Castillo -->
      <header class="relative overflow-hidden bg-gradient-to-br from-[#722F37] via-[#5A252C] to-[#3d171c] text-white py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
        <div
          class="absolute inset-0 pointer-events-none opacity-20"
          style="background: radial-gradient(circle at 85% 20%, #C5A059 0%, transparent 55%), radial-gradient(circle at 15% 85%, #C5A059 0%, transparent 50%);"
          aria-hidden="true"></div>

        <div class="max-w-5xl mx-auto relative z-10">
          <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#C5A059]/20 border border-[#C5A059]/45 text-[#FFE6A3] text-xs font-bold uppercase tracking-widest mb-4">
            <span class="material-icons text-sm" aria-hidden="true">verified_user</span>
            Privacidad y Control de Cuenta · Web y Android
          </div>

          <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight mb-3">
            Eliminar mi cuenta — Casa de Música Castillo
          </h1>
          <p class="text-base sm:text-lg text-white/90 max-w-3xl leading-relaxed">
            Solicita la eliminación definitiva de tu cuenta y datos personales de la plataforma web y de la aplicación Android
            (<span class="font-mono text-sm bg-black/25 px-2 py-0.5 rounded">com.casademusicacastillo.app</span>), incluso si ya desinstalaste la aplicación o no tienes sesión activa.
          </p>
        </div>
      </header>

      <main class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-20 space-y-6">
        <!-- Estado de disponibilidad -->
        @if (loadingAvailability()) {
          <section class="bg-white border border-[#E5E0D8] rounded-2xl p-6 shadow-sm" aria-live="polite">
            <p class="text-sm font-medium text-[#5A252C]">Verificando disponibilidad del servicio de privacidad...</p>
          </section>
        } @else if (availabilityError()) {
          <section class="bg-amber-50 border border-amber-300 text-amber-950 rounded-2xl p-6 shadow-sm" role="alert">
            <h2 class="text-base font-bold mb-1">No se pudo verificar la disponibilidad en este momento</h2>
            <p class="text-sm leading-relaxed mb-3">{{ availabilityError() }}</p>
            <button
              type="button"
              (click)="loadAvailability()"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#722F37] text-white text-sm font-semibold hover:bg-[#5A252C] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#722F37]">
              <span class="material-icons text-base" aria-hidden="true">refresh</span>
              Reintentar
            </button>
          </section>
        } @else if (!available()) {
          <section class="bg-amber-50 border border-amber-300 text-amber-950 rounded-2xl p-6 shadow-sm" role="status">
            <h2 class="text-base font-bold mb-1">Recepción automatizada temporalmente pausada</h2>
            <p class="text-sm leading-relaxed">
              La recepción automatizada se encuentra deshabilitada temporalmente por mantenimiento. Puedes escribirnos directamente a
              <a [href]="'mailto:' + supportEmail()" class="font-semibold underline text-[#722F37]">{{ supportEmail() }}</a>
              o acudir al <a routerLink="/ayuda" class="font-semibold underline text-[#722F37]">Centro de Ayuda</a>.
            </p>
          </section>
        }

        <!-- Recibo Activo / Resultado Verificado -->
        @if (receipt(); as r) {
          <section
            class="bg-white border-2 rounded-2xl p-6 shadow-sm"
            [ngClass]="r.status === 'COMPLETED' ? 'border-emerald-600' : 'border-[#C5A059]'"
            role="status"
            aria-live="polite">
            <div class="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div class="flex items-center gap-3">
                <div
                  class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  [ngClass]="r.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'">
                  <span class="material-icons" aria-hidden="true">{{ r.status === 'COMPLETED' ? 'check_circle' : 'hourglass_top' }}</span>
                </div>
                <div>
                  <p class="text-xs font-bold uppercase tracking-wider text-slate-600">Comprobante de solicitud</p>
                  <h2 class="text-xl font-bold text-[#292524]">{{ statusLabel(r.status) }}</h2>
                </div>
              </div>
              <span
                class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide"
                [ngClass]="statusBadgeClass(r.status)">
                {{ r.status }}
              </span>
            </div>

            <dl class="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl p-4 text-sm mb-4">
              <div>
                <dt class="text-xs font-semibold uppercase tracking-wide text-slate-600">Folio de seguimiento</dt>
                <dd class="font-mono text-xs sm:text-sm font-bold text-[#292524] break-all mt-1">{{ r.requestId }}</dd>
              </div>
              <div>
                <dt class="text-xs font-semibold uppercase tracking-wide text-slate-600">Fecha de recepción</dt>
                <dd class="font-medium text-[#292524] mt-1">{{ r.receivedAt | date: 'medium' }}</dd>
              </div>
              <div>
                <dt class="text-xs font-semibold uppercase tracking-wide text-slate-600">Conclusión</dt>
                <dd class="font-medium text-[#292524] mt-1">{{ r.completedAt ? (r.completedAt | date: 'medium') : 'Pendiente de revisión' }}</dd>
              </div>
            </dl>

            <p class="text-sm text-[#292524] leading-relaxed">
              @if (r.status === 'COMPLETED') {
                Tu cuenta de usuario, credenciales, factores de verificación 2FA, sesiones, direcciones, carrito y lista de favoritos fueron eliminados permanentemente. Conserva este folio únicamente si necesitas acreditar el cierre.
              } @else if (r.status === 'REVIEW_REQUIRED') {
                Tu solicitud quedó registrada y tus renovaciones de sesión fueron revocadas. La cuenta aún no se elimina porque existen pedidos asociados, registros comerciales o de auditoría que requieren validación o conclusión previa. No cancelaremos pagos ni entregas en curso de forma automática.
              } @else {
                Tu solicitud fue recibida correctamente. Guarda el folio de seguimiento para consultar su avance en cualquier momento.
              }
            </p>
          </section>
        }

        <!-- Información previa obligatoria sobre eliminación, retención y pedidos -->
        <section class="bg-white border border-[#E5E0D8] rounded-2xl p-6 shadow-sm" aria-labelledby="info-heading">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 id="info-heading" class="text-xl font-bold text-[#5A252C] flex items-center gap-2">
              <span class="material-icons text-[#722F37]" aria-hidden="true">policy</span>
              Qué ocurre al eliminar tu cuenta
            </h2>
            <a
              routerLink="/privacidad"
              class="inline-flex items-center gap-1.5 text-sm font-semibold text-[#722F37] hover:text-[#5A252C] underline focus:outline-none focus:ring-2 focus:ring-[#722F37] rounded px-1">
              Consultar Aviso de Privacidad
              <span class="material-icons text-base" aria-hidden="true">open_in_new</span>
            </a>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <article class="bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl p-4">
              <h3 class="text-sm font-bold text-[#5A252C] mb-2 flex items-center gap-1.5">
                <span class="material-icons text-base text-rose-700" aria-hidden="true">delete_forever</span>
                Datos que se eliminan
              </h3>
              <ul class="text-sm text-[#292524] space-y-1.5 list-disc pl-4 leading-relaxed">
                <li>Perfil, correo electrónico y contraseña cifrada.</li>
                <li>Factores 2FA/TOTP y códigos de respaldo.</li>
                <li>Sesiones activas y tokens de actualización en todos los dispositivos.</li>
                <li>Direcciones guardadas, carrito, lista de deseos y reseñas publicadas.</li>
              </ul>
            </article>

            <article class="bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl p-4">
              <h3 class="text-sm font-bold text-[#5A252C] mb-2 flex items-center gap-1.5">
                <span class="material-icons text-base text-amber-800" aria-hidden="true">inventory_2</span>
                Datos conservados y motivo
              </h3>
              <ul class="text-sm text-[#292524] space-y-1.5 list-disc pl-4 leading-relaxed">
                <li><strong>Pedidos concluidos e importes fiscales:</strong> se conservan desvinculados de tu perfil personal (hasta 5 años conforme al Art. 30 del Código Fiscal de la Federación).</li>
                <li><strong>Comprobante de solicitud:</strong> folio aleatorio y fechas de proceso sin correo ni datos personales.</li>
                <li><strong>Proveedores:</strong> trazas operativas bancarias/antifraude en Mercado Pago o entregas transaccionales en Brevo según sus obligaciones legales.</li>
              </ul>
            </article>

            <article class="bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl p-4">
              <h3 class="text-sm font-bold text-[#5A252C] mb-2 flex items-center gap-1.5">
                <span class="material-icons text-base text-[#722F37]" aria-hidden="true">local_shipping</span>
                Pedidos existentes y soporte
              </h3>
              <ul class="text-sm text-[#292524] space-y-1.5 list-disc pl-4 leading-relaxed">
                <li>Si tienes un pedido pendiente, en preparación o un pago en validación, la solicitud pasa a revisión (<span class="font-mono text-xs">REVIEW_REQUIRED</span>) para proteger tu compra, entrega o reembolso.</li>
                <li><strong>¿Perdiste acceso a tu correo?</strong> Escribe a
                  <a [href]="'mailto:' + supportEmail()" class="font-semibold text-[#722F37] underline">{{ supportEmail() }}</a>
                  o visita <a routerLink="/ayuda" class="font-semibold text-[#722F37] underline">Centro de Ayuda</a>.
                </li>
              </ul>
            </article>
          </div>
        </section>

        <!-- Flujo 1: Confirmación mediante enlace de verificación (?token=...) -->
        @if (hasTokenInUrl() || showManualTokenForm()) {
          <section
            id="confirmar-token"
            class="bg-white border-2 border-[#722F37] rounded-2xl p-6 shadow-md"
            aria-labelledby="token-confirm-heading">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 id="token-confirm-heading" class="text-xl font-bold text-[#722F37] flex items-center gap-2">
                <span class="material-icons" aria-hidden="true">mark_email_read</span>
                Confirmar solicitud mediante enlace de verificación
              </h2>
              @if (!hasTokenInUrl()) {
                <button
                  type="button"
                  (click)="showManualTokenForm.set(false)"
                  class="text-xs font-semibold text-slate-600 hover:text-[#722F37] underline focus:outline-none focus:ring-2 focus:ring-[#722F37] rounded px-1">
                  Ocultar
                </button>
              }
            </div>

            <p class="text-sm text-[#292524] mb-4 leading-relaxed">
              Para proteger tu cuenta contra eliminaciones accidentales, confirma de forma explícita la ejecución de tu solicitud utilizando el token seguro enviado a tu correo electrónico.
            </p>

            @if (tokenError()) {
              <div class="mb-4 p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-950 text-sm" role="alert">
                <p class="font-semibold">{{ tokenError() }}</p>
                <p class="mt-1">Si el enlace caducó o ya se utilizó, puedes solicitar uno nuevo en el formulario inferior con tu correo electrónico.</p>
              </div>
            }

            <form [formGroup]="tokenConfirmForm" (ngSubmit)="submitTokenConfirmation()" class="space-y-4" novalidate>
              <div>
                <label for="deletion-token-input" class="block text-sm font-semibold text-[#292524] mb-1">
                  Token de verificación
                </label>
                <input
                  id="deletion-token-input"
                  type="text"
                  formControlName="token"
                  autocomplete="one-time-code"
                  placeholder="Pega aquí el token recibido en tu correo"
                  class="w-full rounded-xl border border-[#D6CFC5] bg-white px-3.5 py-2.5 text-sm font-mono text-[#292524] focus:outline-none focus:ring-2 focus:ring-[#722F37] focus:border-[#722F37]" />
              </div>

              <label class="flex items-start gap-3 p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E5E0D8] cursor-pointer">
                <input
                  type="checkbox"
                  formControlName="confirmed"
                  class="mt-1 h-4 w-4 rounded border-[#722F37] text-[#722F37] focus:ring-[#722F37]" />
                <span class="text-sm text-[#292524] leading-snug">
                  Confirmo de forma explícita que deseo eliminar mi cuenta de Casa de Música Castillo y comprendo las condiciones de conservación fiscal y manejo de pedidos en curso.
                </span>
              </label>

              <button
                type="submit"
                [disabled]="!available() || submittingToken() || tokenConfirmForm.invalid"
                class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#722F37] text-white text-sm font-bold hover:bg-[#5A252C] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#722F37]">
                <span class="material-icons text-base" aria-hidden="true">delete_sweep</span>
                {{ submittingToken() ? 'Confirmando solicitud...' : 'Confirmar eliminación definitiva' }}
              </button>
            </form>
          </section>
        }

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <!-- Flujo 2: Solicitud pública sin sesión -->
          <section class="bg-white border border-[#E5E0D8] rounded-2xl p-6 shadow-sm" aria-labelledby="public-request-heading">
            <h2 id="public-request-heading" class="text-lg font-bold text-[#5A252C] mb-2 flex items-center gap-2">
              <span class="material-icons text-[#722F37]" aria-hidden="true">mail_outline</span>
              Solicitar sin iniciar sesión (por correo)
            </h2>
            <p class="text-sm text-[#292524] mb-4 leading-relaxed">
              Ideal si desinstalaste la app Android o cerraste sesión. Te enviaremos un enlace seguro de un solo uso válido por
              <strong>{{ tokenValidityMinutes() }} minutos</strong>.
            </p>

            @if (publicNotice()) {
              <div class="mb-4 p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-sm" role="status">
                {{ publicNotice() }}
              </div>
            }
            @if (publicError()) {
              <div class="mb-4 p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-950 text-sm" role="alert">
                {{ publicError() }}
              </div>
            }

            <form [formGroup]="publicEmailForm" (ngSubmit)="submitPublicEmailRequest()" class="space-y-4" novalidate>
              <div>
                <label for="deletion-email-input" class="block text-sm font-semibold text-[#292524] mb-1">
                  Correo electrónico de la cuenta
                </label>
                <input
                  id="deletion-email-input"
                  type="email"
                  formControlName="email"
                  autocomplete="email"
                  placeholder="usuario@ejemplo.com"
                  class="w-full rounded-xl border border-[#D6CFC5] bg-white px-3.5 py-2.5 text-sm text-[#292524] focus:outline-none focus:ring-2 focus:ring-[#722F37] focus:border-[#722F37]" />
                @if (publicEmailForm.controls.email.touched && publicEmailForm.controls.email.invalid) {
                  <p class="mt-1 text-xs font-medium text-rose-700" role="alert">Ingresa un correo electrónico válido.</p>
                }
              </div>

              <label class="flex items-start gap-3 p-3 rounded-xl bg-[#FAF8F5] border border-[#E5E0D8] cursor-pointer">
                <input
                  type="checkbox"
                  formControlName="acknowledged"
                  class="mt-1 h-4 w-4 rounded border-[#722F37] text-[#722F37] focus:ring-[#722F37]" />
                <span class="text-xs sm:text-sm text-[#292524] leading-snug">
                  Leí qué datos se eliminan, qué registros fiscales se conservan desvinculados y cómo se protegen los pedidos activos.
                </span>
              </label>

              <div class="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  [disabled]="!available() || submittingPublic() || publicEmailForm.invalid"
                  class="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#722F37] text-white text-sm font-bold hover:bg-[#5A252C] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#722F37]">
                  <span class="material-icons text-base" aria-hidden="true">send</span>
                  {{ submittingPublic() ? 'Enviando enlace...' : 'Enviar enlace de confirmación' }}
                </button>

                @if (!hasTokenInUrl() && !showManualTokenForm()) {
                  <button
                    type="button"
                    (click)="showManualTokenForm.set(true)"
                    class="text-sm font-semibold text-[#722F37] hover:text-[#5A252C] underline focus:outline-none focus:ring-2 focus:ring-[#722F37] rounded px-1">
                    Ya tengo un token de confirmación
                  </button>
                }
              </div>
            </form>
          </section>

          <!-- Flujo 3: Solicitud con sesión activa o acceso a login -->
          <section class="bg-white border border-[#E5E0D8] rounded-2xl p-6 shadow-sm" aria-labelledby="auth-request-heading">
            <h2 id="auth-request-heading" class="text-lg font-bold text-[#5A252C] mb-2 flex items-center gap-2">
              <span class="material-icons text-[#722F37]" aria-hidden="true">lock_person</span>
              Solicitar desde tu sesión activa
            </h2>

            @if (isAuthenticated()) {
              <p class="text-sm text-[#292524] mb-4 leading-relaxed">
                Tienes una sesión iniciada. Puedes tramitar la eliminación de forma inmediata confirmando tu contraseña actual.
              </p>

              @if (authError()) {
                <div class="mb-4 p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-950 text-sm" role="alert">
                  {{ authError() }}
                </div>
              }

              <form [formGroup]="authenticatedForm" (ngSubmit)="submitAuthenticatedRequest()" class="space-y-4" novalidate>
                <div>
                  <label for="deletion-password-input" class="block text-sm font-semibold text-[#292524] mb-1">
                    Contraseña actual
                  </label>
                  <input
                    id="deletion-password-input"
                    type="password"
                    formControlName="currentPassword"
                    autocomplete="current-password"
                    placeholder="Introduce tu contraseña actual"
                    class="w-full rounded-xl border border-[#D6CFC5] bg-white px-3.5 py-2.5 text-sm text-[#292524] focus:outline-none focus:ring-2 focus:ring-[#722F37] focus:border-[#722F37]" />
                </div>

                <label class="flex items-start gap-3 p-3 rounded-xl bg-[#FAF8F5] border border-[#E5E0D8] cursor-pointer">
                  <input
                    type="checkbox"
                    formControlName="confirmed"
                    class="mt-1 h-4 w-4 rounded border-[#722F37] text-[#722F37] focus:ring-[#722F37]" />
                  <span class="text-xs sm:text-sm text-[#292524] leading-snug">
                    Confirmo que solicito eliminar permanentemente mi cuenta y perder el acceso a esta sesión.
                  </span>
                </label>

                <button
                  type="submit"
                  [disabled]="!available() || submittingAuth() || authenticatedForm.invalid"
                  class="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-800 text-white text-sm font-bold hover:bg-rose-900 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-800">
                  <span class="material-icons text-base" aria-hidden="true">person_remove</span>
                  {{ submittingAuth() ? 'Procesando solicitud...' : 'Solicitar eliminación de mi cuenta' }}
                </button>
              </form>
            } @else {
              <p class="text-sm text-[#292524] mb-4 leading-relaxed">
                Si prefieres confirmar con tu contraseña sin esperar el correo de verificación, inicia sesión primero y regresarás automáticamente a esta pantalla.
              </p>
              <a
                routerLink="/login"
                [queryParams]="{ returnUrl: '/eliminar-cuenta' }"
                class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-[#722F37] text-[#722F37] text-sm font-bold hover:bg-[#722F37] hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#722F37]">
                <span class="material-icons text-base" aria-hidden="true">login</span>
                Iniciar sesión para solicitar con contraseña
              </a>
            }
          </section>
        </div>

        <!-- Flujo 4: Consulta de estado por folio -->
        <section class="bg-white border border-[#E5E0D8] rounded-2xl p-6 shadow-sm" aria-labelledby="track-heading">
          <h2 id="track-heading" class="text-lg font-bold text-[#5A252C] mb-2 flex items-center gap-2">
            <span class="material-icons text-[#722F37]" aria-hidden="true">track_changes</span>
            Consultar el estado de una solicitud por folio
          </h2>
          <p class="text-sm text-[#292524] mb-4">
            Ingresa el folio UUID generado al confirmar tu solicitud para conocer su estatus actual sin exponer tu correo ni tus datos personales.
          </p>

          @if (trackingError()) {
            <div class="mb-4 p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-950 text-sm" role="alert">
              {{ trackingError() }}
            </div>
          }

          <form [formGroup]="trackingForm" (ngSubmit)="trackByRequestId()" class="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end" novalidate>
            <div class="flex-1">
              <label for="tracking-request-id" class="block text-sm font-semibold text-[#292524] mb-1">
                Folio de solicitud (UUID)
              </label>
              <input
                id="tracking-request-id"
                type="text"
                formControlName="requestId"
                placeholder="Ej. 550e8400-e29b-41d4-a716-446655440000"
                class="w-full rounded-xl border border-[#D6CFC5] bg-white px-3.5 py-2.5 text-sm font-mono text-[#292524] focus:outline-none focus:ring-2 focus:ring-[#722F37] focus:border-[#722F37]" />
            </div>
            <button
              type="submit"
              [disabled]="!available() || submittingTrack() || trackingForm.invalid"
              class="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#C5A059] text-[#292524] text-sm font-bold hover:bg-[#b58e45] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#722F37] min-h-[42px]">
              <span class="material-icons text-base" aria-hidden="true">search</span>
              {{ submittingTrack() ? 'Consultando...' : 'Consultar estado' }}
            </button>
          </form>
        </section>
      </main>
    </div>
  `
})
export class AccountDeletionComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly auth = inject(AuthService);

  private readonly apiBase = `${environment.apiUrl}`;

  readonly loadingAvailability = signal(true);
  readonly availabilityError = signal('');
  readonly policy = signal<DeletionPolicyMetadata | null>(null);
  readonly available = computed(() => Boolean(this.policy()?.available));
  readonly supportEmail = computed(() => this.policy()?.supportEmail || 'soporte@casamusicacastillo.com');
  readonly tokenValidityMinutes = computed(() => this.policy()?.tokenValidityMinutes || 30);

  readonly isAuthenticated = signal(this.auth.isAuthenticated());
  readonly hasTokenInUrl = signal(false);
  readonly showManualTokenForm = signal(false);

  readonly receipt = signal<DeletionReceipt | null>(null);

  readonly publicNotice = signal('');
  readonly publicError = signal('');
  readonly tokenError = signal('');
  readonly authError = signal('');
  readonly trackingError = signal('');

  readonly submittingPublic = signal(false);
  readonly submittingToken = signal(false);
  readonly submittingAuth = signal(false);
  readonly submittingTrack = signal(false);

  readonly publicEmailForm = this.fb.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(180)]],
    acknowledged: [false, [Validators.requiredTrue]]
  });

  readonly tokenConfirmForm = this.fb.group({
    token: ['', [Validators.required, Validators.minLength(20), Validators.maxLength(255)]],
    confirmed: [false, [Validators.requiredTrue]]
  });

  readonly authenticatedForm = this.fb.group({
    currentPassword: ['', [Validators.required, Validators.maxLength(255)]],
    confirmed: [false, [Validators.requiredTrue]]
  });

  readonly trackingForm = this.fb.group({
    requestId: ['', [Validators.required, Validators.pattern(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)]]
  });

  ngOnInit(): void {
    this.auth.isLoggedIn$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(logged => {
      this.isAuthenticated.set(logged && this.auth.isAuthenticated());
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const token = (params.get('token') ?? '').trim();
      if (token.length >= 20) {
        this.hasTokenInUrl.set(true);
        this.tokenConfirmForm.controls.token.setValue(token);
      } else {
        this.hasTokenInUrl.set(false);
      }
    });

    this.loadAvailability();
  }

  loadAvailability(): void {
    this.loadingAvailability.set(true);
    this.availabilityError.set('');
    this.http.get<DeletionPolicyMetadata>(`${this.apiBase}/public/legal/deletion`).subscribe({
      next: meta => {
        this.policy.set(meta);
        this.loadingAvailability.set(false);
        if (meta.available && this.isAuthenticated()) {
          this.loadOwnRequest();
        }
      },
      error: (err: HttpErrorResponse) => {
        this.loadingAvailability.set(false);
        this.availabilityError.set(this.extractError(err, 'No pudimos conectar con el servicio de eliminación de cuenta.'));
      }
    });
  }

  submitPublicEmailRequest(): void {
    if (this.publicEmailForm.invalid || this.submittingPublic()) return;
    this.submittingPublic.set(true);
    this.publicError.set('');
    this.publicNotice.set('');

    const email = this.publicEmailForm.controls.email.value.trim();
    this.http.post<PublicInitiationResponse>(`${this.apiBase}/public/legal/deletion/request`, { email }).subscribe({
      next: res => {
        this.submittingPublic.set(false);
        this.publicNotice.set(res?.message || 'Si el correo está asociado a una cuenta registrada, enviaremos un enlace de confirmación.');
      },
      error: (err: HttpErrorResponse) => {
        this.submittingPublic.set(false);
        this.publicError.set(this.extractError(err, 'No fue posible enviar la solicitud en este momento.'));
      }
    });
  }

  submitTokenConfirmation(): void {
    if (this.tokenConfirmForm.invalid || this.submittingToken()) return;
    this.submittingToken.set(true);
    this.tokenError.set('');

    const { token, confirmed } = this.tokenConfirmForm.getRawValue();
    this.http.post<DeletionReceipt>(`${this.apiBase}/public/legal/deletion/confirm`, {
      token: token.trim(),
      confirmed
    }).subscribe({
      next: r => {
        this.submittingToken.set(false);
        this.receipt.set(r);
        this.trackingForm.controls.requestId.setValue(r.requestId);
        this.tokenConfirmForm.reset({ token: '', confirmed: false });
        if (this.auth.isAuthenticated()) {
          this.auth.logout({ navigate: false, remote: false });
        }
      },
      error: (err: HttpErrorResponse) => {
        this.submittingToken.set(false);
        this.tokenError.set(this.extractError(err, 'El enlace o token de confirmación no es válido o ya expiró.'));
      }
    });
  }

  submitAuthenticatedRequest(): void {
    if (this.authenticatedForm.invalid || this.submittingAuth()) return;
    this.submittingAuth.set(true);
    this.authError.set('');

    const { currentPassword, confirmed } = this.authenticatedForm.getRawValue();
    this.http.post<DeletionReceipt>(`${this.apiBase}/users/me/deletion-requests`, {
      currentPassword,
      confirmed
    }).subscribe({
      next: r => {
        this.submittingAuth.set(false);
        this.receipt.set(r);
        this.trackingForm.controls.requestId.setValue(r.requestId);
        this.authenticatedForm.reset({ currentPassword: '', confirmed: false });
        if (r.status === 'COMPLETED') {
          this.auth.logout({ navigate: false, remote: false });
        }
      },
      error: (err: HttpErrorResponse) => {
        this.submittingAuth.set(false);
        this.authError.set(this.extractError(err, 'No se pudo procesar la solicitud. Verifica tu contraseña actual.'));
      }
    });
  }

  trackByRequestId(): void {
    if (this.trackingForm.invalid || this.submittingTrack()) return;
    this.submittingTrack.set(true);
    this.trackingError.set('');

    const requestId = this.trackingForm.controls.requestId.value.trim();
    this.http.post<DeletionReceipt>(`${this.apiBase}/public/legal/deletion/status`, { requestId }).subscribe({
      next: r => {
        this.submittingTrack.set(false);
        this.receipt.set(r);
      },
      error: (err: HttpErrorResponse) => {
        this.submittingTrack.set(false);
        this.trackingError.set(this.extractError(err, 'No encontramos una solicitud con ese folio.'));
      }
    });
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'COMPLETED':
        return 'Cuenta eliminada definitivamente';
      case 'REVIEW_REQUIRED':
        return 'Solicitud recibida · En revisión administrativa';
      case 'RECEIVED':
        return 'Solicitud registrada';
      default:
        return status;
    }
  }

  statusBadgeClass(status: string): string {
    switch (status) {
      case 'COMPLETED':
        return 'bg-emerald-100 text-emerald-900';
      case 'REVIEW_REQUIRED':
        return 'bg-amber-100 text-amber-900';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  }

  private loadOwnRequest(): void {
    this.http.get<DeletionReceipt>(`${this.apiBase}/users/me/deletion-requests`).subscribe({
      next: r => {
        this.receipt.set(r);
        if (r?.requestId) {
          this.trackingForm.controls.requestId.setValue(r.requestId);
        }
      },
      error: () => {
        // Es normal devolver 404 cuando el usuario no ha registrado solicitud previa.
      }
    });
  }

  private extractError(err: HttpErrorResponse, fallback: string): string {
    return err?.error?.message || err?.error?.error || fallback;
  }
}
