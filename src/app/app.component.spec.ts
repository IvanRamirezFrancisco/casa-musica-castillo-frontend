import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AppComponent } from './app.component';
import { MainHeaderComponent } from './components/main-header/main-header.component';
import { MainFooterComponent } from './components/main-footer/main-footer.component';
import { CartToastComponent } from './components/cart-toast/cart-toast.component';
import { PwaUpdateService } from './services/pwa-update.service';
import { ConnectivityService } from './services/connectivity.service';

@Component({ selector: 'app-main-header', standalone: true, template: '' })
class HeaderStubComponent {}
@Component({ selector: 'app-main-footer', standalone: true, template: '' })
class FooterStubComponent {}
@Component({ selector: 'app-cart-toast', standalone: true, template: '' })
class CartToastStubComponent {}
@Component({ standalone: true, template: 'Página de prueba' })
class PageStubComponent {}

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let element: HTMLElement;
  let online: ReturnType<typeof signal<boolean>>;
  let serverUnavailable: ReturnType<typeof signal<boolean>>;
  let justReconnected: ReturnType<typeof signal<boolean>>;

  beforeEach(async () => {
    online = signal(true);
    serverUnavailable = signal(false);
    justReconnected = signal(false);
    const connectivity = { online, serverUnavailable, justReconnected } satisfies Pick<ConnectivityService, 'online' | 'serverUnavailable' | 'justReconnected'>;
    const pwa = jasmine.createSpyObj<PwaUpdateService>('PwaUpdateService', ['ngOnDestroy']);
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([
        { path: 'home', component: PageStubComponent },
        { path: 'admin', component: PageStubComponent },
        { path: 'reset-password', component: PageStubComponent },
        { path: 'verify-account', component: PageStubComponent }
      ]), { provide: PwaUpdateService, useValue: pwa },
      { provide: ConnectivityService, useValue: connectivity }]
    }).overrideComponent(AppComponent, {
      remove: { imports: [MainHeaderComponent, MainFooterComponent, CartToastComponent] },
      add: { imports: [HeaderStubComponent, FooterStubComponent, CartToastStubComponent] }
    }).compileComponents();
    fixture = TestBed.createComponent(AppComponent);
    element = fixture.nativeElement;
  });

  it('should create the app', () => {
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should expose the current application title', () => {
    expect(fixture.componentInstance.title).toBe('Login Project');
  });

  it('should render the application shell and global layout', () => {
    fixture.detectChanges();
    expect(element.querySelector('.app-container')).not.toBeNull();
    expect(element.querySelector('router-outlet')).not.toBeNull();
    expect(element.querySelector('app-main-header')).not.toBeNull();
    expect(element.querySelector('app-main-footer')).not.toBeNull();
    expect(element.querySelector('app-cart-toast')).not.toBeNull();
  });

  for (const route of ['/admin', '/reset-password', '/verify-account']) {
    it('hides global layout on ' + route + ' and restores it on home', async () => {
      fixture.detectChanges();
      const router = TestBed.inject(Router);
      await router.navigateByUrl(route);
      fixture.detectChanges();
      expect(fixture.componentInstance.showHeaderFooter).toBeFalse();
      expect(element.querySelector('app-main-header')).toBeNull();
      expect(element.querySelector('app-main-footer')).toBeNull();
      expect(element.querySelector('app-cart-toast')).not.toBeNull();
      await router.navigateByUrl('/home');
      fixture.detectChanges();
      expect(element.querySelector('app-main-header')).not.toBeNull();
      expect(element.querySelector('app-main-footer')).not.toBeNull();
    });
  }

  it('renders the offline status from connectivity signals', () => {
    online.set(false);
    fixture.detectChanges();
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Sin conexión a Internet.');
  });

  it('renders the unavailable-server status while online', () => {
    serverUnavailable.set(true);
    fixture.detectChanges();
    expect(element.querySelector('[role="status"]')?.textContent).toContain('El servidor está tardando en responder.');
  });

  it('renders reconnection only after the server is available', () => {
    justReconnected.set(true);
    serverUnavailable.set(true);
    fixture.detectChanges();
    expect(element.textContent).not.toContain('Conexión restablecida.');
    serverUnavailable.set(false);
    fixture.detectChanges();
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Conexión restablecida.');
  });
});
