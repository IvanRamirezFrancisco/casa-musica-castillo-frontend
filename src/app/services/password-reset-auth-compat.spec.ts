import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { PasswordResetService } from './password-reset.service';
import { environment } from '../../environments/environment';

describe('Authentication hardening recovery compatibility',()=>{
  let service: PasswordResetService;
  let http: HttpTestingController;
  beforeEach(()=>{
    TestBed.configureTestingModule({providers:[PasswordResetService,provideHttpClient(withXhr()),provideHttpClientTesting()]});
    service=TestBed.inject(PasswordResetService);http=TestBed.inject(HttpTestingController);
  });
  afterEach(()=>http.verify());
  it('preserves public recovery query-parameter contract',()=>{
    service.forgotPassword('synthetic@example.invalid').subscribe();
    const req=http.expectOne(request=>request.url===`${environment.apiUrl}/auth/forgot-password`);
    expect(req.request.params.get('email')).toBe('synthetic@example.invalid');
    expect(req.request.body).toBeNull();expect(req.request.headers.has('Authorization')).toBeFalse();req.flush({success:true});
  });
  it('preserves reset token validation contract',()=>{
    service.validateResetToken('synthetic-reset-token').subscribe();
    const req=http.expectOne(request=>request.url===`${environment.apiUrl}/auth/validate-reset-token`);
    expect(req.request.method).toBe('GET');expect(req.request.params.get('token')).toBe('synthetic-reset-token');req.flush({success:true});
  });
  it('preserves reset payload without introducing a login challenge',()=>{
    service.resetPassword('synthetic-reset-token','SyntheticOnly@zK!928').subscribe();
    const req=http.expectOne(`${environment.apiUrl}/auth/reset-password`);
    expect(req.request.body).toEqual({token:'synthetic-reset-token',newPassword:'SyntheticOnly@zK!928'});
    expect(req.request.body.preAuthChallenge).toBeUndefined();req.flush({success:true});
  });
});
