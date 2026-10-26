import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';

import { filter } from 'rxjs/operators';
import { MainHeaderComponent } from './components/main-header/main-header.component';
import { MainFooterComponent } from './components/main-footer/main-footer.component';
import { CartToastComponent } from './components/cart-toast/cart-toast.component';

import { PwaUpdateService } from './services/pwa-update.service';
import { ConnectivityService } from './services/connectivity.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, MainHeaderComponent, MainFooterComponent, CartToastComponent],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'Login Project';
  showHeaderFooter = true;

  // Rutas donde NO queremos mostrar header/footer
  // Admin tiene su propio layout completo con sidebar y topbar
  private routesWithoutLayout = ['/reset-password', '/verify-account', '/admin'];

  constructor(
    private router: Router,
    private pwaUpdateService: PwaUpdateService,
    public connectivityService: ConnectivityService
  ) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      const shouldHide = this.routesWithoutLayout.some(route => 
        event.url.startsWith(route)
      );
      this.showHeaderFooter = !shouldHide;
    });
  }
}
