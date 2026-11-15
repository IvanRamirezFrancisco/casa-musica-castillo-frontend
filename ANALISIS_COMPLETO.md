# 🎸 Casa de Música Castillo — Análisis Ejecutivo Completo
### Fecha: 12 de mayo de 2026 | Analista: Antigravity AI

---

# SECCIÓN 1 — ESTRUCTURA REAL DE CARPETAS Y ARCHIVOS

## Backend (`segundo proyecto/`)

```
segundo proyecto/
├── pom.xml                                          (funcional — Spring Boot 3, deps completas)
├── Dockerfile                                       (funcional)
├── railway.json                                     (funcional)
├── schemas.sql                                      (202 KB — dump SQL de referencia)
├── database_migrations/                             (directorio vacío — migraciones en src/main/resources)
├── src/main/resources/
│   ├── application.yml                              (209 líneas — config principal completa)
│   ├── application-local.yml                        (config local)
│   ├── application-production.yml                   (config producción)
│   ├── application-dev.yml                          (config dev)
│   ├── permissions-data.sql                         (datos de permisos ampliados)
│   ├── test-orders-data.sql                         (datos de prueba de órdenes)
│   ├── migration_fix_is_customer.sql                (fix manual — no es migración Flyway)
│   └── db/migration/
│       ├── V4__update_product_image_url_column.sql  (funcional)
│       ├── V5__fix_product_text_columns_postgres.sql
│       ├── V6__fix_text_columns_common_postgres.sql
│       ├── V7__seed_initial_data.sql                (886 líneas — roles, permisos, productos seed)
│       ├── V8__create_stored_procedures_postgres.sql (449 líneas — 10 SPs)
│       ├── V9__allow_null_category_for_draft_products.sql
│       ├── V10__cleanup_unused_indexes.sql
│       ├── V11__grant_pg_monitor_to_spring_app.sql
│       ├── V12__create_maintenance_tables.sql
│       ├── V13__fix_inventory_prediction_config.sql
│       ├── V14__add_execution_log_to_backup_logs.sql
│       ├── V15__create_system_automations.sql
│       ├── V16__create_automation_execution_logs.sql
│       ├── V17__remove_store_alert_config.sql
│       ├── V18__expand_permissions_granular.sql
│       ├── V19__cleanup_user_roles_consistency.sql
│       ├── V20__staff_invitations.sql
│       ├── V21__hash_staff_invitation_tokens.sql
│       ├── V22__add_account_cleanup_job.sql
│       └── V23__create_schemas_and_migrate_tables.sql (543 líneas — migración de schemas)
│
└── src/main/java/com/security/
    ├── AuthSystemApplication.java                   (funcional — entry point)
    ├── config/
    │   ├── SecurityConfig.java                      (223 líneas — funcional, CORS + filtro JWT)
    │   ├── AdvancedSecurityConfig.java              (funcional)
    │   ├── AppConfig.java                           (funcional)
    │   ├── AsyncConfig.java                         (funcional)
    │   ├── BrowserCompatibilityConfig.java          (funcional)
    │   ├── CacheConfig.java                         (funcional)
    │   ├── DatabaseBackupProperties.java            (funcional)
    │   ├── FileUploadConfig.java                    (funcional)
    │   ├── MailConfigDebug.java                     (funcional)
    │   ├── SchedulerConfig.java                     (funcional)
    │   ├── SupabaseProperties.java                  (funcional)
    │   └── WebMvcConfig.java                        (funcional)
    ├── controller/
    │   ├── AuthController.java                      (597 líneas — funcional)
    │   ├── AcceptInvitationController.java          (funcional)
    │   ├── AdminController.java                     (funcional — legacy, convive con /admin/*)
    │   ├── CategoryController.java                  (funcional — CRUD categorías admin)
    │   ├── CouponController.java                    (funcional — CRUD cupones)
    │   ├── FileUploadController.java                (funcional — Supabase Storage)
    │   ├── GlobalExceptionHandler.java              (funcional — manejo global errores)
    │   ├── PasswordResetController.java             (funcional)
    │   ├── ProductReviewController.java             (funcional)
    │   ├── PublicCategoryController.java            (funcional — público)
    │   ├── PublicProductController.java             (funcional — público)
    │   ├── SecureAuthController.java                (funcional — endpoints auth seguros)
    │   ├── SecurePasswordResetController.java       (funcional)
    │   ├── ShoppingCartController.java              (293 líneas — funcional)
    │   ├── TestController.java                      (⚠️ controller de pruebas en producción)
    │   ├── TwoFactorController.java                 (funcional — 2FA completo)
    │   ├── UserController.java                      (funcional)
    │   ├── WishlistController.java                  (funcional)
    │   ├── admin/
    │   │   ├── AdminAutomationController.java       (funcional)
    │   │   ├── AdminBackupController.java           (funcional)
    │   │   ├── AdminCustomerController.java         (funcional)
    │   │   ├── AdminDashboardController.java        (funcional)
    │   │   ├── AdminDbMaintenanceController.java    (funcional)
    │   │   ├── AdminDbMonitoringController.java     (funcional)
    │   │   ├── AdminInventoryPredictionController.java (funcional)
    │   │   ├── AdminOrderController.java            (433 líneas — funcional)
    │   │   ├── AdminProductController.java          (145 líneas — funcional)
    │   │   ├── AdminRoleController.java             (funcional)
    │   │   ├── AdminUserController.java             (258 líneas — funcional — gestiona Staff)
    │   │   ├── BrandController.java                 (funcional)
    │   │   ├── CsvController.java                   (funcional — import/export CSV)
    │   │   ├── SlowQueriesController.java           (funcional)
    │   │   ├── StaffInvitationController.java       (funcional)
    │   │   └── StockAlertsController.java           (funcional)
    │   └── test/
    │       └── (directorio — controllers de prueba)
    ├── dto/
    │   ├── BrandDTO.java, CartDTO.java, CouponDTO.java, OrderDTO.java
    │   ├── OrderItemDTO.java, ProductAttributeDTO.java, ProductDTO.java
    │   ├── ProductImageDTO.java, ReviewDTO.java, WishlistDTO.java
    │   ├── admin/                                   (45 DTOs admin)
    │   ├── public_api/                              (DTOs públicos)
    │   ├── request/                                 (8 request DTOs)
    │   └── response/                                (ApiResponse, CategoryDTO, JwtAuthResponse, UserResponse)
    ├── entity/                                      (36 entidades JPA — todas funcionales)
    ├── enums/                                       (OrderStatus, PaymentStatus, ShippingStatus, etc.)
    ├── exception/                                   (excepciones custom)
    ├── repository/                                  (37 repositorios JPA — todos funcionales)
    ├── security/                                    (JWT filter, UserPrincipal, CustomUserDetailsService)
    ├── service/                                     (47 servicios funcionales + admin/ + automation/)
    ├── util/                                        (utilidades)
    └── validation/                                  (validadores custom)
```

> ⚠️ **NOTA**: Las migraciones V1, V2, V3 no existen en disco — la secuencia inicia en V4. Esto implica que las tablas base fueron creadas por otra vía (posiblemente el `schemas.sql` que existe en raíz o por DDL manual). Flyway con `baseline-on-migrate: true` lo tolera pero es un riesgo de reproducibilidad.

---

## Frontend (`frontend/src/app/`)

```
frontend/src/app/
├── app.component.ts/.html/.css                      (funcional — shell básico)
├── app.config.ts                                    (funcional — HttpClient, Router configurados)
├── app.routes.ts                                    (206 líneas — funcional, con rutas comentadas)
├── auth.guard.ts                                    (funcional — redirige a /login)
├── google-auth.service.ts                           (626 bytes — ⚠️ stub mínimo)
├── guards/
│   ├── admin.guard.ts                               (57 líneas — funcional)
│   ├── auth.guard.ts                                (375 bytes — funcional, duplicado del raíz)
│   ├── guest.guard.ts                               (funcional — previene acceso a login si logueado)
│   ├── permission.guard.ts                          (funcional — verifica permisos granulares)
│   └── super-admin.guard.ts                         (funcional)
├── interceptors/                                    (interceptor JWT)
├── directives/                                      (directivas custom)
├── pipes/                                           (pipes custom)
├── validators/                                      (validadores de formulario)
├── models/
│   ├── admin.models.ts                              (funcional)
│   ├── api-response.model.ts                        (funcional)
│   ├── brand.model.ts                               (funcional)
│   ├── cart.model.ts                                (198 líneas — funcional)
│   ├── category.model.ts                            (funcional)
│   ├── customer.model.ts                            (funcional)
│   ├── order.model.ts                               (funcional)
│   ├── product.model.ts                             (funcional)
│   ├── review.model.ts                              (funcional)
│   ├── staff.model.ts                               (funcional)
│   ├── user.model.ts                                (48 líneas — funcional)
│   └── wishlist.model.ts                            (funcional)
├── services/
│   ├── auth.service.ts                              (767 líneas — funcional)
│   ├── cart.service.ts                              (315 líneas — funcional)
│   ├── shopping-cart.service.ts                     (235 líneas — 🔴 DUPLICADO de cart.service.ts)
│   ├── product.service.ts                           (30 KB — funcional)
│   ├── order.service.ts                             (funcional)
│   ├── wishlist.service.ts                          (funcional)
│   ├── coupon.service.ts                            (funcional)
│   ├── product-review.service.ts                    (funcional)
│   ├── customer.service.ts                          (funcional)
│   ├── staff.service.ts                             (funcional)
│   ├── search.service.ts                            (funcional)
│   ├── brand.service.ts                             (funcional)
│   ├── category.service.ts                          (funcional)
│   ├── admin-dashboard.service.ts                   (funcional)
│   ├── admin-product.service.ts                     (⚠️ posible duplicado con product.service)
│   ├── role.service.ts                              (funcional)
│   ├── backup-codes.service.ts                      (funcional)
│   ├── csv-import-export.service.ts                 (funcional)
│   ├── database-backup.service.ts                   (funcional)
│   ├── database-state.service.ts                    (funcional)
│   ├── db-maintenance.service.ts                    (funcional)
│   ├── db-monitoring.service.ts                     (funcional)
│   ├── file-upload.service.ts                       (funcional)
│   ├── inventory-prediction.service.ts              (944 bytes — ⚠️ muy pequeño, posible stub)
│   ├── password-reset.service.ts                    (funcional)
│   ├── public-api.service.ts                        (funcional)
│   ├── sanitization.service.ts                      (funcional)
│   ├── search.service.ts                            (funcional)
│   ├── slow-queries.service.ts                      (funcional)
│   ├── stock-alerts.service.ts                      (funcional)
│   ├── system-automation.service.ts                 (funcional)
│   └── validation.service.ts                        (funcional)
├── components/
│   ├── home/                                        ✅ funcional
│   ├── login/                                       ✅ funcional
│   ├── register/
│   │   ├── register.component.ts                    ✅ funcional
│   │   └── register-debug.component.ts              ⚠️ componente debug expuesto en rutas
│   ├── forgot-password/                             ✅ funcional
│   ├── reset-password/                              ✅ funcional
│   ├── verify-account/                              ✅ funcional
│   ├── accept-invitation/                           ✅ funcional
│   ├── catalogo/                                    ✅ funcional
│   ├── product-detail/                              ✅ funcional
│   ├── product-card/                                ✅ funcional
│   ├── product-catalog/                             ⚠️ existe pero ruta comentada en app.routes.ts
│   ├── cart/                                        ✅ funcional (usa cart.service.ts)
│   ├── profile-layout/                              ✅ funcional
│   ├── profile-security/                            ✅ funcional
│   ├── user-profile/                                ✅ funcional
│   ├── user-dashboard/                              ✅ funcional
│   ├── profile-dashboard/                           ⚠️ posible duplicado de user-dashboard
│   ├── security-profile/                            ⚠️ posible duplicado de profile-security
│   ├── search-results/                              ✅ funcional
│   ├── global-search/                               ✅ funcional
│   ├── footer/, main-footer/                        ⚠️ dos footers — posible duplicado
│   ├── header/, home-header/, main-header/,
│       navigation-header/, professional-header/,
│       header-loggedin/, navbar/                    ⚠️ 7 headers distintos — alta redundancia
│   ├── breadcrumbs/                                 ✅ funcional
│   ├── help-center/                                 ✅ funcional
│   ├── site-map/                                    ✅ funcional
│   ├── ofertas/                                     ⚠️ status desconocido — no tiene ruta en app.routes.ts
│   ├── not-found/                                   ✅ funcional
│   ├── server-error/                                ✅ funcional
│   ├── google-auth-setup/                           ✅ funcional
│   ├── dashboard/                                   ⚠️ nombre ambiguo — posible legacy
│   └── admin/
│       ├── admin-layout/                            ✅ funcional
│       ├── admin-dashboard/                         ✅ funcional
│       ├── admin-products/                          ✅ funcional
│       ├── admin-orders/                            ✅ funcional
│       ├── admin-customers/                         ✅ funcional
│       ├── admin-brands/                            ✅ funcional
│       ├── admin-categories/                        ✅ funcional
│       ├── admin-coupons/                           ✅ funcional
│       ├── admin-abandoned-carts/                   ✅ funcional
│       ├── admin-staff/                             ✅ funcional
│       ├── admin-roles/                             ✅ funcional
│       ├── admin-backups/                           ✅ funcional
│       ├── admin-db-management/                     ✅ funcional
│       ├── admin-reviews/                           ⚠️ existe pero NO tiene ruta en app.routes.ts
│       ├── admin-inventory-prediction/              ⚠️ existe pero NO tiene ruta en app.routes.ts
│       ├── csv-import-export/                       ✅ funcional (ruta implícita desde admin)
│       └── order-detail-modal/                      ✅ funcional
```

---

# SECCIÓN 2 — INVENTARIO DE MÓDULOS Y FUNCIONALIDADES

## 1. Autenticación y Autorización
**Estado: ✅ Completo (el módulo más robusto del sistema)**

- **Login**: POST `/api/auth/login` — verifica credenciales, aplica bloqueo por fuerza bruta (5 intentos / 15 min), maneja 2FA. Funcional.
- **Register**: POST `/api/auth/register` con `@Valid`, envío de email de verificación. Funcional.
- **JWT**: Stateless, 15 min de expiración, almacenado en `localStorage`. Refresh token existe en BD pero el frontend NO lo usa automáticamente.
- **2FA**: Google Authenticator (TOTP), Email OTP, Backup Codes — los 3 métodos implementados en `TwoFactorController`.
- **Verificación de email**: GET `/api/auth/verify` (redirect) + POST `/api/auth/verify-email`. Funcional.
- **Roles**: ROLE_USER, ROLE_ADMIN, ROLE_SUPER_ADMIN — en BD y en Spring Security.
- **RBAC granular**: 28+ permisos por categoría (USER_*, PRODUCT_*, ORDER_*, ROLE_*, etc.).
- **Sesiones concurrentes**: Límite de 3 sesiones simultáneas gestionado por `SessionManagementService`.
- **Logout**: POST `/api/auth/logout` (sesión individual) + POST `/api/auth/logout-all`. Funcional.

**Qué está incompleto:**
- El `refresh token` en backend existe pero el **frontend nunca llama a POST `/api/auth/refresh`** — cuando el JWT de 15 min expira, el usuario es deslogueado abruptamente sin intento de renovación automática.
- `google-auth.service.ts` en el frontend es un stub de 626 bytes casi vacío.

---

## 2. Catálogo de Productos
**Estado: ✅ Completo (frontend + backend + BD)**

- **Backend público**: `PublicProductController` en `/api/public/products` — listado paginado, detalle, búsqueda, filtros por categoría/marca/precio/rating.
- **Backend admin**: `AdminProductController` en `/api/admin/products` — CRUD completo (crear, leer, actualizar, eliminar, toggle-status, exportar).
- **Frontend catálogo**: `CatalogoComponent` funcional con filtros, paginación, buscador.
- **Frontend detalle**: `ProductDetailComponent` funcional con galería de imágenes, atributos, reseñas.
- **Frontend admin**: `AdminProductsComponent` funcional con tabla paginada del lado servidor.
- **Imágenes**: Upload a Supabase Storage via `FileUploadController`.

**Qué está incompleto:**
- La ruta `/catalogo` tiene ruta directa, pero `/product-catalog` (componente distinto) está **comentada** en `app.routes.ts` — dos implementaciones paralelas del catálogo.
- `AdminProductController` no tiene whitelist de campos de `sortBy` (a diferencia de `AdminOrderController` que sí la tiene) — **riesgo de injection en JPQL**.

---

## 3. Carrito de Compras
**Estado: ⚠️ Parcial — Backend completo, Frontend con duplicación crítica**

- **Backend**: `ShoppingCartController` — 12 endpoints completos: GET/POST carrito, agregar/actualizar/eliminar items, aplicar/remover cupón, vaciar, validar, transferir sesión anónima, carrito anónimo.
- **Frontend**: **DOS servicios paralelos haciendo lo mismo**:
  - `cart.service.ts` (315 líneas) — servicio principal, lo usa `CartComponent`. Mapea la respuesta del backend, pero llama a `DELETE /api/cart/{cartId}` (con ID en URL) en `clearCart()` en lugar de `DELETE /api/cart` (endpoint correcto del backend).
  - `shopping-cart.service.ts` (235 líneas) — servicio alternativo más completo, llama a `POST /api/cart/{cartId}/checkout` que **no existe en el backend**.
- **El carrito anónimo** (para usuarios no logueados) está implementado en el backend pero el frontend simplemente redirige al login.

**Qué está incompleto:**
- `checkout()` en `shopping-cart.service.ts` llama a un endpoint inexistente.
- `getCartById()` llama a `GET /api/cart/{cartId}` que tampoco existe en el backend (el backend sólo tiene `GET /api/cart` derivado del JWT).
- `getAbandonedCarts()` llama a `GET /api/cart/abandoned` que no existe en `ShoppingCartController`.

---

## 4. Checkout y Pagos
**Estado: ❌ No implementado — El bloqueo más crítico del sistema**

- No existe `CheckoutController` en el backend.
- No existe `checkout.component` en el frontend (la ruta está **comentada** en `app.routes.ts`).
- El SP `sp_transfer_cart_to_order` existe en BD y funciona correctamente, pero nadie lo llama desde Java.
- No hay integración con ninguna pasarela de pago (Stripe, PayPal, Conekta, MercadoPago).
- El botón de "Proceder al checkout" en el carrito no tiene destino real.

---

## 5. Órdenes del Usuario
**Estado: ⚠️ Parcial — Backend completo, frontend de usuario ausente**

- **Backend admin**: `AdminOrderController` — GET lista paginada, GET por ID, GET por cliente, GET stats, PATCH status/payment-status/shipping-status, PATCH cancel, GET export CSV. Completamente funcional.
- **Frontend admin**: `AdminOrdersComponent` con `OrderDetailModalComponent`. Funcional.
- **Backend usuario**: `OrderService` tiene métodos para historial de órdenes del usuario (`getOrdersByUserId`).
- **Frontend usuario**: NO existe componente de historial de pedidos del cliente. La ruta `/pedidos` está **comentada** en `app.routes.ts`.

---

## 6. Cupones y Descuentos
**Estado: ⚠️ Parcial — Backend completo, frontend admin funcional, aplicación en checkout bloqueada**

- `CouponController` y `CouponService` — CRUD completo de cupones, validación, estadísticas.
- `AdminCouponsComponent` — UI funcional de gestión de cupones.
- El carrito soporta `POST /api/cart/coupon` para aplicar cupones.
- **Problema**: sin checkout implementado, los cupones nunca llegan a una orden real. El SP `sp_apply_coupon_to_order` existe pero no se invoca.
- La ruta `admin/coupons` usa `data: { requiredPermission: 'PRODUCT_READ' }` — **error de permiso**: debería ser un permiso de cupones, no de lectura de productos.

---

## 7. Lista de Deseos (Wishlist)
**Estado: ✅ Completo (funcional end-to-end)**

- `WishlistController` — GET wishlist del usuario, POST agregar, DELETE eliminar, POST mover al carrito, GET verificar si producto está en wishlist.
- `WishlistService` — 15 KB, lógica completa.
- `wishlist.service.ts` en frontend — métodos que consumen correctamente los endpoints.
- SP `sp_move_wishlist_to_cart` y `sp_check_wishlist_discounts` implementados.

---

## 8. Reseñas de Productos
**Estado: ⚠️ Parcial — Backend completo, panel admin sin ruta**

- `ProductReviewController` — CRUD de reseñas, moderación, votos de utilidad.
- `ProductReviewService` — 16 KB, lógica de moderación, cálculo de ratings via SP.
- `product-review.service.ts` en frontend — funcional.
- `ProductDetailComponent` muestra reseñas — funcional.
- `admin-reviews/` componente existe pero **NO tiene ruta** en `app.routes.ts` — el admin no puede moderar reseñas desde la UI.

---

## 9–13. Panel Administrativo (Dashboard, Productos, Órdenes, Usuarios, Cupones)
**Estado general: ✅ Completo**

- **Dashboard**: `AdminDashboardComponent` + `AdminDashboardController` — estadísticas de órdenes, productos top, métricas.
- **Productos**: CRUD completo con upload de imágenes.
- **Órdenes**: Gestión completa con estados de orden/pago/envío.
- **Staff**: `AdminUserController` en `/api/admin/staff` — CRUD staff, bloqueo/desbloqueo, export CSV.
- **Clientes**: `AdminCustomerController` en `/api/admin/customers` — lectura de clientes (is_customer=true).
- **Cupones**: CRUD completo via `AdminCouponsComponent`.
- **Roles**: `AdminRoleController` — CRUD de roles y asignación de permisos.
- **Brands/Categorías**: CRUD completo.

---

## 14. Direcciones del Usuario
**Estado: ⚠️ Parcial — BD y entidad JPA existen, no hay controller ni UI**

- Tabla `customer.addresses` existe con FKs correctas.
- Entidad `Address.java` existe con mapeo JPA.
- `AddressRepository.java` existe.
- **NO existe** `AddressController` — ningún endpoint en `/api/addresses`.
- **NO existe** componente de direcciones en el frontend.
- La ruta `/perfil` está comentada en `app.routes.ts`.

---

## 15. Configuración de Seguridad
**Estado: ⚠️ Parcial — Backend funcional, UI existe pero acceso limitado**

- `SecuritySettingsService` y tabla `security.security_settings` existen con 14 configuraciones.
- `profile-security/` y `security-profile/` — dos componentes de seguridad del perfil (posible duplicación).
- No hay endpoint admin para editar `security_settings` desde la UI.

---

## 16. Automatizaciones y Mantenimiento
**Estado: ✅ Completo (módulo más avanzado del panel admin)**

- `AdminAutomationController`, `AdminBackupController`, `AdminDbMaintenanceController`, `AdminDbMonitoringController`.
- `DatabaseMaintenanceService` (33 KB), `DatabaseMonitoringService` (41 KB), `DatabaseBackupService` (33 KB).
- Sistema de automatizaciones con cron configurable en BD (`system_automations`).
- Backups a Supabase Storage implementados.
- Monitoreo de queries lentas, bloqueos, índices, métricas.

---

## 17. Notificaciones
**Estado: ⚠️ Parcial — Solo notificaciones in-app frontend, sin push/email proactivo**

- `NotificationCenterService` en el core del frontend — notificaciones en-app.
- Emails transaccionales implementados via Brevo SMTP: verificación, reset de contraseña, 2FA.
- **NO existe** servicio de notificaciones push, WebSocket o polling.
- Las notificaciones de wishlist (stock, descuento) están en SPs pero sin trigger de email al usuario.

---
# SECCIÓN 3 — INVENTARIO COMPLETO DE ENDPOINTS (BACKEND)

## AuthController — `/api/auth`
```
MÉTODO    RUTA                                    SEGURIDAD                ESTADO
GET       /api/auth/me                            Bearer token (manual)    ✅ funcional
POST      /api/auth/register                      públic (@Valid)           ✅ funcional
POST      /api/auth/login                         público (@Valid)          ✅ funcional
POST      /api/auth/refresh                       Bearer token (manual)    ✅ backend OK / ❌ frontend no llama
POST      /api/auth/verify-email                  público (@Valid)          ✅ funcional
GET       /api/auth/verify                        público (?token=)        ✅ funcional (redirect)
POST      /api/auth/resend-verification           público (@Valid)          ✅ funcional
GET       /api/auth/check-username/{username}     público                  ✅ funcional
POST      /api/auth/logout                        .authenticated()         ✅ funcional
POST      /api/auth/logout-all                    .authenticated()         ✅ funcional
GET       /api/auth/sessions                      .authenticated()         ✅ funcional
DELETE    /api/auth/sessions/{sessionId}          .authenticated()         ✅ funcional
```

## TwoFactorController — `/api/2fa`
```
MÉTODO    RUTA                                    SEGURIDAD                ESTADO
POST      /api/2fa/verify                         público (login flow)     ✅ funcional
POST      /api/2fa/send-login-code                público (login flow)     ✅ funcional
GET       /api/2fa/status                         .authenticated()         ✅ funcional
GET       /api/2fa/methods                        .authenticated()         ✅ funcional
POST      /api/2fa/google/enable                  .authenticated()         ✅ funcional
GET       /api/2fa/google/qrcode                  .authenticated()         ✅ funcional
POST      /api/2fa/google/confirm                 .authenticated()         ✅ funcional
POST      /api/2fa/disable/{method}               .authenticated()         ✅ funcional
POST      /api/2fa/email/enable                   .authenticated()         ✅ funcional
POST      /api/2fa/backup-codes/generate          .authenticated()         ✅ funcional
POST      /api/2fa/backup-codes/verify            .authenticated()         ✅ funcional
GET       /api/2fa/backup-codes/status            .authenticated()         ✅ funcional
POST      /api/2fa/backup-codes/disable           .authenticated()         ✅ funcional
```

## ShoppingCartController — `/api/cart`
```
MÉTODO    RUTA                                    SEGURIDAD                ESTADO
GET       /api/cart                               isAuthenticated()        ✅ funcional
POST      /api/cart                               isAuthenticated()        ✅ funcional
GET       /api/cart/summary                       isAuthenticated()        ✅ funcional
POST      /api/cart/items                         isAuthenticated()        ✅ funcional
PUT       /api/cart/items/{itemId}                isAuthenticated()        ✅ funcional
DELETE    /api/cart/items/{itemId}                isAuthenticated()        ✅ funcional
POST      /api/cart/coupon                        isAuthenticated()        ✅ funcional
DELETE    /api/cart/coupon                        isAuthenticated()        ✅ funcional
DELETE    /api/cart                               isAuthenticated()        ✅ funcional
GET       /api/cart/validate                      isAuthenticated()        ✅ funcional
POST      /api/cart/transfer                      isAuthenticated()        ✅ funcional
GET       /api/cart/session/{sessionId}           público                  ✅ funcional
POST      /api/cart/anonymous                     público                  ✅ funcional
```

> ❌ NO EXISTEN en backend: `GET /api/cart/{cartId}`, `POST /api/cart/{cartId}/checkout`, `GET /api/cart/abandoned` — pero el frontend los llama.

## AdminProductController — `/api/admin/products`
```
MÉTODO    RUTA                                    SEGURIDAD                        ESTADO
GET       /api/admin/products                     PRODUCT_READ                     ✅ funcional
GET       /api/admin/products/all                 PRODUCT_READ                     ✅ funcional
GET       /api/admin/products/{id}                PRODUCT_READ                     ✅ funcional
POST      /api/admin/products                     PRODUCT_CREATE                   ✅ funcional
PUT       /api/admin/products/{id}                PRODUCT_UPDATE                   ✅ funcional
DELETE    /api/admin/products/{id}                PRODUCT_DELETE                   ✅ funcional
PATCH     /api/admin/products/{id}/toggle-status  PRODUCT_UPDATE                   ✅ funcional
GET       /api/admin/products/search              PRODUCT_READ                     ✅ funcional
GET       /api/admin/products/count               PRODUCT_READ                     ✅ funcional
```

## AdminOrderController — `/api/admin/orders`
```
MÉTODO    RUTA                                        SEGURIDAD       ESTADO
GET       /api/admin/orders                           ORDER_READ      ✅ funcional
GET       /api/admin/orders/{id}                      ORDER_READ      ✅ funcional
GET       /api/admin/orders/customer/{userId}         ORDER_READ      ✅ funcional
GET       /api/admin/orders/stats                     ORDER_READ      ✅ funcional
PATCH     /api/admin/orders/{id}/status               ORDER_READ      ⚠️ debería ser ORDER_UPDATE
PATCH     /api/admin/orders/{id}/payment-status       ORDER_READ      ⚠️ debería ser ORDER_UPDATE
PATCH     /api/admin/orders/{id}/shipping-status      ORDER_READ      ⚠️ debería ser ORDER_UPDATE
PATCH     /api/admin/orders/{id}/cancel               ORDER_READ      ⚠️ debería ser ORDER_UPDATE
GET       /api/admin/orders/export/csv                ORDER_READ      ✅ funcional
```
> 🔴 CRÍTICO: Las operaciones PATCH (mutación de estado de órdenes) están protegidas con `ORDER_READ` a nivel de clase. Solo necesitas permiso de lectura para cambiar estados.

## AdminUserController — `/api/admin/staff`
```
MÉTODO    RUTA                                            SEGURIDAD        ESTADO
GET       /api/admin/staff/check-email                    USER_CREATE      ✅ funcional
GET       /api/admin/staff                                USER_READ        ✅ funcional
GET       /api/admin/staff/search                         USER_READ        ✅ funcional
GET       /api/admin/staff/{id}                           USER_READ        ✅ funcional
POST      /api/admin/staff                                USER_CREATE      ✅ funcional
PUT       /api/admin/staff/{id}                           USER_UPDATE      ✅ funcional
PATCH     /api/admin/staff/{id}/toggle-enabled            USER_UPDATE      ✅ funcional
PATCH     /api/admin/staff/{id}/toggle-locked             USER_UPDATE      ✅ funcional
DELETE    /api/admin/staff/{id}                           USER_DELETE      ✅ funcional
PATCH     /api/admin/staff/{id}/reset-failed-attempts     USER_UPDATE      ✅ funcional
PATCH     /api/admin/staff/{id}/reset-recovery-block      USER_UPDATE      ✅ funcional
GET       /api/admin/staff/export/csv                     REPORT_EXPORT    ✅ funcional
```

## PublicProductController — `/api/public/products`
```
MÉTODO    RUTA                                        SEGURIDAD    ESTADO
GET       /api/public/products                        público      ✅ funcional
GET       /api/public/products/{id}                   público      ✅ funcional
GET       /api/public/products/featured               público      ✅ funcional
GET       /api/public/products/search                 público      ✅ funcional
```

## PublicCategoryController — `/api/public/categories`
```
MÉTODO    RUTA                                        SEGURIDAD    ESTADO
GET       /api/public/categories                      público      ✅ funcional
GET       /api/public/categories/{id}                 público      ✅ funcional
```

## WishlistController — `/api/wishlist`
```
MÉTODO    RUTA                                        SEGURIDAD          ESTADO
GET       /api/wishlist                               isAuthenticated()  ✅ funcional
POST      /api/wishlist/{productId}                   isAuthenticated()  ✅ funcional
DELETE    /api/wishlist/{productId}                   isAuthenticated()  ✅ funcional
GET       /api/wishlist/{productId}/check             isAuthenticated()  ✅ funcional
POST      /api/wishlist/{id}/move-to-cart             isAuthenticated()  ✅ funcional
```

## ProductReviewController — `/api/reviews`
```
MÉTODO    RUTA                                            SEGURIDAD                    ESTADO
GET       /api/reviews/product/{productId}                público                      ✅ funcional
POST      /api/reviews/product/{productId}                isAuthenticated()            ✅ funcional
PUT       /api/reviews/{reviewId}                         isAuthenticated()            ✅ funcional
DELETE    /api/reviews/{reviewId}                         isAuthenticated()            ✅ funcional
POST      /api/reviews/{reviewId}/helpfulness             isAuthenticated()            ✅ funcional
GET       /api/reviews/admin                              PRODUCT_UPDATE               ✅ funcional
PATCH     /api/reviews/admin/{reviewId}/approve           PRODUCT_UPDATE               ✅ funcional
PATCH     /api/reviews/admin/{reviewId}/reject            PRODUCT_UPDATE               ✅ funcional
```

## CouponController — `/api/coupons`
```
MÉTODO    RUTA                                        SEGURIDAD            ESTADO
GET       /api/coupons                                PRODUCT_READ         ✅ funcional
POST      /api/coupons                                PRODUCT_CREATE       ✅ funcional
GET       /api/coupons/{id}                           PRODUCT_READ         ✅ funcional
PUT       /api/coupons/{id}                           PRODUCT_UPDATE       ✅ funcional
DELETE    /api/coupons/{id}                           PRODUCT_DELETE       ✅ funcional
GET       /api/coupons/validate/{code}                isAuthenticated()    ✅ funcional
GET       /api/coupons/stats                          PRODUCT_READ         ✅ funcional
```
> ⚠️ Cupones protegidos con permisos de PRODUCT en lugar de permisos propios de COUPON.

## Otros Controllers (resumen)
```
CONTROLLER               BASE PATH                     ESTADO
CategoryController       /api/admin/categories         ✅ CRUD completo, CATEGORY_MANAGE
BrandController          /api/admin/brands             ✅ CRUD completo, BRAND_MANAGE
AdminCustomerController  /api/admin/customers          ✅ lectura + acciones, CUSTOMER_READ
AdminRoleController      /api/admin/roles              ✅ CRUD + permisos, ROLE_READ/CREATE/etc.
AdminDashboardController /api/admin/dashboard          ✅ métricas, DASHBOARD_VIEW
AdminBackupController    /api/admin/backup             ✅ DATABASE_BACKUP
AdminDbMaintenanceController /api/admin/db/maintenance ✅ DATABASE_MAINTAIN
AdminDbMonitoringController  /api/admin/db/monitoring  ✅ DATABASE_VIEW
AdminAutomationController    /api/admin/automations    ✅ DATABASE_AUTOMATE
AdminInventoryPredictionController /api/admin/inventory-prediction ✅ funcional
SlowQueriesController    /api/admin/slow-queries       ✅ funcional
StockAlertsController    /api/admin/stock-alerts       ✅ funcional
CsvController            /api/admin/csv                ✅ import/export
StaffInvitationController /api/admin/staff-invitations ✅ funcional
AcceptInvitationController /api/auth/accept-invitation ✅ público
PasswordResetController  /api/auth/password-reset      ✅ funcional
SecurePasswordResetController /api/secure/password-reset ✅ funcional (versión mejorada)
UserController           /api/users                    ✅ perfil, cambio password
FileUploadController     /api/upload                   ✅ Supabase Storage
TestController           /api/test                     ⚠️ endpoints de prueba en producción
```

---

# SECCIÓN 4 — INVENTARIO COMPLETO DE SERVICIOS (FRONTEND)

## auth.service.ts (767 líneas)
| Método | Endpoint | Real/Simulado |
|--------|----------|---------------|
| `login()` | POST `/api/auth/login` | ✅ Real |
| `register()` | POST `/api/auth/register` | ✅ Real |
| `logout()` | Solo localStorage — NO llama backend | ⚠️ No invalida sesión en BD |
| `getCurrentUserFromBackend()` | GET `/api/users/profile` | ✅ Real |
| `verifyTwoFactor()` | POST `/api/2fa/verify` | ✅ Real |
| `sendTwoFactorCode()` | POST `/api/2fa/send-login-code` | ✅ Real |
| `disableSpecificTwoFactor()` | POST `/api/2fa/disable/{method}` | ✅ Real |
| `getAvailableTwoFactorMethods()` | GET `/api/2fa/methods` | ✅ Real |
| `generateBackupCodes()` | POST `/api/2fa/backup-codes/generate` | ✅ Real |
| `getBackupCodesStatus()` | GET `/api/2fa/backup-codes/status` | ✅ Real |
| `verifyBackupCode()` | POST `/api/2fa/backup-codes/verify` | ✅ Real |
| `verifyEmail()` | POST `/api/auth/verify-email` | ✅ Real |
| `isAuthenticated()` | Solo JWT decode local | ⚠️ No verifica con backend |
| `hasPermission()` | Solo localStorage/JWT | ✅ Correcto para frontend |
| — | POST `/api/auth/refresh` | ❌ Nunca se llama — no hay auto-refresh |

## cart.service.ts (315 líneas) — SERVICIO PRINCIPAL ACTIVO
| Método | Endpoint llamado | Real/Simulado |
|--------|---------|---------------|
| `loadCart()` | GET `/api/cart` | ✅ Real |
| `addToCart()` | POST `/api/cart/{cartId}/items` | ⚠️ URL incorrecta — debería ser POST `/api/cart/items` |
| `removeFromCart()` | DELETE `/api/cart/items/{itemId}` | ✅ Real |
| `updateQuantity()` | PUT `/api/cart/items/{itemId}` | ✅ Real |
| `clearCart()` | DELETE `/api/cart/{cartId}` | ⚠️ URL incorrecta — debería ser DELETE `/api/cart` |

## shopping-cart.service.ts (235 líneas) — SERVICIO DUPLICADO NO ACTIVO
| Método | Endpoint llamado | Real/Simulado |
|--------|----------|---------------|
| `getCart()` | GET `/api/cart` | ✅ Real |
| `addToCart()` | POST `/api/cart/items` | ✅ Real (URL correcta) |
| `updateCartItem()` | PUT `/api/cart/items/{itemId}` | ✅ Real |
| `removeCartItem()` | DELETE `/api/cart/items/{itemId}` | ✅ Real |
| `clearCart()` | DELETE `/api/cart` | ✅ Real (URL correcta) |
| `applyCoupon()` | POST `/api/cart/coupon` | ✅ Real |
| `removeCoupon()` | DELETE `/api/cart/coupon` | ✅ Real |
| `validateCart()` | GET `/api/cart/validate` | ✅ Real |
| `transferCart()` | POST `/api/cart/transfer` | ✅ Real |
| `getAbandonedCarts()` | GET `/api/cart/abandoned` | ❌ Endpoint no existe en backend |
| `checkout()` | POST `/api/cart/{cartId}/checkout` | ❌ Endpoint no existe en backend |

> 🔴 CRÍTICO: Hay DOS CartServices. `cart.service.ts` tiene URLs incorrectas. `shopping-cart.service.ts` tiene las URLs correctas pero llama endpoints inexistentes. El `CartComponent` usa `cart.service.ts` (el incorrecto).

## product.service.ts (30 KB — el más grande)
Consume `/api/public/products` y `/api/admin/products`. Funcional para catálogo público y admin.

## admin-product.service.ts (1.9 KB)
⚠️ Servicio admin separado que también llama `/api/admin/products` — duplica parcialmente `product.service.ts` para contexto admin.

## order.service.ts
Consume `/api/admin/orders`. Funcional para panel admin. Sin métodos para órdenes del usuario final.

## wishlist.service.ts (9 KB)
Consume `/api/wishlist`. Funcional. Métodos: `getWishlist`, `addToWishlist`, `removeFromWishlist`, `isInWishlist`, `moveToCart`.

## coupon.service.ts (7 KB)
Consume `/api/coupons`. Funcional para admin. Incluye `validateCoupon` y `getStats`.

## product-review.service.ts (8 KB)
Consume `/api/reviews`. Funcional. Métodos: `getReviews`, `createReview`, `updateReview`, `deleteReview`, `markHelpful`, métodos admin.

## staff.service.ts (12 KB)
Consume `/api/admin/staff`. Funcional. Métodos: `getAllStaff`, `getStaff`, `createStaff`, `updateStaff`, `deleteStaff`, invitaciones.

## customer.service.ts (5.6 KB)
Consume `/api/admin/customers`. Funcional para panel admin.

## search.service.ts (7.4 KB)
Consume `/api/public/products/search`. Funcional. Implementa búsqueda con debounce.

## database-backup.service.ts, db-maintenance.service.ts, db-monitoring.service.ts
Consumen `/api/admin/backup`, `/api/admin/db/*`. Funcionales para el panel de ops.

## inventory-prediction.service.ts (944 bytes)
⚠️ Muy pequeño — probablemente stub. Solo llama GET `/api/admin/inventory-prediction`.

## system-automation.service.ts (4.3 KB)
Consume `/api/admin/automations`. Funcional.

## public-api.service.ts (3.9 KB)
Consume endpoints públicos del catálogo. Funcional.

## sanitization.service.ts, validation.service.ts
Servicios de utilidad frontend — no consumen backend.

## google-auth.service.ts (626 bytes — raíz de app/)
⚠️ Stub casi vacío. No llama endpoints reales.
# SECCIONES 5-9: Seguridad, BD, Deuda Técnica, Consistencia y Resumen

## SECCIÓN 5 — ANÁLISIS DE SEGURIDAD

### JWT y Autenticación
- **Almacenamiento**: `localStorage` — 🔴 CRÍTICO. Vulnerable a XSS. Debería ser httpOnly cookie.
- **Refresh token**: Existe en BD (`RefreshToken.java`, `RefreshTokenRepository`) y endpoint `POST /api/auth/refresh` funciona en backend, pero el frontend **nunca lo llama**. Cuando el JWT de 15 min expira, el usuario es deslogueado sin reintento.
- **Validación de expiración en guard**: `isAuthenticated()` en `auth.service.ts` decodifica el JWT localmente (`jwt.exp * 1000 < Date.now()`). Correcto pero depende de que el reloj local no esté manipulado.
- **`logout()`** en frontend solo borra `localStorage` — no llama `POST /api/auth/logout`, dejando la sesión activa en BD.

### Rutas protegidas (frontend)
| Ruta | Guard |
|------|-------|
| `/dashboard/**` | `AuthGuard` |
| `/carrito` | `AuthGuard` |
| `/admin/**` | `AdminGuard` + `PermissionGuard` |
| `/login`, `/register`, etc. | `guestGuard` (redirige si logueado) |
| `/catalogo`, `/producto/:id`, `/busqueda` | Sin guard (públicas) |
| `/checkout` | ❌ Ruta comentada — no existe |
| `/pedidos` | ❌ Ruta comentada — no existe |

### Roles y permisos en BD (V7 + V18)
**Roles**: ROLE_USER, ROLE_ADMIN, ROLE_SUPER_ADMIN

**Permisos granulares** (28 total):
USER_CREATE, USER_READ, USER_UPDATE, USER_DELETE, USER_MANAGE_ROLES,
ROLE_CREATE, ROLE_READ, ROLE_UPDATE, ROLE_DELETE,
PERMISSION_READ, PERMISSION_ASSIGN,
SYSTEM_SETTINGS,
PRODUCT_READ, PRODUCT_CREATE, PRODUCT_UPDATE, PRODUCT_DELETE,
ORDER_READ, ORDER_UPDATE (añadido en V18),
DASHBOARD_VIEW,
BRAND_MANAGE, CATEGORY_MANAGE,
CUSTOMER_READ, CUSTOMER_MANAGE,
DATABASE_VIEW, DATABASE_BACKUP, DATABASE_MAINTAIN, DATABASE_AUTOMATE,
REPORT_VIEW, REPORT_EXPORT

### 🔴 Inconsistencias de autorización críticas

1. **`AdminOrderController`** tiene `@PreAuthorize("hasAuthority('ORDER_READ')")` a nivel de clase. Todos los PATCH (cambiar estado, cancelar) heredan `ORDER_READ`. Un usuario con solo permiso de lectura puede mutar órdenes.

2. **`CouponController`** usa permisos `PRODUCT_*` en lugar de permisos de cupones propios.

3. **Ruta admin/coupons** en frontend: `data: { requiredPermission: 'PRODUCT_READ' }` — cualquier usuario con lectura de productos accede al módulo de cupones.

4. **`TestController`** expuesto con endpoints `/api/test/public` y `/api/test/health` en producción.

5. **`register-debug.component`** tiene ruta activa en producción: `/register-debug`.

### Endpoints públicos sin autenticación (completo)
```
OPTIONS /**                   (CORS preflight — correcto)
/api/public/**                (catálogo público — correcto)
/api/auth/**                  (auth flow — correcto pero amplio)
/api/2fa/verify               (correcto — login flow)
/api/2fa/send-login-code      (correcto — login flow)
/api/test/public              (⚠️ expuesto en producción)
/api/test/health              (⚠️ expuesto)
/actuator/health              (correcto)
/uploads/**                   (archivos estáticos — correcto)
/swagger-ui/**                (⚠️ Swagger UI público en producción)
/v3/api-docs/**               (⚠️ API docs públicos)
/h2-console/**                (🔴 h2-console público — aunque no hay H2 en prod, riesgo si cambia)
/error                        (correcto)
```

### CORS
- `allowedOriginPatterns`: localhost:4200, localhost:4300, netlify URLs, railway URL.
- `allowCredentials: true` — correcto con patterns (no wildcard).
- Métodos: GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD — completo.
- **Problema**: `application.yml` define `cors.allowed-origins` separado que no coincide con `SecurityConfig`.

### Validaciones de input
- `@Valid` se aplica en: `RegisterRequest`, `LoginRequest`, `CategoryRequest`, `ChangePasswordRequest`, `PasswordResetRequest`, `AdminUserCreateDTO`, `AdminUserUpdateDTO`. ✅
- **Falta `@Valid`** en varios endpoints PATCH que reciben `Map<String, String>` directamente (ej: `updateOrderStatus`).
- `AdminProductController` no tiene whitelist de `sortBy` — riesgo de JPQL injection.

### Manejo de errores
- `GlobalExceptionHandler.java` (19 KB) — existe y es completo. Cubre: `MethodArgumentNotValidException`, `ConstraintViolationException`, `EntityNotFoundException`, `AccessDeniedException`, `JwtException`, excepciones custom del dominio.
- `application.yml`: `include-message: never`, `include-stacktrace: never` — correcto.

---

## SECCIÓN 6 — ANÁLISIS DE BASE DE DATOS

### Schemas y tablas (post V23)

**Schema `auth`**:
- `users` — id, email, username, password (BCrypt), first_name, last_name, phone, enabled, is_customer, google_auth_enabled, email_enabled, backup_codes_enabled, failed_attempts, locked_until, total_orders, total_spent
- `roles` — id, name, description
- `permissions` — id, name, description, category
- `user_roles`, `role_permissions` — tablas de unión
- `active_sessions` — jti, user_id, ip, user_agent, expires_at
- `refresh_tokens` — token, user_id, expires_at
- `backup_codes`, `two_factor_tokens`, `verification_tokens`

**Schema `security`**:
- `login_attempts` — identifier (email o IP), attempt_count, locked_until
- `password_reset_tokens`, `password_recovery_attempts`
- `audit_logs` — log completo de acciones
- `security_settings` — configuraciones clave-valor
- `staff_invitations` — token (hasheado desde V21), email, role_id
- `countries` — catálogo de países

**Schema `catalog`**:
- `products` — sku, price, discount_price, stock, average_rating, review_count, 1-5_star_count (campos desnormalizados), brand_id, category_id
- `categories` — árbol via parent_id
- `brands`, `product_images`, `product_attributes`, `product_price_history`
- `product_reviews` — rating, status (PENDING/APPROVED/REJECTED), helpfulness_count
- `review_helpfulness`

**Schema `sales`**:
- `orders` — order_number, user_id, subtotal, tax, shipping, discount, total, status, payment_status, shipping_status, cancellation_reason, cancelled_at, tracking_number
- `order_items` — product_name y product_sku desnormalizados (correcto para histórico)
- `shopping_carts` — user_id, session_id, status (ACTIVE/ABANDONED/CONVERTED/EXPIRED)
- `cart_items`
- `coupons` — discount_type (PERCENTAGE/FIXED), valid_from, valid_until, usage_limit, times_used
- `coupon_usage`, `coupon_applicable_categories`, `coupon_applicable_products`
- `wishlists` — notified_back_in_stock, notified_discount (flags de notificación)

**Schema `customer`**: `addresses` — user_id, street, city, state, zip, country_id, is_default

**Schema `ops`**: `system_automations`, `automation_execution_logs`, `backup_logs`, `maintenance_config`, `maintenance_logs`, `inventory_prediction_config`

### Stored Procedures (definidos en V8, migrados a schemas en V23)

| Nombre SP | Schema | Parámetros | Función | Llamado desde |
|-----------|--------|------------|---------|---------------|
| `sp_calculate_coupon_discount` | sales | coupon_id, amount → discount | Calcula descuento | `StoredProcedureService` |
| `sp_apply_coupon_to_cart` | sales | cart_id, coupon_id | Aplica cupón a carrito | `StoredProcedureService` |
| `sp_apply_coupon_to_order` | sales | order_id, coupon_id | Aplica cupón a orden | `StoredProcedureService` |
| `sp_calculate_order_totals` | sales | order_id | Recalcula totales | `StoredProcedureService` |
| `sp_cancel_order` | sales | order_id, reason | Cancela + restaura stock | `StoredProcedureService` |
| `sp_generate_order_number` | sales | → order_number | Genera ORD-YYYYMMDD-NNNNN | `StoredProcedureService` |
| `sp_transfer_cart_to_order` | sales | cart_id → order_id | **Checkout** | ⚠️ Existe pero nadie lo llama |
| `sp_recalculate_product_rating` | catalog | product_id | Recalcula rating/estrellas | `ProductReviewService` |
| `sp_update_user_stats` | auth | user_id | Actualiza total_orders/spent | `StoredProcedureService` |
| `sp_check_wishlist_back_in_stock` | sales | user_id | Marca notificaciones stock | `StoredProcedureService` |
| `sp_check_wishlist_discounts` | sales | user_id | Marca notificaciones descuento | `StoredProcedureService` |
| `sp_move_wishlist_to_cart` | sales | wishlist_id | Mueve item de wishlist a carrito | `WishlistService` |
| `sp_get_wishlist_with_price_comparison` | sales | user_id | Placeholder — no hace nada real | `StoredProcedureService` |

### Problemas en BD

1. **Campos calculados que pueden desincronizarse**: `products.average_rating`, `review_count`, `*_star_count` son calculados por SP y también mantenidos por JPA. Si se insertan reseñas por fuera del SP, quedan inconsistentes.

2. **`brands.product_count`** — campo calculado en la tabla que el seed inicializa en 0. No hay trigger ni SP que lo mantenga actualizado.

3. **Migraciones V1, V2, V3 ausentes** — las tablas base no tienen migración Flyway documentada. El `schemas.sql` en raíz sugiere que se crearon manualmente.

4. **Tablas sin entidad JPA correspondiente**: `coupon_applicable_categories`, `coupon_applicable_products` — son tablas de unión manejadas directamente por la entidad `Coupon.java` via colecciones.

5. **`inventory_prediction_config`** en schema ops — tiene tabla y entidad pero el servicio `InventoryPredictionService` es simple (5.5 KB).

6. **`orders` no tiene FK a `addresses`** — no hay forma de saber a qué dirección se envió un pedido (dirección de entrega no persiste en la orden).

---

## SECCIÓN 7 — DEUDA TÉCNICA Y CÓDIGO MUERTO

### Rutas comentadas en app.routes.ts
```typescript
// /checkout       → CheckoutComponent (no existe)
// /perfil         → ProfileComponent (no existe)
// /pedidos        → OrdersComponent (no existe)
// /favoritos      → FavoritesComponent (no existe)
// /catalogo       → ProductCatalogComponent (existe el componente, no la ruta)
```

### Componentes existentes SIN ruta en app.routes.ts
- `admin-reviews/` — admin no puede moderar reseñas desde UI
- `admin-inventory-prediction/` — no tiene ruta
- `ofertas/` — no tiene ruta
- `dashboard/` (raíz de components) — nombre ambiguo, posible legacy

### Servicios duplicados
1. **`cart.service.ts` vs `shopping-cart.service.ts`** — dos implementaciones del mismo carrito. `cart.service.ts` tiene URLs incorrectas. `shopping-cart.service.ts` tiene la API correcta pero llama endpoints inexistentes.
2. **`product.service.ts` vs `admin-product.service.ts`** — solapamiento parcial en endpoints admin.
3. **`auth.guard.ts` en raíz** vs **`guards/auth.guard.ts`** — dos guards de auth, app.routes.ts importa el de la raíz.

### Componentes de header/footer duplicados (7 headers)
`header/`, `home-header/`, `main-header/`, `navigation-header/`, `professional-header/`, `header-loggedin/`, `navbar/` — alto nivel de fragmentación, difícil mantenimiento.

### Console.log en producción
- `AuthController.java` línea 174: `System.out.println("❌ Usuario no verificado: " + email)` — 🔴 filtra email en logs.
- `AuthController.java` línea 304: `System.out.println("✅ Email verificado exitosamente")`.
- `auth.service.ts`: múltiples `console.group` y `console.log` en `redirectAfterLogin()` y `debugPermissions()` — información sensible de roles en consola del navegador.
- `(window as any).debugPermissions` expuesto globalmente en producción (línea 124 auth.service.ts).

### TODO / FIXME detectados
- `app.routes.ts` línea 65: `// TODO: Agregar más rutas anidadas cuando se creen los componentes`
- `app.routes.ts` líneas 74-76: rutas placeholder que redirigen a `HomeComponent`

### register-debug.component
Tiene ruta activa `/register-debug` — componente de depuración expuesto en producción.

### TestController en producción
`/api/test/public` y `/api/test/health` accesibles públicamente.

---

## SECCIÓN 8 — CONSISTENCIA FRONTEND ↔ BACKEND

### User model
| Campo backend (UserResponse) | Frontend (user.model.ts) | Estado |
|------------------------------|--------------------------|--------|
| id | id: number | ✅ |
| firstName | firstName: string | ✅ |
| lastName | lastName: string | ✅ |
| email | email: string | ✅ |
| phone | phone?: string | ✅ |
| enabled | enabled: boolean | ✅ |
| emailVerified | emailVerified?: boolean | ✅ |
| twoFactorEnabled | twoFactorEnabled: boolean | ✅ |
| roles[] | roles: string[] | ✅ |
| permissions[] | permissions?: string[] | ✅ |
| isCustomer | isCustomer?: boolean | ✅ |
| googleAuthEnabled | googleAuthEnabled?: boolean | ✅ |
| emailEnabled | emailEnabled?: boolean | ✅ |
| backupCodesEnabled | backupCodesEnabled?: boolean | ✅ |
| username | — | ❌ Falta en frontend |
| totalOrders | — | ❌ Falta en frontend |
| totalSpent | — | ❌ Falta en frontend |

### Cart model
| Campo backend (CartDTO) | Frontend (cart.model.ts) | Estado |
|-------------------------|--------------------------|--------|
| cartId | id: number | ⚠️ Nombre distinto (cartId vs id) |
| items[].itemId | id: number | ⚠️ itemId vs id |
| items[].availableStock | availableStock: number | ✅ |
| tax / taxRate | tax: number | ✅ |
| discount | discount: number | ✅ |
| shippingCost | shippingCost: number | ✅ |
| itemCount | itemCount: number | ✅ (ShoppingCartDTO) / ❌ (CartResponse en cart.service) |

> El `CartResponse` definido internamente en `cart.service.ts` usa `totalItems` pero `ShoppingCartDTO` en `cart.model.ts` usa `itemCount`.

### Order model
| Campo backend (OrderDTO) | Frontend (order.model.ts) | Estado |
|--------------------------|---------------------------|--------|
| orderNumber | orderNumber: string | ✅ |
| status (OrderStatus enum) | status: string | ⚠️ Frontend no tiene enum OrderStatus |
| paymentStatus (PaymentStatus enum) | paymentStatus: string | ⚠️ Sin enum |
| shippingStatus (ShippingStatus enum) | shippingStatus: string | ⚠️ Sin enum |
| trackingNumber | trackingNumber?: string | ✅ |
| shippingAddress | — | ❌ Falta en frontend |

### Enums que no coinciden
- `DiscountType` backend: `PERCENTAGE`, `FIXED` — frontend `cart.model.ts`: `PERCENTAGE`, `FIXED`, `FREE_SHIPPING` (**FREE_SHIPPING no existe en backend**).
- `CartStatus` en frontend tiene `EXPIRED` — en backend `ShoppingCart` no tiene ese status definido en enum.

### DTOs admin sin modelo en Angular
- `AdminUserListDTO`, `AdminUserResponseDTO` — no tienen interfaces TypeScript correspondientes (se usa `any` o `staff.model.ts` parcialmente).
- `TopProductDTO`, `RecentOrderDTO` — DTOs del dashboard sin modelo formal en frontend.
- `InventoryPredictionDTO` — sin modelo en frontend.

---

## SECCIÓN 9 — RESUMEN EJECUTIVO FINAL

### Tabla de estado de módulos

| Módulo | Frontend | Backend | BD | Estado general | Prioridad |
|--------|----------|---------|-----|----------------|-----------|
| Autenticación / JWT | ✅ Completo | ✅ Completo | ✅ | ✅ Funcional | — |
| 2FA (Google/Email/Backup) | ✅ Completo | ✅ Completo | ✅ | ✅ Funcional | — |
| Catálogo de productos | ✅ Completo | ✅ Completo | ✅ | ✅ Funcional | — |
| Búsqueda / Filtros | ✅ Completo | ✅ Completo | ✅ | ✅ Funcional | — |
| Carrito de compras | ⚠️ Parcial (URLs rotas) | ✅ Completo | ✅ | ⚠️ Revisar | Alta |
| **Checkout / Pago** | ❌ No existe | ❌ No existe | ⚠️ SP listo | ❌ Crítico | 🔴 Crítica |
| **Órdenes (usuario)** | ❌ No existe | ✅ Completo | ✅ | ❌ Sin UI | 🔴 Crítica |
| Órdenes (admin) | ✅ Completo | ✅ Completo | ✅ | ✅ Funcional | — |
| Cupones / Descuentos | ✅ Completo | ✅ Completo | ✅ | ⚠️ Sin checkout | Alta |
| Wishlist | ✅ Completo | ✅ Completo | ✅ | ✅ Funcional | — |
| Reseñas (cliente) | ✅ Completo | ✅ Completo | ✅ | ✅ Funcional | — |
| Reseñas (moderación admin) | ❌ Sin ruta | ✅ Completo | ✅ | ⚠️ Sin acceso UI | Media |
| Panel Admin — Productos | ✅ Completo | ✅ Completo | ✅ | ✅ Funcional | — |
| Panel Admin — Órdenes | ✅ Completo | ✅ Completo | ✅ | ✅ Funcional | — |
| Panel Admin — Staff | ✅ Completo | ✅ Completo | ✅ | ✅ Funcional | — |
| Panel Admin — Clientes | ✅ Completo | ✅ Completo | ✅ | ✅ Funcional | — |
| Panel Admin — Cupones | ✅ Completo | ✅ Completo | ✅ | ✅ Funcional | — |
| Panel Admin — Roles | ✅ Completo | ✅ Completo | ✅ | ✅ Funcional | — |
| Panel Admin — Dashboard | ✅ Completo | ✅ Completo | ✅ | ✅ Funcional | — |
| Panel Admin — DB/Ops | ✅ Completo | ✅ Completo | ✅ | ✅ Funcional | — |
| **Direcciones usuario** | ❌ No existe | ❌ No existe | ✅ tabla/entidad | ❌ Sin controller | Alta |
| Perfil de usuario | ⚠️ Parcial | ✅ Completo | ✅ | ⚠️ Revisar | Media |
| Notificaciones | ⚠️ Solo in-app | ⚠️ Solo email tx. | ✅ flags wishlist | ⚠️ Limitado | Media |
| Auto-refresh JWT | ❌ No implementado | ✅ Endpoint listo | ✅ | ❌ UX rota | Alta |
| Invitaciones Staff | ✅ Completo | ✅ Completo | ✅ | ✅ Funcional | — |

---

### Párrafo Ejecutivo

**Completitud estimada del sistema: 55–60%**

El backend es robusto y profesional (80% completo). El panel de administración es funcional al 90%. La tienda pública (lo que ve el cliente) está al 35%: puede ver el catálogo y agregar al carrito, pero no puede comprar.

**Los 3 problemas más críticos que bloquean producción:**

1. **Checkout completamente ausente** — No existe endpoint de pago ni componente Angular. El SP `sp_transfer_cart_to_order` está listo en BD pero sin endpoint Java que lo llame. Sin esto, el sistema es un catálogo, no una tienda.

2. **Duplicación y URLs incorrectas en CartService** — `cart.service.ts` llama `POST /api/cart/{cartId}/items` y `DELETE /api/cart/{cartId}` que no existen en el backend. El servicio correcto (`shopping-cart.service.ts`) no está conectado a ningún componente. El carrito falla silenciosamente.

3. **Historial de pedidos del cliente inexistente** — No hay pantalla `/pedidos` ni componente. Un cliente que compra (cuando el checkout exista) no puede ver sus órdenes.

**Los 3 problemas de seguridad más urgentes:**

1. 🔴 **JWT en localStorage** — Toda la autenticación es vulnerable a XSS. Migrar a httpOnly cookies es trabajo de arquitectura significativo.

2. 🔴 **`AdminOrderController` con `ORDER_READ` para mutaciones** — Cualquier usuario con permiso de solo lectura puede cambiar estados de órdenes, cancelarlas y modificar pagos.

3. 🔴 **`(window as any).debugPermissions` expuesto globalmente** + `console.group` con roles/permisos del usuario en producción — información sensible de autorización visible en DevTools de cualquier sesión.

**Estimación de esfuerzo para llevar a producción:**

| Trabajo | Esfuerzo estimado |
|---------|-------------------|
| Checkout + integración pago | 3–4 semanas |
| Corrección CartsService (URLs + unificación) | 2–3 días |
| Historial de pedidos del cliente | 3–5 días |
| Direcciones de usuario (controller + UI) | 1 semana |
| Auto-refresh del JWT en frontend | 1–2 días |
| Corregir permiso ORDER_READ en mutaciones | 1 día |
| Exponer `admin-reviews` en rutas | 1 día |
| Limpiar código muerto (headers duplicados, debug) | 3–5 días |
| **Total estimado** | **6–8 semanas** |
