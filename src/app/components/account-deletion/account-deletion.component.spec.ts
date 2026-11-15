import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, ParamMap, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { AccountDeletionComponent } from './account-deletion.component';

describe('AccountDeletionComponent', () => {
  let http: HttpTestingController;
  let authSpy: jasmine.SpyObj<AuthService>;
  let isLoggedIn$: BehaviorSubject<boolean>;
  let queryParams$: BehaviorSubject<ParamMap>;

  const apiBase = environment.apiUrl;

  function setup(options: { authenticated?: boolean; initialParams?: Record<string, string> } = {}): ComponentFixture<AccountDeletionComponent> {
    const authenticated = options.authenticated ?? false;
    isLoggedIn$ = new BehaviorSubject<boolean>(authenticated);
    queryParams$ = new BehaviorSubject<ParamMap>(convertToParamMap(options.initialParams ?? {}));

    authSpy = jasmine.createSpyObj<AuthService>('AuthService', ['isAuthenticated', 'logout'], {
      isLoggedIn$: isLoggedIn$
    });
    authSpy.isAuthenticated.and.callFake(() => isLoggedIn$.value);

    TestBed.configureTestingModule({
      imports: [AccountDeletionComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: queryParams$.asObservable(),
            snapshot: { queryParamMap: queryParams$.value }
          }
        }
      ]
    });

    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AccountDeletionComponent);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => {
    http.verify();
  });

  it('loads availability metadata and displays prior deletion and retention notices', () => {
    const fixture = setup({ authenticated: false });

    const metaReq = http.expectOne(`${apiBase}/public/legal/deletion`);
    expect(metaReq.request.method).toBe('GET');
    metaReq.flush({
      available: true,
      publicEmailRequestEnabled: true,
      automaticDeletionEnabled: true,
      supportEmail: 'privacidad@casamusicacastillo.com',
      tokenValidityMinutes: 30,
      retentionPolicyVersion: 'v2'
    });
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Datos que se eliminan');
    expect(text).toContain('Datos conservados y motivo');
    expect(text).toContain('privacidad@casamusicacastillo.com');
    expect(fixture.componentInstance.available()).toBeTrue();
    expect(fixture.nativeElement.querySelector('a[href="/privacidad"]')).toBeTruthy();
  });

  it('prefills ?token= from URL, confirms via POST /public/legal/deletion/confirm and clears local session', () => {
    const token = 'Tok_1234567890123456789012345';
    const fixture = setup({ authenticated: true, initialParams: { token } });

    http.expectOne(`${apiBase}/public/legal/deletion`).flush({ available: true });
    http.expectOne(`${apiBase}/users/me/deletion-requests`).flush({}, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.hasTokenInUrl()).toBeTrue();
    expect(component.tokenConfirmForm.controls.token.value).toBe(token);

    component.tokenConfirmForm.controls.confirmed.setValue(true);
    component.submitTokenConfirmation();

    const confirmReq = http.expectOne(`${apiBase}/public/legal/deletion/confirm`);
    expect(confirmReq.request.method).toBe('POST');
    expect(confirmReq.request.body).toEqual({ token, confirmed: true });

    const receiptId = '11111111-1111-4111-8111-111111111111';
    confirmReq.flush({
      requestId: receiptId,
      status: 'COMPLETED',
      receivedAt: '2026-11-15T12:00:00Z',
      completedAt: '2026-11-15T12:00:01Z'
    });
    fixture.detectChanges();

    expect(authSpy.logout).toHaveBeenCalledOnceWith({ navigate: false, remote: false });
    expect(component.receipt()?.requestId).toBe(receiptId);
    expect(component.receipt()?.status).toBe('COMPLETED');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Cuenta eliminada definitivamente');
  });

  it('sends public email deletion request and displays anti-enumeration notice', () => {
    const fixture = setup({ authenticated: false });
    http.expectOne(`${apiBase}/public/legal/deletion`).flush({ available: true });
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.publicEmailForm.setValue({
      email: 'cliente.test@example.invalid',
      acknowledged: true
    });
    component.submitPublicEmailRequest();

    const req = http.expectOne(`${apiBase}/public/legal/deletion/request`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'cliente.test@example.invalid' });
    req.flush({
      accepted: true,
      message: 'Si el correo está asociado a una cuenta registrada, recibirás un enlace para confirmar.'
    });
    fixture.detectChanges();

    expect(component.publicNotice()).toContain('Si el correo está asociado');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Si el correo está asociado');
  });

  it('handles authenticated COMPLETED deletion by calling local logout, and preserves session on REVIEW_REQUIRED', () => {
    const fixture = setup({ authenticated: true });
    http.expectOne(`${apiBase}/public/legal/deletion`).flush({ available: true });
    http.expectOne(`${apiBase}/users/me/deletion-requests`).flush({}, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    const component = fixture.componentInstance;

    // Case A: REVIEW_REQUIRED must NOT log the user out
    component.authenticatedForm.setValue({ currentPassword: 'Synthetic!Password1', confirmed: true });
    component.submitAuthenticatedRequest();

    const reviewReq = http.expectOne(`${apiBase}/users/me/deletion-requests`);
    expect(reviewReq.request.method).toBe('POST');
    expect(reviewReq.request.body).toEqual({ currentPassword: 'Synthetic!Password1', confirmed: true });
    reviewReq.flush({
      requestId: '22222222-2222-4222-8222-222222222222',
      status: 'REVIEW_REQUIRED',
      receivedAt: '2026-11-15T12:00:00Z',
      completedAt: null
    });
    fixture.detectChanges();

    expect(authSpy.logout).not.toHaveBeenCalled();
    expect(component.receipt()?.status).toBe('REVIEW_REQUIRED');

    // Case B: COMPLETED MUST clear local session without remote call
    component.authenticatedForm.setValue({ currentPassword: 'Synthetic!Password1', confirmed: true });
    component.submitAuthenticatedRequest();

    const completeReq = http.expectOne(`${apiBase}/users/me/deletion-requests`);
    completeReq.flush({
      requestId: '33333333-3333-4333-8333-333333333333',
      status: 'COMPLETED',
      receivedAt: '2026-11-15T12:05:00Z',
      completedAt: '2026-11-15T12:05:01Z'
    });
    fixture.detectChanges();

    expect(authSpy.logout).toHaveBeenCalledOnceWith({ navigate: false, remote: false });
    expect(component.receipt()?.status).toBe('COMPLETED');
  });

  it('tracks an existing request status by UUID via POST /public/legal/deletion/status', () => {
    const fixture = setup({ authenticated: false });
    http.expectOne(`${apiBase}/public/legal/deletion`).flush({ available: true });
    fixture.detectChanges();

    const uuid = '44444444-4444-4444-8444-444444444444';
    const component = fixture.componentInstance;
    component.trackingForm.setValue({ requestId: uuid });
    component.trackByRequestId();

    const trackReq = http.expectOne(`${apiBase}/public/legal/deletion/status`);
    expect(trackReq.request.method).toBe('POST');
    expect(trackReq.request.body).toEqual({ requestId: uuid });
    trackReq.flush({
      requestId: uuid,
      status: 'RECEIVED',
      receivedAt: '2026-11-15T12:10:00Z',
      completedAt: null
    });
    fixture.detectChanges();

    expect(component.receipt()?.requestId).toBe(uuid);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Solicitud registrada');
  });
});
