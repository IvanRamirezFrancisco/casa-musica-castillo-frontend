import { Component, OnInit, OnDestroy, HostListener, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { User } from '../../../models/user.model';
import { filter, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { CsvImportExportComponent } from '../csv-import-export/csv-import-export.component';
import { NotificationCenterComponent } from '../../../shared/components/notification-center/notification-center.component';

interface MenuItem {
  title: string;
  icon: string;
  route: string;
  badge: string | null;
  /**
   * Permiso granular requerido para mostrar este ítem en el menú.
   * El usuario debe tener ESTE permiso.
   */
  requiredPermission?: string;
  /**
   * Lista de permisos alternativos: el ítem se muestra si el usuario
   * tiene AL MENOS UNO de ellos. Útil para módulos con múltiples permisos
   * de entrada (ej. Gestión DB: DATABASE_VIEW | DATABASE_BACKUP | ...).
   */
  requiredAnyPermission?: string[];
  /** @deprecated Usar requiredPermission o requiredAnyPermission en su lugar */
  superAdminOnly?: boolean;
}

interface ModuleHeader {
  route: string;
  title: string;
  subtitle: string;
  icon: string;
  actionLabel?: string;
  actionIcon?: string;
  actionQuery?: string;
  actionRequiresSuperAdmin?: boolean;
  secondaryActionLabel?: string;
  secondaryActionIcon?: string;
  secondaryActionQuery?: string;
  secondaryActionRequiresSuperAdmin?: boolean;
}

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, CsvImportExportComponent, NotificationCenterComponent],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.css'
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  isSidebarCollapsed = false;
  isScrolled = false;
  currentUser: User | null = null;
  public visibleMenuItems: MenuItem[] = [];
  activeRoute = '';
  private destroy$ = new Subject<void>();

  @ViewChild('adminMain', { static: true }) adminMainRef!: ElementRef<HTMLElement>;

  private onAdminMainScroll = (): void => {
    this.isScrolled = this.adminMainRef.nativeElement.scrollTop > 10;
  };

  private readonly MODULE_HEADERS: ModuleHeader[] = [
    {
      route: '/admin/brands',
      title: 'Gestión de Marcas',
      subtitle: 'Administra las marcas de instrumentos musicales',
      icon: 'local_offer',
      actionLabel: 'Nueva Marca',
      actionIcon: 'add_circle'
    },
    {
      route: '/admin/categories',
      title: 'Gestión de Categorías',
      subtitle: 'Administra las categorías de productos',
      icon: 'category',
      actionLabel: 'Nueva Categoría',
      actionIcon: 'add_circle'
    },
    {
      route: '/admin/products',
      title: 'Gestión de Productos',
      subtitle: 'Administra tu catálogo de productos',
      icon: 'inventory_2',
      actionLabel: 'Nuevo Producto',
      actionIcon: 'add_circle'
    },
    {
      route: '/admin/orders',
      title: 'Gestión de Órdenes',
      subtitle: 'Seguimiento y control de pedidos',
      icon: 'shopping_cart',
      actionLabel: 'Exportar CSV',
      actionIcon: 'download',
      actionQuery: 'export'
    },
    {
      route: '/admin/customers',
      title: 'Gestión de Clientes',
      subtitle: 'Administra la base de clientes',
      icon: 'people',
      actionLabel: 'Exportar CSV',
      actionIcon: 'download',
      actionQuery: 'export',
      secondaryActionLabel: 'Actualizar',
      secondaryActionIcon: 'refresh',
      secondaryActionQuery: 'refresh'
    },
    {
      route: '/admin/dashboard',
      title: 'Panel de Administración',
      subtitle: 'Resumen general del sistema',
      icon: 'dashboard'
    },
    {
      route: '/admin/staff',
      title: 'Gestión de Empleados',
      subtitle: 'Administra el equipo de trabajo',
      icon: 'admin_panel_settings',
      actionLabel: 'Nuevo Empleado',
      actionIcon: 'person_add',
      secondaryActionLabel: 'Exportar CSV',
      secondaryActionIcon: 'download',
      secondaryActionQuery: 'export'
    },
    {
      route: '/admin/roles',
      title: 'Gestión de Roles',
      subtitle: 'Administra roles y permisos',
      icon: 'security',
      actionLabel: 'Nuevo Rol',
      actionIcon: 'add_circle',
      actionRequiresSuperAdmin: true
    },
    {
      route: '/admin/gestion-db',
      title: 'Gestión de Base de Datos',
      subtitle: 'Respaldos · Monitoreo · Mantenimiento · Consultas lentas',
      icon: 'dns'
    },
    {
      route: '/admin/payment-settings',
      title: 'Configuración de Pagos',
      subtitle: 'Administra los datos bancarios y métodos de pago',
      icon: 'payments'
    },
    {
      route: '/admin/backups',
      title: 'Centro de Seguridad y Respaldos',
      subtitle: 'Exportación y gestión de la base de datos · Solo Super Admin',
      icon: 'backup'
    },
    {
      route: '/admin/analitica/patrones-compra',
      title: 'Analítica de patrones de compra',
      subtitle: 'Identificación de tipos de compra mediante clustering K-Means.',
      icon: 'hub'
    },
    {
      route: '/admin/analitica/pronostico-demanda',
      title: 'Pronóstico de Demanda',
      subtitle: 'Pronóstico de demanda mediante SMA.',
      icon: 'trending_up'
    },
    {
      route: '/admin/help-center',
      title: 'Centro de Ayuda',
      subtitle: 'Administra las categorías y preguntas frecuentes',
      icon: 'help_center'
    }
  ];

  private readonly ALL_MENU_ITEMS: MenuItem[] = [
    { title: 'Dashboard',    icon: 'dashboard',            route: '/admin/dashboard',       badge: null, requiredPermission: 'DASHBOARD_VIEW'  },
    { title: 'Productos',    icon: 'inventory_2',          route: '/admin/products',        badge: null, requiredPermission: 'PRODUCT_READ'    },
    { title: 'Marcas',       icon: 'label',                route: '/admin/brands',          badge: null, requiredPermission: 'PRODUCT_READ'    },
    { title: 'Categorías',   icon: 'category',             route: '/admin/categories',      badge: null, requiredPermission: 'CATEGORY_MANAGE' },
    { title: 'Órdenes',      icon: 'shopping_bag',         route: '/admin/orders',          badge: null, requiredPermission: 'ORDER_READ'      },
    { title: 'Clientes',     icon: 'people',               route: '/admin/customers',       badge: null, requiredPermission: 'CUSTOMER_READ'   },
    { title: 'Empleados', icon: 'admin_panel_settings', route: '/admin/staff',     badge: null, requiredPermission: 'USER_READ'       },
    { title: 'Roles',        icon: 'security',             route: '/admin/roles',           badge: null, requiredPermission: 'ROLE_READ'       },
    { title: 'Pagos',        icon: 'payments',             route: '/admin/payment-settings',badge: null, requiredAnyPermission: ['SYSTEM_SETTINGS', 'BANK_TRANSFER_SETTINGS_READ', 'BANK_TRANSFER_SETTINGS_UPDATE', 'PAYMENT_SETTINGS_READ', 'PAYMENT_SETTINGS_UPDATE'] },
    { title: 'Patrones de compra', icon: 'hub',                  route: '/admin/analitica/patrones-compra', badge: null, requiredPermission: 'REPORT_VIEW' },
    { title: 'Pronóstico de demanda', icon: 'trending_up',       route: '/admin/analitica/pronostico-demanda', badge: null, requiredPermission: 'REPORT_VIEW' },
    {
      title: 'Gestión DB',
      icon: 'dns',
      route: '/admin/gestion-db',
      badge: null,
      // Visible si tiene CUALQUIERA de los permisos de BD
      requiredAnyPermission: ['DATABASE_VIEW', 'DATABASE_BACKUP', 'DATABASE_MAINTAIN', 'DATABASE_AUTOMATE'],
    },
    { title: 'Centro de Ayuda', icon: 'help_center', route: '/admin/help-center', badge: null, requiredPermission: 'HELP_MANAGE' }
  ];

  /**
   * Construye los ítems filtrados según los permisos granulares del usuario actual.
   * Lógica:
   *  1. Si tiene requiredAnyPermission → visible con al menos uno de ellos.
   *  2. Si tiene requiredPermission → visible solo si tiene ese permiso exacto.
   *  3. Sin restricción → siempre visible.
   * SUPER_ADMIN siempre ve todo (authService.hasPermission lo maneja internamente).
   */
  private buildVisibleMenuItems(): void {
    const isStoreManager = this.authService.hasRole('ROLE_STORE_MANAGER');

    this.visibleMenuItems = this.ALL_MENU_ITEMS.filter(item => {
      if (item.requiredAnyPermission?.length) {
        return this.authService.hasAnyPermission(item.requiredAnyPermission);
      }
      if (item.requiredPermission) {
        return this.authService.hasPermission(item.requiredPermission);
      }
      return true;
    }).map(item => {
      if (item.route === '/admin/payment-settings' && isStoreManager) {
        return { ...item, title: 'Datos bancarios' };
      }
      return item;
    });
  }

  trackByMenuItem(index: number, item: MenuItem): string {
    return item.route;
  }

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.authService.getCurrentUser()
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
        this.buildVisibleMenuItems();
      });

    this.activeRoute = this.router.url;

    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: any) => {
        this.activeRoute = event.url;
      });

    // Escuchar scroll en .admin-main para el efecto sticky del topbar
    this.adminMainRef.nativeElement.addEventListener('scroll', this.onAdminMainScroll);
  }

  ngOnDestroy(): void {
    this.adminMainRef.nativeElement.removeEventListener('scroll', this.onAdminMainScroll);
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  logout(): void {
    this.authService.logout();
  }

  isActive(route: string): boolean {
    return this.activeRoute.startsWith(route);
  }

  goToStore(): void {
    this.router.navigate(['/home']);
  }

  /**
   * Verifica si el usuario actual es SUPER_ADMIN.
   * Soporta los formatos: ROLE_SUPER_ADMIN y SUPER_ADMIN.
   */
  isSuperAdmin(): boolean {
    return !!this.currentUser?.roles?.some(r =>
      r?.toUpperCase() === 'ROLE_SUPER_ADMIN' || r?.toUpperCase() === 'SUPER_ADMIN'
    );
  }

  /**
   * Verifica si el usuario es un ADMIN explícito (ROLE_ADMIN o ROLE_SUPER_ADMIN).
   * Empleados con roles personalizados NO son ADMIN aunque sean staff.
   */
  isAdmin(): boolean {
    return !!this.currentUser?.roles?.some(r => {
      const upper = r?.toUpperCase();
      return upper === 'ROLE_ADMIN' || upper === 'ADMIN' ||
             upper === 'ROLE_SUPER_ADMIN' || upper === 'SUPER_ADMIN';
    });
  }

  /**
   * Determina si se muestra el botón "Ver Tienda".
   * Solo admins plenos (ADMIN/SUPER_ADMIN) pueden acceder a la tienda sin
   * problemas de permisos (ej. carrito). Empleados con roles personalizados
   * no tienen acceso al carrito → se oculta el botón.
   */
  get showStoreButton(): boolean {
    return this.isAdmin();
  }

  /** Etiqueta de rol para mostrar en el sidebar */
  get userRoleLabel(): string {
    if (this.authService.isProtectedOwner()) return 'Owner Prot.';
    if (this.isSuperAdmin()) return 'Super Administrador';
    if (this.isAdmin()) return 'Administrador';
    if (this.authService.isStoreManager()) return 'Gerente de Tienda';

    // Empleados con roles personalizados: mostrar nombre legible del primer rol
    const roles = this.currentUser?.roles ?? [];
    if (roles.length > 0) {
      // Buscar el primer rol que no sea ROLE_USER (los empleados nunca tienen ROLE_USER)
      const customRole = roles.find(r => r?.toUpperCase() !== 'ROLE_USER') ?? roles[0];
      if (customRole) {
        // Convertir ROLE_VR_DASHBOARD → VR Dashboard
        return customRole
          .replace(/^ROLE_/i, '')
          .replace(/_/g, ' ')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      }
    }
    return 'Empleado';
  }

  get currentModuleHeader(): ModuleHeader {
    const match = this.MODULE_HEADERS.find(item => this.activeRoute.startsWith(item.route));
    if (match) {
      if (match.route === '/admin/payment-settings' && this.authService.hasRole('ROLE_STORE_MANAGER')) {
        return { ...match, title: 'Datos bancarios', subtitle: 'Configura la cuenta para transferencias.' };
      }
      return match;
    }
    return {
      route: this.activeRoute,
      title: 'Panel de Administración',
      subtitle: '',
      icon: 'dashboard'
    };
  }

  get canShowModuleAction(): boolean {
    if (!this.currentModuleHeader.actionLabel) return false;
    if (this.currentModuleHeader.actionRequiresSuperAdmin) {
      return this.isSuperAdmin();
    }
    return true;
  }

  get canShowSecondaryModuleAction(): boolean {
    if (!this.currentModuleHeader.secondaryActionLabel) return false;
    if (this.currentModuleHeader.secondaryActionRequiresSuperAdmin) {
      return this.isSuperAdmin();
    }
    return true;
  }

  get canShowAnyModuleAction(): boolean {
    return this.canShowModuleAction || this.canShowSecondaryModuleAction;
  }

  triggerModuleAction(): void {
    const action = this.currentModuleHeader.actionQuery || 'create';
    if (!this.currentModuleHeader.route) return;
    this.router.navigate([this.currentModuleHeader.route], {
      queryParams: { action },
      queryParamsHandling: 'merge'
    });
  }

  triggerSecondaryModuleAction(): void {
    const action = this.currentModuleHeader.secondaryActionQuery || 'refresh';
    if (!this.currentModuleHeader.route) return;
    this.router.navigate([this.currentModuleHeader.route], {
      queryParams: { action },
      queryParamsHandling: 'merge'
    });
  }
}
