import { Component, ChangeDetectionStrategy } from '@angular/core';

import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

interface SiteMapSection {
  title: string;
  icon: string;
  links: SiteMapLink[];
}

interface SiteMapLink {
  name: string;
  path: string;
  description: string;
}

@Component({
  selector: 'app-site-map',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './site-map.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './site-map.component.css'
})
export class SiteMapComponent {
  siteMapSections: SiteMapSection[] = [
    {
      title: 'Principal',
      icon: 'home',
      links: [
        { name: 'Inicio', path: '/home', description: 'Página principal de Casa de Música Castillo' },
        { name: 'Catálogo', path: '/catalogo', description: 'Explora nuestra colección completa de instrumentos musicales' }
      ]
    },
    {
      title: 'Cuenta de Usuario',
      icon: 'person',
      links: [
        { name: 'Iniciar Sesión', path: '/login', description: 'Accede a tu cuenta personal' },
        { name: 'Registrarse', path: '/register', description: 'Crea una nueva cuenta de usuario' },
        { name: 'Recuperar Contraseña', path: '/forgot-password', description: 'Restablece tu contraseña olvidada' },
        { name: 'Mi Perfil', path: '/dashboard', description: 'Administra tu información personal' }
      ]
    },
    {
      title: 'Compras',
      icon: 'shopping_cart',
      links: [
        { name: 'Carrito de Compras', path: '/carrito', description: 'Revisa y gestiona tus productos seleccionados' },
        { name: 'Detalles del Producto', path: '/catalogo', description: 'Ver información detallada de cada instrumento' }
      ]
    },
    {
      title: 'Ayuda y Soporte',
      icon: 'help_outline',
      links: [
        { name: 'Centro de Ayuda', path: '/ayuda', description: 'Encuentra respuestas a preguntas frecuentes' },
        { name: 'Contáctanos', path: '/ayuda/contacto', description: 'Envíanos un mensaje o consulta' },
        { name: 'Chat de Soporte', path: '/ayuda/chat', description: 'Chatea en vivo con nuestro equipo' },
        { name: 'Mapa del Sitio', path: '/mapa-sitio', description: 'Navegación completa del sitio web' }
      ]
    },
    {
      title: 'Información',
      icon: 'info',
      links: [
        { name: 'Sobre Nosotros', path: '/nosotros', description: 'Conoce nuestra historia y equipo' },
        { name: 'Términos y Condiciones', path: '/terminos', description: 'Lee nuestros términos de servicio' }
      ]
    }
  ];

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  isLoggedIn(): boolean {
    return this.authService.isAuthenticated();
  }

  navigateToLink(path: string, event: Event): void {
    event.preventDefault();
    
    // Si la ruta es /carrito y el usuario no está logueado, redirigir a login
    if (path === '/carrito' && !this.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    
    // Navegar normalmente
    this.router.navigate([path]);
  }

  getTotalLinks(): number {
    return this.siteMapSections.reduce((total, section) => total + section.links.length, 0);
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  getCurrentYear(): number {
    return new Date().getFullYear();
  }
}
