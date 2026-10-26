import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { guestGuard } from './guest.guard';
import { AuthService } from '../services/auth.service';

describe('GuestGuard', () => {
  let auth: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;
  let originalUser: string | null;

  beforeEach(() => {
    originalUser = localStorage.getItem('user');
    localStorage.removeItem('user');
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['isAuthenticated']);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);
    TestBed.configureTestingModule({ providers: [
      { provide: AuthService, useValue: auth }, { provide: Router, useValue: router }
    ] });
  });

  afterEach(() => {
    if (originalUser === null) localStorage.removeItem('user');
    else localStorage.setItem('user', originalUser);
  });

  it('should allow access when user is NOT authenticated', () => {
    auth.isAuthenticated.and.returnValue(false);
    expect(TestBed.runInInjectionContext(() => guestGuard())).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should block access and replace history with home when authenticated without stored user', () => {
    auth.isAuthenticated.and.returnValue(true);
    expect(TestBed.runInInjectionContext(() => guestGuard())).toBeFalse();
    expect(router.navigate).toHaveBeenCalledOnceWith(['/home'], { replaceUrl: true });
  });

  it('redirects an authenticated customer to home', () => {
    auth.isAuthenticated.and.returnValue(true);
    localStorage.setItem('user', JSON.stringify({ roles: ['ROLE_USER'] }));
    expect(TestBed.runInInjectionContext(() => guestGuard())).toBeFalse();
    expect(router.navigate).toHaveBeenCalledOnceWith(['/home'], { replaceUrl: true });
  });

  for (const role of ['ROLE_ADMIN', 'ADMIN']) {
    it('redirects ' + role + ' to the admin dashboard', () => {
      auth.isAuthenticated.and.returnValue(true);
      localStorage.setItem('user', JSON.stringify({ roles: [role] }));
      expect(TestBed.runInInjectionContext(() => guestGuard())).toBeFalse();
      expect(router.navigate).toHaveBeenCalledOnceWith(['/admin/dashboard'], { replaceUrl: true });
    });
  }

  it('continues blocking authenticated users with malformed stored data', () => {
    auth.isAuthenticated.and.returnValue(true);
    localStorage.setItem('user', '{invalid synthetic JSON');
    expect(TestBed.runInInjectionContext(() => guestGuard())).toBeFalse();
    expect(router.navigate).toHaveBeenCalledOnceWith(['/home'], { replaceUrl: true });
  });
});
