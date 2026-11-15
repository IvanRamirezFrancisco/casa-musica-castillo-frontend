import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';

import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-profile-layout',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './profile-layout.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./profile-layout.component.css']
})
export class ProfileLayoutComponent implements OnInit {
  
  currentUser: User | null = null;
  
  // Elementos del menú lateral
  menuItems = [
    {
      label: 'Mi Perfil',
      icon: 'security',
      route: '/dashboard/seguridad',
      active: true
    },
    {
      label: 'Mis Pedidos',
      icon: 'receipt_long',
      route: '/dashboard/pedidos',
      active: false
    },
    {
      label: 'Favoritos',
      icon: 'favorite',
      route: '/dashboard/favoritos',
      active: false
    }
  ];

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCurrentUser();
    this.updateActiveMenuItem();
  }

  loadCurrentUser(): void {
    this.authService.getCurrentUser().subscribe((user) => {
      this.currentUser = user;
    });
  }

  setActiveMenuItem(clickedItem: any): void {
    // Desactivar todos los elementos
    this.menuItems.forEach(item => item.active = false);
    // Activar el elemento clickeado
    clickedItem.active = true;
    // Navegar a la ruta
    this.router.navigate([clickedItem.route]);
  }

  updateActiveMenuItem(): void {
    const currentUrl = this.router.url;
    this.menuItems.forEach(item => {
      item.active = currentUrl.includes(item.route.split('/').pop() || '');
    });
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  }

  getActivePageTitle(): string {
    const activeItem = this.menuItems.find(item => item.active);
    return activeItem ? activeItem.label : 'Mi Cuenta';
  }

  logout(): void {
    if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
      this.authService.logout();
      this.router.navigate(['/home']);
    }
  }

}