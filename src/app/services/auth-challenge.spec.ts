import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { CartService } from './cart.service';
import { NotificationCenterService } from '../core/services/notification-center.service';
import { environment } from '../../environments/environment';
import { User } from '../models/user.model';

describe('Official login and memory-only 2FA', () => {
  let service: AuthService;
  let http: HttpTestingController;
  const challenge = 'SyntheticChallengeOnlyForTests_00000000000000'.slice(0, 43).padEnd(43, 'A');
  const methods = {EMAIL: true, GOOGLE_AUTHENTICATOR: true, BACKUP_CODE: true};
  const credentials = {email: 'synthetic@example.invalid', password: 'SyntheticOnlyPassword!123'};
  const user: User = {id: 1, email: credentials.email, firstName: 'Synthetic', lastName: 'Test',
    enabled: true, twoFactorEnabled: true, roles: ['ROLE_ADMIN'], createdAt: '', updatedAt: ''};
  const token = `synthetic.${btoa(JSON.stringify({exp: Math.floor(Date.now()/1000)+900}))}.synthetic`;
  function pending(): void {
    service.login(credentials).subscribe(result => {
      expect(result.twoFactorRequired).toBeTrue();
      expect(result.availableMethods).toEqual(methods);
      expect(JSON.stringify(result)).not.toContain(challenge);
    });
    http.expectOne(`${environment.apiUrl}/auth/login`).flush({success: true, data: {
      twoFactorRequired: true, preAuthChallenge: challenge, availableMethods: methods}});
  }
  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear();
    TestBed.configureTestingModule({providers: [AuthService, provideHttpClient(), provideHttpClientTesting(),
      {provide: Router, useValue: {url: '/login', navigate: jasmine.createSpy('navigate')}},
      {provide: CartService, useValue: {loadCart: jasmine.createSpy('loadCart'), clearLocal: jasmine.createSpy('clearLocal')}},
      {provide: NotificationCenterService, useValue: {clearAll: jasmine.createSpy('clearAll')}}]});
    service = TestBed.inject(AuthService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {http.verify();localStorage.clear();sessionStorage.clear();});
  it('normal login retains access-token contract and no pending challenge', () => {
    service.login(credentials).subscribe(result => expect(result.token).toBe(token));
    const req=http.expectOne(`${environment.apiUrl}/auth/login`);expect(req.request.body).toEqual(credentials);
    req.flush({success: true,data:{jwtResponse:{accessToken:token,user}}});
    expect(service.hasPendingLogin()).toBeFalse();expect(localStorage.getItem('token')).toBe(token);
  });
  it('captures pending challenge without authenticating', () => {pending();expect(service.hasPendingLogin()).toBeTrue();expect(localStorage.getItem('token')).toBeNull();});
  it('send-code uses challenge and no email authority', () => {
    pending();service.sendTwoFactorCode('EMAIL').subscribe();
    const req=http.expectOne(`${environment.apiUrl}/2fa/send-login-code`);
    expect(req.request.body).toEqual({preAuthChallenge:challenge,method:'EMAIL'});
    expect(req.request.body.email).toBeUndefined();req.flush({success:true});
  });
  it('verify uses challenge, receives JWT, and clears pending state', () => {
    pending();service.verifyTwoFactor({code:'123456',method:'EMAIL'}).subscribe(result => expect(result.data?.accessToken).toBe(token));
    const req=http.expectOne(`${environment.apiUrl}/2fa/verify`);
    expect(req.request.body).toEqual({preAuthChallenge:challenge,method:'EMAIL',code:'123456'});
    expect(req.request.body.email).toBeUndefined();req.flush({success:true,data:{accessToken:token,user}});
    expect(service.hasPendingLogin()).toBeFalse();
  });
  it('backup code uses the same challenge contract', () => {
    pending();service.verifyBackupCodeForLogin('1234-5678').subscribe();
    const req=http.expectOne(`${environment.apiUrl}/2fa/verify`);expect(req.request.body.preAuthChallenge).toBe(challenge);
    expect(req.request.body.method).toBe('BACKUP_CODE');expect(req.request.body.email).toBeUndefined();req.flush({success:true});
  });
  it('cancel clears the challenge and prevents further HTTP', () => {
    pending();service.clearPendingLogin();service.sendTwoFactorCode('EMAIL').subscribe({error:()=>{}});
    http.expectNone(`${environment.apiUrl}/2fa/send-login-code`);expect(service.hasPendingLogin()).toBeFalse();
  });
  it('completeLogin and logout clear pending state even on login page', () => {
    pending();service.completeLogin(token,user);expect(service.hasPendingLogin()).toBeFalse();
    pending();service.logout();expect(service.hasPendingLogin()).toBeFalse();
    expect(localStorage.getItem('token')).toBeNull();
    const logout=http.expectOne(`${environment.apiUrl}/auth/logout`);
    expect(logout.request.headers.get('Authorization')).toBe(`Bearer ${token}`);logout.flush({success:true});
  });
  it('reinitializing the service loses the challenge', () => {
    pending();const fresh=TestBed.runInInjectionContext(()=>new AuthService(TestBed.inject(HttpClient),TestBed.inject(Router)));
    expect(fresh.hasPendingLogin()).toBeFalse();
  });
  it('never writes challenge to localStorage, sessionStorage, IndexedDB, URLs or logs', () => {
    const storage=spyOn(Storage.prototype,'setItem').and.callThrough();
    const idb=spyOn(indexedDB,'open').and.callThrough();
    const logs=spyOn(console,'log');const url=location.href;
    pending();
    expect(storage).not.toHaveBeenCalled();expect(idb).not.toHaveBeenCalled();expect(logs).not.toHaveBeenCalled();
    expect(location.href).toBe(url);expect(JSON.stringify(localStorage)).not.toContain(challenge);expect(JSON.stringify(sessionStorage)).not.toContain(challenge);
  });
  for(const status of [400,401,429,500]) it(`clears rejected/expired challenge on status ${status}`,()=>{
    pending();service.verifyTwoFactor({code:'123456',method:'EMAIL'}).subscribe({error:()=>{}});
    http.expectOne(`${environment.apiUrl}/2fa/verify`).flush({message:'Autenticación inválida'},{status,statusText:'Rejected'});
    expect(service.hasPendingLogin()).toBeFalse();
  });
  it('clears pending challenge when send-code fails',()=>{
    pending();service.sendTwoFactorCode('EMAIL').subscribe({error:()=>{}});
    http.expectOne(`${environment.apiUrl}/2fa/send-login-code`).flush({},{status:401,statusText:'Rejected'});
    expect(service.hasPendingLogin()).toBeFalse();
  });
  it('a cancelled in-flight login cannot resurrect its challenge',()=>{
    service.login(credentials).subscribe({error:()=>{}});service.clearPendingLogin();
    http.expectOne(`${environment.apiUrl}/auth/login`).flush({success:true,data:{twoFactorRequired:true,preAuthChallenge:challenge,availableMethods:methods}});
    expect(service.hasPendingLogin()).toBeFalse();
  });
  it('rejects malformed pending contract',()=>{
    service.login(credentials).subscribe({next:()=>fail('invalid contract'),error:()=>{}});
    http.expectOne(`${environment.apiUrl}/auth/login`).flush({data:{twoFactorRequired:true}});
    expect(service.hasPendingLogin()).toBeFalse();
  });
  it('registration keeps its existing endpoint and request',()=>{
    const request={...credentials,username:'synthetic',firstName:'Synthetic',lastName:'Test'};
    service.register(request).subscribe();const req=http.expectOne(`${environment.apiUrl}/auth/register`);
    expect(req.request.body).toEqual(request);req.flush({success:true,data:user});
  });
  it('a cancelled in-flight verify cannot authenticate after cancellation',()=>{
    pending();let completed=false;
    service.verifyTwoFactor({code:'123456',method:'EMAIL'}).subscribe({next:()=>{completed=true;},error:()=>{}});
    service.clearPendingLogin();
    http.expectOne(`${environment.apiUrl}/2fa/verify`).flush({success:true,data:{accessToken:token,user}});
    expect(completed).toBeFalse();expect(service.hasPendingLogin()).toBeFalse();
  });
  it('a stale factor error cannot clear a newer login challenge',()=>{
    pending();service.verifyTwoFactor({code:'123456',method:'EMAIL'}).subscribe({error:()=>{}});
    const stale=http.expectOne(`${environment.apiUrl}/2fa/verify`);pending();
    stale.flush({},{status:401,statusText:'Rejected'});expect(service.hasPendingLogin()).toBeTrue();
  });

});
