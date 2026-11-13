import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

interface Receipt { requestId: string; status: 'RECEIVED' | 'REVIEW_REQUIRED' | 'COMPLETED' }

@Component({
  selector: 'app-account-deletion',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main>
      <h1>Eliminar una cuenta de Casa de Música Castillo</h1>
      <p>Puedes iniciar y consultar una solicitud desde este sitio. Inicia sesión con la cuenta correspondiente y completa la verificación en dos pasos si está activada.</p>
      <p>Eliminar la cuenta afecta el acceso, los favoritos y el carrito. Algunos registros de pedidos podrían conservarse cuando exista una obligación aplicable. Consulta el <a routerLink="/privacidad">Aviso de Privacidad</a>.</p>
      @if (receipt(); as result) {
        <output>{{ outcome(result.status) }}</output>
        <p>Identificador: {{ result.requestId }}</p>
        <p>Conserva el identificador en privado para consultar el estado, incluso después de que se cierre tu cuenta.</p>
      } @else if (!available()) {
        <output>{{ available() === null ? 'Consultando disponibilidad…' : 'La recepción de solicitudes aún no está disponible.' }}</output>
      } @else if (signIn()) {
        <p><a routerLink="/login" [queryParams]="{returnUrl: '/eliminar-cuenta'}">Iniciar sesión para solicitar eliminación</a></p>
      } @else {
        <form (ngSubmit)="submit()">
          <label for="deletion-password">Contraseña actual</label>
          <input id="deletion-password" name="password" type="password" autocomplete="current-password" required maxlength="255" [(ngModel)]="password">
          <label><input type="checkbox" name="confirmed" [(ngModel)]="confirmed"> Confirmo que quiero solicitar la eliminación de mi cuenta.</label>
          <button type="submit" [disabled]="busy() || !confirmed || !password.trim()">Enviar solicitud</button>
        </form>
      }
      @if (available()) {
        <section>
          <h2>Consultar una solicitud</h2>
          <form (ngSubmit)="track()">
            <label for="tracking-id">Identificador de la solicitud</label>
            <input id="tracking-id" name="trackingId" maxlength="36" autocomplete="off" [(ngModel)]="trackingId" required>
            <button type="submit" [disabled]="tracking() || !trackingId.trim()">Consultar estado</button>
          </form>
          @if (trackingResult(); as tracked) { <output>{{ outcome(tracked.status) }}</output> }
          @if (trackingError()) { <p role="alert">{{ trackingError() }}</p> }
        </section>
      }
      @if (error()) { <p role="alert">{{ error() }}</p> }
    </main>
  `,
  styles: `
    main { max-width: 44rem; padding: 2rem 1rem; margin: auto; color: #34262a; }
    h1 { color: #722f37; }
    form { display: grid; gap: .8rem; max-width: 30rem; }
    input[type=password], button { min-height: 44px; }
    button { background: #722f37; color: white; border-radius: .5rem; }
    :focus-visible { outline: 2px solid #722f37; outline-offset: 3px; }
  `,
})
export class AccountDeletionComponent {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly availabilityRequest = takeUntilDestroyed<{ available: boolean }>();
  private readonly request = takeUntilDestroyed<Receipt>();
  private readonly endpoint = environment.apiUrl + '/users/me/deletion-requests';
  readonly available = signal<boolean | null>(null);
  readonly signIn = signal(false);
  readonly busy = signal(false);
  readonly receipt = signal<Receipt | null>(null);
  readonly error = signal('');
  readonly tracking = signal(false);
  readonly trackingResult = signal<Receipt | null>(null);
  readonly trackingError = signal('');
  trackingId = '';
  password = '';
  confirmed = false;

  constructor() {
    this.http.get<{ available: boolean }>(environment.apiUrl + '/public/legal/deletion').pipe(this.availabilityRequest).subscribe({
      next: ({ available }) => {
        this.available.set(available);
        if (available) this.http.get<Receipt>(this.endpoint).pipe(this.request).subscribe({
          next: receipt => this.receipt.set(receipt),
          error: error => this.signIn.set(error.status === 401 || error.status === 403),
        });
      },
      error: () => this.available.set(false),
    });
  }

  outcome(status: Receipt['status']): string {
    switch (status) {
      case 'COMPLETED': return 'La eliminación de la cuenta se completó.';
      case 'REVIEW_REQUIRED': return 'La solicitud está recibida y requiere revisión de los datos asociados.';
      case 'RECEIVED': return 'Solicitud recibida.';
    }
  }

  track(): void {
    const requestId = this.trackingId.trim();
    if (this.tracking() || !requestId) return;
    this.tracking.set(true);
    this.trackingResult.set(null);
    this.trackingError.set('');
    this.http.post<Receipt>(environment.apiUrl + '/public/legal/deletion/status', { requestId })
      .pipe(this.request).subscribe({
        next: receipt => { this.trackingResult.set(receipt); this.tracking.set(false); },
        error: error => {
          this.tracking.set(false);
          this.trackingError.set(error.status === 404 || error.status === 400
            ? 'Revisa el identificador de la solicitud.' : 'No se pudo consultar el estado. Intenta nuevamente.');
        },
      });
  }

  submit(): void {
    if (!this.available() || this.busy() || !this.confirmed || !this.password.trim()) return;
    const body = { currentPassword: this.password, confirmed: true };
    this.password = '';
    this.busy.set(true);
    this.error.set('');
    this.http.post<Receipt>(this.endpoint, body).pipe(this.request).subscribe({
      next: receipt => {
        this.receipt.set(receipt);
        this.busy.set(false);
        if (receipt.status === 'COMPLETED') this.auth.logout({ navigate: false, remote: false });
      },
      error: error => {
        this.busy.set(false);
        if (error.status === 401) this.signIn.set(true);
        this.error.set(error.status === 400 ? 'Revisa la contraseña actual.' : 'No se pudo completar la solicitud. Intenta nuevamente.');
      },
    });
  }
}
