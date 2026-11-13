import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';

interface Receipt { requestId: string; status: 'RECEIVED' }

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
        <output>Solicitud recibida. Identificador: {{ result.requestId }}.</output>
        <p>Conserva el identificador y regresa a esta página con la misma cuenta para consultar el estado. Tu cuenta sigue activa durante el trámite.</p>
      } @else if (!available()) {
        <output>{{ available() === null ? 'Consultando disponibilidad…' : 'La recepción de solicitudes aún no está disponible.' }}</output>
      } @else if (signIn()) {
        <p><a routerLink="/login">Iniciar sesión para solicitar eliminación</a></p>
      } @else {
        <form (ngSubmit)="submit()">
          <label for="deletion-password">Contraseña actual</label>
          <input id="deletion-password" name="password" type="password" autocomplete="current-password" required maxlength="255" [(ngModel)]="password">
          <label><input type="checkbox" name="confirmed" [(ngModel)]="confirmed"> Confirmo que quiero solicitar la eliminación de mi cuenta.</label>
          <button type="submit" [disabled]="busy() || !confirmed || !password.trim()">Enviar solicitud</button>
        </form>
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
  private readonly availabilityRequest = takeUntilDestroyed<{ available: boolean }>();
  private readonly request = takeUntilDestroyed<Receipt>();
  private readonly endpoint = environment.apiUrl + '/users/me/deletion-requests';
  readonly available = signal<boolean | null>(null);
  readonly signIn = signal(false);
  readonly busy = signal(false);
  readonly receipt = signal<Receipt | null>(null);
  readonly error = signal('');
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

  submit(): void {
    if (!this.available() || this.busy() || !this.confirmed || !this.password.trim()) return;
    const body = { currentPassword: this.password, confirmed: true };
    this.password = '';
    this.busy.set(true);
    this.error.set('');
    this.http.post<Receipt>(this.endpoint, body).pipe(this.request).subscribe({
      next: receipt => { this.receipt.set(receipt); this.busy.set(false); },
      error: error => {
        this.busy.set(false);
        if (error.status === 401) this.signIn.set(true);
        this.error.set(error.status === 400 ? 'Revisa la contraseña actual.' : 'No se pudo completar la solicitud. Intenta nuevamente.');
      },
    });
  }
}
