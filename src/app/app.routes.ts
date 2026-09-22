import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';

import { AuthGuard } from './auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { PermissionGuard } from './guards/permission.guard';
import { guestGuard } from './guards/guest.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'home', component: HomeComponent },
  
  // Rutas de autenticación (solo para usuarios NO logueados)
  { path: 'login', loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent), canActivate: [guestGuard] },
  { path: 'register', loadComponent: () => import('./components/register/register.component').then(m => m.RegisterComponent), canActivate: [guestGuard] },
  { path: 'forgot-password', loadComponent: () => import('./components/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent), canActivate: [guestGuard] },
  { path: 'reset-password', loadComponent: () => import('./components/reset-password/reset-password.component').then(m => m.ResetPasswordComponent), canActivate: [guestGuard] },
  { path: 'verify-account', loadComponent: () => import('./components/verify-account/verify-account.component').then(m => m.VerifyAccountComponent) },
  
  // Ruta pública de aceptación de invitación (sin auth guard)
  { path: 'auth/accept-invitation/:token', loadComponent: () => import('./components/accept-invitation/accept-invitation.component').then(m => m.AcceptInvitationComponent) },
  
  // Rutas públicas
  { path: 'catalogo', loadComponent: () => import('./components/catalogo/catalogo.component').then(m => m.CatalogoComponent) },
  { path: 'busqueda', loadComponent: () => import('./components/search-results/search-results.component').then(m => m.SearchResultsComponent) },
  { path: 'ayuda', loadComponent: () => import('./components/help-center/help-center.component').then(m => m.HelpCenterComponent) },
  // Rutas públicas de información (estructurales)
  { 
    path: 'informacion/envios', 
    loadComponent: () => import('./components/shipping-info/shipping-info.component').then(m => m.ShippingInfoComponent),
    data: { title: 'Envíos y Entregas' }
  },
  { 
    path: 'informacion/cancelaciones', 
    loadComponent: () => import('./components/information-page/information-page.component').then(m => m.InformationPageComponent),
    data: { type: 'cancelaciones', title: 'Cancelaciones de Pedidos' }
  },
  { 
    path: 'informacion/pagos', 
    loadComponent: () => import('./components/payments-info/payments-info.component').then(m => m.PaymentsInfoComponent),
    data: { title: 'Formas de Pago' }
  },
  { 
    path: 'terminos', 
    loadComponent: () => import('./components/information-page/information-page.component').then(m => m.InformationPageComponent),
    data: { type: 'terminos', title: 'Términos y Condiciones' }
  },
  { 
    path: 'privacidad', 
    loadComponent: () => import('./components/information-page/information-page.component').then(m => m.InformationPageComponent),
    data: { type: 'privacidad', title: 'Aviso de Privacidad' }
  },
  { path: 'mapa-sitio', loadComponent: () => import('./components/site-map/site-map.component').then(m => m.SiteMapComponent) },
  {
    path: 'debug-help-center',
    loadComponent: () => import('./components/admin/admin-help-center/admin-help-center.component').then(m => m.AdminHelpCenterComponent)
  },
  
  // Nueva arquitectura: /dashboard con rutas anidadas
  { 
    path: 'dashboard', 
    loadComponent: () => import('./components/profile-layout/profile-layout.component').then(m => m.ProfileLayoutComponent),
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'seguridad', pathMatch: 'full' },
      { path: 'seguridad', loadComponent: () => import('./components/profile-security/profile-security.component').then(m => m.ProfileSecurityComponent) }
      // TODO: Agregar más rutas anidadas cuando se creen los componentes
    ]
  },
  // Rutas de navegación temporal (placeholder)
  { path: 'catalog', component: HomeComponent }, // Temporal redirect
  { path: 'services', component: HomeComponent }, // Temporal redirect
  { path: 'product-details', component: HomeComponent }, // Temporal redirect
  // Ruta para detalle de producto
  { path: 'producto/:id', loadComponent: () => import('./components/product-detail/product-detail.component').then(m => m.ProductDetailComponent) },
  {
    path: 'carrito',
    loadComponent: () =>
      import('./components/cart/cart.component').then(m => m.CartComponent),
    canActivate: [AuthGuard]
  },
  // FASE 2 — Wishlist / Favoritos
  {
    path: 'wishlist',
    loadComponent: () => import('./components/wishlist/wishlist.component').then(m => m.WishlistComponent),
    canActivate: [AuthGuard]
  },
  // FASE 4 — Checkout y Pedidos del Cliente
  {
    path: 'checkout',
    loadComponent: () => import('./components/checkout/checkout.component').then(m => m.CheckoutComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'orders/my',
    loadComponent: () => import('./components/order-list/order-list.component').then(m => m.OrderListComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'orders/my/:id',
    loadComponent: () => import('./components/order-detail/order-detail.component').then(m => m.OrderDetailComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'google-auth-setup',
    loadComponent: () =>
      import('./google-auth-setup/google-auth-setup.component').then(m => m.GoogleAuthSetupComponent)
  },
  
  // FASE 7B — Retorno UX de Mercado Pago
  {
    path: 'payment/mercado-pago/success',
    loadComponent: () => import('./components/mercado-pago-return/mercado-pago-return.component').then(m => m.MercadoPagoReturnComponent)
  },
  {
    path: 'payment/mercado-pago/failure',
    loadComponent: () => import('./components/mercado-pago-return/mercado-pago-return.component').then(m => m.MercadoPagoReturnComponent)
  },
  {
    path: 'payment/mercado-pago/pending',
    loadComponent: () => import('./components/mercado-pago-return/mercado-pago-return.component').then(m => m.MercadoPagoReturnComponent)
  },
  
  // Rutas de Administración (protegidas con AdminGuard)
  {
    path: 'admin',
    loadComponent: () => import('./components/admin/admin-layout/admin-layout.component').then(m => m.AdminLayoutComponent),
    canActivate: [AdminGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./components/admin/admin-dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent),
        canActivate: [PermissionGuard],
        data: { requiredPermission: 'DASHBOARD_VIEW' }
      },
      {
        path: 'brands',
        loadComponent: () => import('./components/admin/admin-brands/admin-brands.component').then(m => m.AdminBrandsComponent),
        canActivate: [PermissionGuard],
        data: { requiredPermission: 'BRAND_MANAGE' }
      },
      {
        path: 'categories',
        loadComponent: () => import('./components/admin/admin-categories/admin-categories.component').then(m => m.AdminCategoriesComponent),
        canActivate: [PermissionGuard],
        data: { requiredPermission: 'CATEGORY_MANAGE' }
      },
      {
        path: 'products',
        canActivate: [PermissionGuard],
        data: { requiredPermission: 'PRODUCT_READ' },
        loadComponent: () => import('./components/admin/admin-products/admin-products.component')
          .then(m => m.AdminProductsComponent)
      },
      {
        path: 'orders',
        canActivate: [PermissionGuard],
        data: { requiredPermission: 'ORDER_READ' },
        loadComponent: () => import('./components/admin/admin-orders/admin-orders.component')
          .then(m => m.AdminOrdersComponent)
      },
      {
        path: 'coupons',
        loadComponent: () => import('./components/admin/admin-coupons/admin-coupons.component').then(m => m.AdminCouponsComponent),
        canActivate: [PermissionGuard],
        data: { requiredPermission: 'PRODUCT_READ' }
      },
      {
        path: 'abandoned-carts',
        loadComponent: () => import('./components/admin/admin-abandoned-carts/admin-abandoned-carts.component').then(m => m.AdminAbandonedCartsComponent),
        canActivate: [PermissionGuard],
        data: { requiredPermission: 'ORDER_READ' }
      },
      {
        path: 'staff',
        loadComponent: () => import('./components/admin/admin-staff/admin-staff.component').then(m => m.AdminStaffComponent),
        canActivate: [AdminGuard, PermissionGuard],
        data: { requiredPermission: 'USER_READ' }
      },
      {
        path: 'roles',
        loadComponent: () => import('./components/admin/admin-roles/admin-roles.component').then(m => m.AdminRolesComponent),
        canActivate: [PermissionGuard],
        data: { requiredPermission: 'ROLE_READ' }
      },
      {
        path: 'backups',
        loadComponent: () => import('./components/admin/admin-backups/admin-backups.component').then(m => m.AdminBackupsComponent),
        canActivate: [PermissionGuard],
        data: { requiredPermission: 'DATABASE_BACKUP' }
      },
      {
        path: 'gestion-db',
        loadComponent: () => import('./components/admin/admin-db-management/admin-db-management.component').then(m => m.AdminDbManagementComponent),
        canActivate: [PermissionGuard],
        data: { requiredPermission: 'DATABASE_VIEW' }
      },
      {
        path: 'customers',
        canActivate: [PermissionGuard],
        data: { requiredPermission: 'CUSTOMER_READ' },
        loadComponent: () => import('./components/admin/admin-customers/admin-customers.component')
          .then(m => m.AdminCustomersComponent)
      },
      {
        path: 'payment-settings',
        loadComponent: () => import('./components/admin/admin-payment-settings/admin-payment-settings.component').then(m => m.AdminPaymentSettingsComponent),
        canActivate: [PermissionGuard],
        data: { requiredPermission: ['SYSTEM_SETTINGS', 'BANK_TRANSFER_SETTINGS_READ', 'BANK_TRANSFER_SETTINGS_UPDATE', 'PAYMENT_SETTINGS_READ', 'PAYMENT_SETTINGS_UPDATE'] }
      },
      {
        path: 'analitica/patrones-compra',
        canActivate: [PermissionGuard],
        data: { requiredPermission: 'REPORT_VIEW' },
        loadComponent: () => import('./components/admin/admin-purchase-clustering/admin-purchase-clustering.component')
          .then(m => m.AdminPurchaseClusteringComponent)
      },
      {
        path: 'analitica/pronostico-demanda',
        canActivate: [PermissionGuard],
        data: { requiredPermission: 'REPORT_VIEW' },
        loadComponent: () => import('./components/admin/admin-demand-forecast/admin-demand-forecast.component')
          .then(m => m.AdminDemandForecastComponent)
      },
      {
        path: 'help-center',
        canActivate: [PermissionGuard],
        data: { requiredPermission: 'HELP_MANAGE' },
        loadComponent: () => import('./components/admin/admin-help-center/admin-help-center.component')
          .then(m => m.AdminHelpCenterComponent)
      }
    ]
  },
  
  // Páginas de error
  { path: 'not-found', loadComponent: () => import('./components/not-found/not-found.component').then(m => m.NotFoundComponent) },
  { path: 'server-error', loadComponent: () => import('./components/server-error/server-error.component').then(m => m.ServerErrorComponent) },
  
  // Wildcard - debe ser la última ruta
  { path: '**', loadComponent: () => import('./components/not-found/not-found.component').then(m => m.NotFoundComponent) }
];