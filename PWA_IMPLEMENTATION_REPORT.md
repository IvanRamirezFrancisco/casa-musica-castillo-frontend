# PWA_IMPLEMENTATION_REPORT — Casa de Música Castillo (frontend)

Rama: `deploy/vercel-frontend` · Sin commit/push/reset/clean/restore/stash. `.agents/` no se tocó.

## 1. Estado inicial detectado
- Angular real: `@angular/core` / `common` / `router` / `service-worker` = **19.2.15**; `@angular/cli` 19.2.18; `@angular-devkit/build-angular` 19.2.18 (builder `application`).
- La implementación PWA local previa ya existía (SW, manifest, servicios, interceptor, iconos).
- Backend en otro origen: `environment.prod.ts → https://backend-production-1a27.up.railway.app/api`.
- `vercel.json`: rewrite `/(.*)` → `/index.html` (Vercel sirve primero los archivos estáticos existentes, por lo que `ngsw-worker.js`, `ngsw.json` y `manifest.webmanifest` no se ven afectados).

## 2. Problemas encontrados
| # | Problema | Gravedad |
|---|----------|----------|
| 1 | Los 8 iconos `icon-*.png` medían físicamente **512x512** (tamaños declarados falsos) | Alta |
| 2 | Manifest usaba `"purpose": "maskable any"` (desaconsejado) y no había iconos maskable reales | Media |
| 3 | `theme-color` en `index.html` era `#5A252C`, distinto del manifest (`#722F37`) | Baja |
| 4 | `offlineInterceptor` bloqueaba cualquier URL con `/api/` o `/auth/` (incluso GET) y abría un **modal por petición**; no distinguía el origen del backend | Media |
| 5 | `ConnectivityService` sin limpieza de listeners, toasts con colores fijos | Baja |
| 6 | `PwaUpdateService` recargaba sin `activateUpdate()`, sin guardas anti-bucle ni manejo de `unrecoverable` | Media |
| 7 | `serviceWorker` estaba en `options` de `angular.json` (también en build de desarrollo) | Baja |
| 8 | `ngsw-config`: `https://res.cloudinary.com/**` y `fonts.googleapis.com/**` dentro de `assetGroups` sin límite de tamaño ni expiración | Media |

## 3. Archivos modificados (en esta fase)
- `angular.json`: `serviceWorker: "ngsw-config.json"` movido a la configuración `production`.
- `ngsw-config.json`: reescrito (ver §6).
- `src/manifest.webmanifest`: reescrito (ver §7).
- `src/index.html`: `theme-color` → `#722F37`.
- `src/app/services/connectivity.service.ts`, `src/app/services/pwa-update.service.ts`, `src/app/interceptors/offline.interceptor.ts`: reescritos.
- `src/assets/icons/icon-*.png`: regenerados con el tamaño real.
- Modificados en la fase anterior y sin cambios ahora: `package.json`, `package-lock.json` (solo añade `@angular/service-worker@19.2.15`), `src/app/app.config.ts`, `src/app/app.component.ts`.

## 4. Archivos creados (en esta fase)
- `src/assets/icons/maskable-icon-192x192.png`, `maskable-icon-512x512.png`.
- (Fase anterior) `ngsw-config.json`, `src/manifest.webmanifest`, los 3 archivos TS PWA, iconos, este reporte.

## 5. Configuración final del Service Worker
`app.config.ts` → `provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode(), registrationStrategy: 'registerWhenStable:30000' })`.
- Solo habilitado en producción (`ng serve` no lo registra). `registerWhenStable:30000` es adecuado: registra cuando la app es estable o a los 30 s como máximo, sin competir con la carga inicial (protege Performance).
- Un solo provider; sin duplicados.
- Alcance `/`.

## 6. ngsw-config.json final
- **assetGroups**
  - `app-shell` (prefetch): `index.html`, `favicon.ico`, `manifest.webmanifest`, `/*.css`, `/*.js`.
  - `local-assets` (lazy, update prefetch): iconos PWA, `/assets/**` imágenes/SVG, fuentes y media locales.
  - `third-party-static` (lazy): Bootstrap CSS/JS (jsDelivr), Font Awesome 6.0.0 (cdnjs), Google Fonts (CSS + gstatic). Son recursos públicos y estáticos usados por `index.html`.
- **dataGroups** (único): `public-cloudinary-images` → `https://res.cloudinary.com/dy3ibnjl7/image/upload/**`; estrategia **performance**, `maxSize: 80`, `maxAge: 7d`, `timeout: 5s`. Justificación: imágenes públicas, anónimas e inmutables por URL (logo, imágenes de producto); mejora rendimiento y offline visual; limitado y con expiración.
- **API del backend: NO se agregó ningún dataGroup.** Decisión de seguridad: el backend es otro dominio (Railway), usa JWT y mezcla datos públicos y privados; no se pudo garantizar CORS/anonimato endpoint por endpoint. Angular SW deja pasar sin cachear toda petición que no coincida con un grupo (`/api/auth`, `/admin`, `/cart`, `/orders`, `/checkout`, `/payment(s)`, `/mercadopago`, `/users`, `/profile` y el resto).
- Verificado en `dist/.../ngsw.json`: 0 referencias a esas rutas.

## 7. Manifest final
| Campo | Valor |
|---|---|
| name | Casa de Música Castillo |
| short_name | Música Castillo |
| id | `/` |
| lang | es-MX |
| start_url / scope | `/` / `/` |
| display | standalone |
| theme_color | #722F37 |
| background_color | #5A252C (fondo del preloader/logo actual) |
| categories | shopping, music |
| icons | ver §8 (sin `screenshots` ficticias) |

## 8. Iconos — dimensiones físicas reales (verificadas con System.Drawing)
Fuente: logo oficial (el de Cloudinary usado en la app), reescalado con bicubic de alta calidad, relación 1:1 y logo centrado.

| Archivo | Declarado | Real | purpose |
|---|---|---|---|
| icon-72x72.png | 72x72 | 72x72 | any |
| icon-96x96.png | 96x96 | 96x96 | any |
| icon-128x128.png | 128x128 | 128x128 | any |
| icon-144x144.png | 144x144 | 144x144 | any |
| icon-152x152.png | 152x152 | 152x152 | any |
| icon-192x192.png | 192x192 | 192x192 | any |
| icon-384x384.png | 384x384 | 384x384 | any |
| icon-512x512.png | 512x512 | 512x512 | any |
| maskable-icon-192x192.png | 192x192 | 192x192 | maskable |
| maskable-icon-512x512.png | 512x512 | 512x512 | maskable |

Los maskable tienen el logo al 70 % sobre el fondo `#5A252C` (safe zone). Nota: la fuente disponible ya llevaba fondo sólido, por lo que los iconos `any` no tienen transparencia.

## 9. Estrategia de caché
App shell con prefetch (arranca offline), assets locales y CDNs estáticos lazy, imágenes públicas Cloudinary con performance + límite + expiración. Navegaciones → `index.html` (SPA).

## 10. Datos deliberadamente NO cacheados
JWT/Authorization (el SW nunca lo almacena; solo guarda lo que coincide con un grupo y ninguno es del backend), login, registro, recuperación, perfil, carrito, pedidos, checkout, pagos, Mercado Pago, transferencias, administración, y cualquier POST/PUT/PATCH/DELETE.

## 11. Funcionamiento offline
**Funciona:** carga y recarga del App Shell (header, navegación, estilos, logo, iconos, fuentes e imágenes ya visitadas), navegación entre rutas ya cargadas, aviso de conectividad.
**Requiere Internet:** catálogo/productos/categorías/marcas (datos del API), login, registro, recuperación, carrito, checkout, pedidos, pagos, perfil, administración, chunks lazy de rutas aún no visitadas.

## 12. ConnectivityService
Fuente única: `BehaviorSubject` + `signal` (`online`), inicializado con `navigator.onLine`, alimentado por un solo `merge(fromEvent online/offline)` con `distinctUntilChanged`, limpiado en `ngOnDestroy`. Toasts SweetAlert2 discretos: «Sin conexión. Algunas funciones no están disponibles.» / «Conexión restablecida.».

## 13. OfflineInterceptor
Solo actúa si no hay conexión **y** la URL pertenece al origen de `environment.apiUrl` (o `/api/` del mismo origen). Falla de inmediato con `HttpErrorResponse` status 0 y mensaje explicativo; para escrituras muestra un toast. No toca `Authorization`, no persiste nada, no afecta estáticos, CDNs ni al SW. Se registra primero en la cadena. Evita que login/registro/checkout/pagos parezcan completarse sin llegar al servidor.

## 14. PwaUpdateService
Solo si `swUpdate.isEnabled`. Escucha `VERSION_READY` → «Hay una nueva versión disponible.» con Actualizar / Más tarde; al confirmar: `activateUpdate()` y una única recarga (`reloading` flag). `unrecoverable` → una recarga. Sondeo cada 6 h tras estabilidad. Sin recargas automáticas ni bucles.

## 15. Seguridad
Sin secretos en manifest/SW/environments; sin `eval`, sin `bypassSecurityTrust*` nuevos; sin scripts externos nuevos; backend/CORS/auth/guards/pagos intactos; HTTPS sin cambios. Verificado en Cache Storage real: 101 entradas, **0** del backend (`/api/`, Railway, localhost:8080). (Existen usos previos de `innerHTML` en componentes del proyecto, no relacionados con PWA; no se tocaron.)

## 16. Build
`npm run build` → **exit 0**. Dependencia: `@angular/service-worker@19.2.15` instalado con `--legacy-peer-deps` en la fase anterior (conflicto ERESOLVE preexistente de peers); `npm ls` confirma versión alineada con `@angular/core@19.2.15`.

## 17. Artefactos en dist/frontend/browser
| Archivo | Existe | Tamaño/Dimensiones | Estado |
|---|---|---|---|
| ngsw-worker.js | Sí | 70 970 B | OK |
| ngsw.json | Sí | 13 029 B | OK |
| manifest.webmanifest | Sí | 1 495 B | OK |
| index.html | Sí | 21 981 B | OK |
| favicon.ico | Sí | 15 086 B | OK |
| assets/icons/icon-*.png (8) | Sí | 72…512 reales | OK |
| assets/icons/maskable-icon-{192,512}.png | Sí | 192 / 512 | OK |

## 18. Advertencias restantes (preexistentes, no PWA)
Presupuesto CSS de `admin-products.component.css` (87.09 kB > 80 kB); módulos CommonJS `sweetalert2`, `pdfjs-dist`, `zxcvbn`. `npm audit`: ver §21. Pendiente de validación manual: Lighthouse.

## 19. Pruebas ejecutadas (Chrome headless real vía puppeteer-core, build de producción en `http://localhost:8081`, servidor con fallback SPA)
- SW: `ngsw-worker.js` **activated**, scope `/`; página **controlada** por el SW.
- `Page.getInstallabilityErrors`: **[]** (instalable). `Page.getAppManifest` errores: **[]**.
- Cache Storage: 101 entradas; sin rutas privadas/backend.
- **Offline real**: tras `Network → Offline` y **recarga**, la app muestra header, navegación y contenido (sin preloader colgado). Errores de consola solo de recursos externos no cacheados (timeouts/504 al estar sin red).
- Lighthouse: **no ejecutado** (no se inventan cifras). Previos: Performance 88, Accessibility 89, Best Practices 92, SEO 92.

### Prueba manual
1. `npm run build` y `npx serve -s dist/frontend/browser -l 8081` → abrir `http://localhost:8081` (o la URL de Vercel).
2. F12 → Application → Service Workers: `ngsw-worker.js` activated and running. (Si recién abierto, espera ~30 s y recarga.)
3. Application → Manifest: nombre, colores, iconos sin warnings de tamaño; Installability sin errores.
4. Navega por Inicio/Catálogo; Network → **Offline**; **F5**: debe verse el App Shell y el aviso «Sin conexión…».
5. Application → Cache Storage: sin `/api/auth|admin|cart|orders|checkout|payment`.
6. Instalar: icono en la barra de direcciones de Chrome/Edge.
7. Lighthouse: F12 → Lighthouse → modo Navegación, Mobile/Desktop, categorías Performance/Accessibility/Best Practices/SEO, en ventana de incógnito sobre la URL de producción.
8. Nueva versión: tras un nuevo despliegue, recarga una vez; debe aparecer «Hay una nueva versión disponible.».

## 20. Archivos para el commit
Ver tabla final. **No incluir** `.agents/`, `dist/`, ni `node_modules`.

| ARCHIVO | ESTADO | CAMBIO | ¿INCLUIR EN COMMIT? |
|---|---|---|---|
| angular.json | Modificado | manifest en assets; `serviceWorker` en producción | Sí |
| package.json / package-lock.json | Modificado | + `@angular/service-worker` 19.2.15 | Sí |
| ngsw-config.json | Creado | Política de caché conservadora | Sí |
| src/manifest.webmanifest | Creado | Manifest con iconos any/maskable | Sí |
| src/index.html | Modificado | link manifest, theme-color #722F37 | Sí |
| src/app/app.config.ts | Modificado | `provideServiceWorker`, `offlineInterceptor` | Sí |
| src/app/app.component.ts | Modificado | Inyecta los servicios PWA | Sí |
| src/app/services/connectivity.service.ts | Creado | Estado online/offline | Sí |
| src/app/services/pwa-update.service.ts | Creado | Actualización con SwUpdate | Sí |
| src/app/interceptors/offline.interceptor.ts | Creado | Fallo controlado al backend sin red | Sí |
| src/assets/icons/icon-*.png (8) | Creado | Tamaños físicos reales | Sí |
| src/assets/icons/maskable-icon-*.png (2) | Creado | Iconos maskable | Sí |
| PWA_IMPLEMENTATION_REPORT.md | Creado | Este reporte | Opcional |
| .agents/ | Sin seguimiento | Ajeno a producción | **No** |

## 21. npm audit
Resultado registrado por `npm install @angular/service-worker` (fase anterior): **66 vulnerabilidades (4 low, 21 moderate, 38 high, 3 critical)**, provenientes de dependencias transitivas del proyecto (no de `@angular/service-worker`, paquete oficial de Angular). No se ejecutó `npm audit fix --force`; no se hicieron actualizaciones mayores. Una nueva corrida de `npm audit` en esta fase no había terminado al cerrar el reporte: repetirla manualmente con `npm audit` y revisar antes de producción.
