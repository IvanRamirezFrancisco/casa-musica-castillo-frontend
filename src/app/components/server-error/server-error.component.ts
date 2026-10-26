import { Component, ChangeDetectionStrategy } from '@angular/core';

import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-server-error',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './server-error.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./server-error.component.css']
})
export class ServerErrorComponent {
  
  constructor(private router: Router) {}

  goHome(): void {
    this.router.navigate(['/home']);
  }

  reloadPage(): void {
    window.location.reload();
  }

  contactSupport(): void {
    this.router.navigate(['/ayuda']);
  }

  getCurrentTime(): string {
    return new Date().toLocaleString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
