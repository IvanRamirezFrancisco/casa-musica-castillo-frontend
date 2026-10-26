# Auth 2FA Migration — Casa de Música Castillo

Fecha: 2026-10-25. Rama: `security/auth-hardening-web`. Backend coordinado: `security/auth-hardening`.

**Frontend dependency remediation is a deployment blocker.** Auth Hardening no remedia las vulnerabilidades HIGH/CRITICAL de dependencias y no declara el frontend listo para producción.

## Estado inicial y alcance

HEAD inicial `353acd2`, working tree limpio. Se verificaron rama/status/log/stash list. Stashes Actividad 6 PWA/UI-UX intactos. Sin cambios móviles, PWA, infraestructura, producción, budgets, package.json ni package-lock.json. No commit/push/PR/deploy.

## Arquitectura anterior y vulnerabilidades

AuthService/LoginComponent retenían un usuario pendiente y enviaban email+method para envío, email+code+method para verificación. El backend permitía verificar el factor sin acreditar password previa y podía activar EMAIL durante un login. Coexistía un JWT alternativo incompatible. La exclusión general /api/auth permitía operaciones de identidad fuera del filtro oficial.

## Contrato final

El backend mantiene AuthController, JwtTokenProvider HS512 y SessionManagementService con sesiones persistidas en auth.active_sessions. Access JWT: sub=ID usuario, jti=sesión, email, roles/authorities, iat, exp. Bearer sigue siendo el único mecanismo de autorización del navegador. No se emite access token antes de concluir 2FA.

Login sin 2FA conserva el envoltorio `data.jwtResponse.accessToken/user` existente. Login pendiente devuelve exclusivamente:

```json
{ "success": true, "data": { "twoFactorRequired": true, "preAuthChallenge": "<opaque-token>", "availableMethods": { "EMAIL": true, "GOOGLE_AUTHENTICATOR": true, "BACKUP_CODE": false } } }
```

AuthService captura el challenge y solo entrega a LoginComponent el estado pendiente y los métodos permitidos; no expone el token para renderizar. El email de la UI procede del formulario local, no autoriza al usuario.

Envío:

```json
{ "preAuthChallenge": "<opaque-token>", "method": "EMAIL" }
```

Verificación:

```json
{ "preAuthChallenge": "<opaque-token>", "method": "EMAIL", "code": "<user-input>" }
```

GOOGLE_AUTHENTICATOR y BACKUP_CODE usan el mismo contrato de verificación. No hay email/userId autorizante ni compatibilidad con verify sin challenge. La respuesta posterior a verify conserva `data.accessToken/user`.

Interfaces explícitas: AvailableLoginMethods, LoginFactorMethod, SendLoginCodeRequest, VerifyLoginFactorRequest, LoginJwtResponse y LoginFactorResponse en el modelo auth existente. No se inventa un segundo esquema JWT. AuthResponse conserva compatibilidad con los consumidores existentes de login/registro.

## Challenge y flujo de UI

- Campo privado en AuthService, exclusivamente en memoria. No localStorage, sessionStorage, IndexedDB, cookies, URL/query/fragment, Cache Storage, analytics ni template.
- 256 bits aleatorios, SHA-256 en PostgreSQL, LOGIN_2FA, TTL 5 min, un uso, cinco intentos; cuotas persistentes por usuario y locking/transacciones en backend.
- LoginComponent muestra solo los métodos permitidos, conserva el diseño existente y limpia password al pasar a 2FA.
- Se limpia challenge al iniciar otro login, cancelar, destruir el componente, completar login/verify, logout, recibir rechazo/expiración/error de envío/verificación. Una recarga crea un servicio sin challenge y exige login nuevamente.
- Se identifica la versión del flujo en memoria: una respuesta tardía de login/verify cancelado no restaura estado ni autentica; un error de verify antiguo no borra un login nuevo.
- Interceptor no adjunta JWT a login/registro/preauth públicos y no envía challenge por headers globales. El challenge solo viaja en los dos payloads correspondientes.
- OfflineInterceptor no persiste mutaciones; Service Worker solo cachea GET públicos del storefront. Se inspeccionaron estos controles, sin modificar PWA.
- Mensajes de verificación fallida son texto fijo; no innerHTML ni bypassSecurityTrust. El backend sanea validación y errores sin rejected values, códigos o secretos.

## /me, logout y sesiones

/me utiliza Authentication ya establecida por el filtro: firma HS512, exp, jti, sesión activa, ownership y usuario actual habilitado. Las operaciones de sesión requieren Bearer válido. No se vuelve a decodificar el JWT de manera inferior en /me.

AuthService.logout limpia credenciales locales y el challenge incluso en home/login; solicita revocación del JWT actual al endpoint oficial y evita bucles del interceptor si ese logout recibe 401. Si la red falla, los datos locales quedan eliminados; el servidor puede conservar la sesión hasta expiración/inactividad. Logout-all y DELETE sessions verifican identidad/ownership en backend. Las sesiones se revocan persistentemente, no mediante una blacklist del navegador.

## 2FA y secretos

EMAIL solo utiliza métodos previamente configurados; enviar no activa preferencias. El código EMAIL de login tiene hash BCrypt persistido por challenge. TOTP conserva librería/algoritmo existentes y no persiste códigos temporales. Backup codes conservan BCrypt/uso único y añaden locking de filas. Los secretos de enrollment/QR se limitan a las operaciones protegidas necesarias, nunca al login pendiente.

El navegador no recibe JWT secret ni password hash. Producción exige secreto configurado fuera de Git y backend valida mínimo 64 bytes; no se rotaron secretos. Los fixtures contienen valores evidentemente sintéticos. No se loggea challenge/código/password/JWT real.

## Endpoints retirados y refresh policy

No se encontraron consumidores de secure-login, secure-logout, refresh ni refresh-token en ambos repositorios. Se eliminaron SecureAuthController/SecureJwtService y el refresh oficial incompatible. Se retiraron además csrf-token/session-status de ese controller. Su consumidor de mantenimiento fue migrado a limpieza de sesiones persistentes.

**El contrato oficial actual no incluye renovación automática de access tokens.** Un token vencido/revocado requiere login nuevo. Se conserva registro/verificación/recovery, incluidos los contratos públicos existentes de PasswordResetController y SecurePasswordResetController. Las rutas protegidas no quedan excluidas por /api/auth/\*\*.

## Migración Flyway y tests backend

V51 añade login_challenges/login_factor_limits y V52 añade el último slot TOTP aceptado por usuario; no se modifica ninguna migración histórica ni V51. El baseline faltante de la base se resolvió solo en test resources con el esquema histórico completo; V4..V52 se ejecutan intactas, no se saltan ni se apaga Flyway. La prueba concurrente real en PostgreSQL emite exactamente un JWT. Los detalles, comandos de PostgreSQL temporal y cobertura están en AUTH_HARDENING.md del backend.

## Pruebas frontend y evidencia de deuda previa

Los tests Auth cubren login normal/pendiente, registro, recuperación, payloads, challenge privado, ausencia de storage/IndexedDB/URL/logs, reinicialización, cancelación, respuestas tardías, errores, backup y logout. `tsconfig.auth-tests.json` es una configuración adicional reproducible; no sustituye ni deshabilita la suite global.

```powershell
npm test -- --watch=false --browsers=ChromeHeadless --ts-config=tsconfig.auth-tests.json --include=src/app/services/auth-challenge.spec.ts --include=src/app/services/password-reset-auth-compat.spec.ts --include=src/app/components/login/login-auth-contract.spec.ts --include=src/app/interceptors/sanitization-functional.interceptor.spec.ts
npm test -- --watch=false --browsers=ChromeHeadless
npm run build
npm audit --omit=dev
```

Los 17 errores TypeScript de Global Search son preexistentes. La reparación de su spec realizada durante la validación anterior se retiró de Auth Hardening por alcance. Antes de restaurar el archivo exactamente a deploy/vercel-frontend se guardó un patch fuera del repositorio:

`C:\Users\ivanf\AppData\Local\Temp\auth-hardening-review-hpkepuus\global-search.component.spec.patch`

SHA-256: `7661767ba4b9499ff36d00b6badc73a332c102abc3928912fdccf046d1a45090`. git apply --check pasó con el archivo restaurado. Global Search no aparece en el diff actual. No se recuperó el patch para conseguir tests verdes.

Como evidencia histórica, se había ejecutado un worktree detached de deploy/vercel-frontend (`353acd2`) con únicamente aquella reparación de compilación del spec: 49 tests, 23 fallos previos. El worktree/junction se retiraron. En la validación actual la suite global vuelve a bloquearse antes de ejecutar tests por los 17 errores TypeScript originales de ese archivo. La configuración Auth aislada sigue siendo adicional, no una sustitución oculta de la suite global.

**Lint no disponible en package.json de la rama base.** Se ejecutó npm run lint y se documentó Missing script; no se instaló tooling.

Warnings del build: CSS admin-products 87.09 kB frente a budget 80 kB (exceso 7.09 kB), CommonJS sweetalert2/pdfjs-dist/zxcvbn. No se aumentaron budgets.

## DEPENDENCY SECURITY DEBT

### PREEXISTENTE respecto de Auth Hardening

`git diff -- package.json package-lock.json` está vacío. Sus archivos también coinciden con deploy/vercel-frontend. No se instaló, actualizó, eliminó ni parcheó ninguna dependencia en este trabajo. Esto no convierte las vulnerabilidades en aceptables.

Última captura npm audit --omit=dev: **23 vulnerabilidades: 7 moderadas, 15 altas, 1 crítica**. Si el registro cambia, usar la captura final de validación y volver a evaluar antes de deployment.

Entorno observado: Node **22.23.2**, TypeScript **5.6.3**, Angular core/common/compiler/router **19.2.15**, CLI/build **19.2.18**, Material/CDK **19.2.19**.

Se ejecutaron sin cambios: npm audit --omit=dev; npm ls @angular/core @angular/common @angular/compiler @angular/router; npm ls pdfjs-dist; npm ls tar --all; npm explain pdfjs-dist; npm explain tar. Evidencia local en auth-audit.log/auth-dependency-tree.log (ignorados por Git).

Árbol de producción/optional registrado en package-lock:

```text
frontend (dependencia directa)
└─ pdfjs-dist 3.11.174
   └─ canvas 2.11.2 (optional)
      └─ @mapbox/node-pre-gyp 1.0.11 (optional)
         └─ tar ^6.1.11 → 6.2.1
```

El árbol instalado que muestran npm ls/explain también contiene tar 6.2.1 mediante @angular/cli → pacote 20.0.0, y tar 7.5.1 bajo cacache/node-gyp (tooling dev). canvas/node-pre-gyp pueden omitirse como nativos opcionales en Windows; audit evalúa el lockfile, no solamente lo instalado. No confundir ese detalle con ausencia de riesgo en otro entorno de instalación.

**pdfjs-dist sí es una dependencia directa y tiene consumidores reales**:

- src/app/components/order-detail/order-detail.component.ts: import y getDocument para previsualización del comprobante PDF del cliente.
- src/app/components/admin/order-detail-modal/order-detail-modal.component.ts: import y getDocument en el modal administrativo.
- Ambos fijan el worker local `/assets/pdfjs/pdf.worker.min.js`, versión 3.11.174. La actualización requiere coordinar librería/worker y revisar APIs/ESM; no basta cambiar una versión. No se eliminó nada.

| Hallazgo                                                                                                  | Severidad/cadena                              | Sugerencia de npm, no aplicada                                  |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------- |
| Angular core/common/compiler/service-worker: XSS, filtración de headers/XSRF y otras advisories del audit | HIGH y transitivas                            | Angular 22.2.3; breaking change                                 |
| tar: traversal de enlaces/rutas, escritura fuera del destino y DoS de parsing                             | CRITICAL; cadena optional de PDF.js y tooling | Resolver la cadena mediante pdfjs-dist 6.4.299; breaking change |
| Otros: brace-expansion, minimatch, nanoid, PostCSS, source-map-js, browserslist; yaml y otros             | HIGH/MODERATE según audit                     | Parches/actualización del árbol en tarea separada               |

Objetivos recomendados **para evaluación, no instalación aquí**: Angular 22.2.3 coherente en todos sus paquetes, TypeScript >=6.0 <6.1 conforme al compiler-cli publicado, y PDF.js 6.4.299 con worker de igual versión. Node 22.23.2 satisface los engines publicados de esos candidatos (Angular ^22.22.3; PDF.js >=22.13.0), pero eso no sustituye pruebas de compatibilidad. Material/CDK, builder, zoneless/zone, templates y tipado deben evaluarse en la rama Dependency Hardening. El estado de advisories debe reconsultarse al implementar; no se garantiza que esos candidatos por sí solos eliminen toda la deuda.

Fuentes primarias consultadas: [compatibilidad Angular](https://angular.dev/reference/versions), [release PDF.js 6.4.299](https://github.com/mozilla/pdf.js/releases/tag/v6.4.299), metadatos npm view engines/peerDependencies de los paquetes concretos. Angular 22 requiere una versión TypeScript distinta de la actual; PDF.js 6 incluye cambios mayores de API.

Mitigaciones posibles para estudiar: instalación de browser build sin nativos opcionales cuando no se necesiten, aislamiento/restricción temporal de previsualización PDF y revisión del procesamiento de archivos no confiables. No se aplicó ninguna: omitir optional no borra la deuda del lockfile ni remedia Angular. No usar overrides o audit fix --force sin revisar compatibilidad. No presentar workarounds como permiso de deployment.

### INTRODUCIDO POR AUTH HARDENING

Ningún cambio de dependencias. Se añadieron contratos/tests/documentación de auth, no paquetes. No se afirma haber eliminado las 23 vulnerabilidades. La remediación será `Frontend Dependency Hardening`, en su propia rama y antes de cualquier deploy.

## Rollout y rollback

No se desplegó. El par nuevo backend/web requiere coordinación para 2FA: un frontend anterior no enviará challenge y el backend lo rechazará. No hay periodo de challenge opcional ni bypass email+código. El backend preserva JWT HS512+jti actuales con sesión activa y mismo secreto; no cierra sesiones masivamente. Los usuarios con login 2FA pendiente deben reiniciar login; recargar pierde challenge deliberadamente.

Antes de rollout: resolver dependencias HIGH/CRITICAL y deuda de pruebas globales, aplicar V51 y V52 en staging desde un estado válido, probar contratos y preparar actualización de clientes siguiendo el proceso existente sin recuperar stashes PWA.

Rollback: conservar tablas aditivas y sesiones; no DROP ni rotación automática. Retirar temporalmente tráfico de login/2FA si no hay un par seguro compatible y corregir hacia delante. No volver a publicar endpoints inseguros/debug, recuperar secretos confirmados ni desactivar challenge o protección de replay para restaurar compatibilidad.

## Correcciones de Security Review

- **HIGH-01:** backend retiró ambos endpoints debug TOTP y sus helpers de exposición. No hay mappings de debug en production y SecurityConfig deniega el prefijo. QR/manual-code solo responden mientras el enrollment está pendiente; con googleAuthEnabled=true responden 403 sin secreto, manualEntryKey, QR ni código vigente. No hay recuperación del secreto confirmado. La UI conserva el enrollment inicial; la antigua consulta de QR existente para una cuenta ya confirmada ahora se rechaza de forma segura.
- **MED-01:** el backend persiste last_verified_totp_slot en V52 y solo acepta slots estrictamente posteriores. Se conserva tolerancia ±2 slots y se verifica concurrencia PostgreSQL con exactamente un JWT para un mismo TOTP. No se envía este contador ni el secreto al login frontend.
- **MED-02:** hash/quota EMAIL se confirman en una transacción corta antes del transporte externo; el coordinador rechaza transacciones ambientales para no conservar sus locks. Timeout/fallo devuelve 503 controlado; no devuelve cuotas ni invalida automáticamente el hash porque el mensaje podría haberse entregado. Reintentos siguen sujetos a límites.
- **MED-04:** LoginComponent muestra `Demasiados intentos. Espera unos minutos antes de intentarlo nuevamente.` ante 429 sin remainingTimeSeconds. Se mantiene el countdown existente cuando sí hay tiempo; no se exponen detalles backend. Backend comprueba email e IP después del intento fallido.
- **LOW-01:** claves del skip de sanitización normalizadas a lowercase; accessToken/refreshToken/preAuthChallenge se preservan sin ampliar la lista. Se añadió un test del interceptor.
- **LOW-02:** create/send reciben 429 si attempts ya está agotado y no crean challenges ni envían correos inutilizables.
- **LOW-03:** app.security.jwt.expiration explícito a 86400000; se retiró la configuración antigua del JWT alternativo. Producción y configuración OAuth2 con consumidores legítimos no cambian.

### MED-03 pendiente

Se mantiene el reset del challenge tras un primer verify fallido. No se alteró esa semántica ni se inventó un contrato nuevo de error codes; la mejora de reintentos/UX queda pendiente.

### Dependency Check backend

Se intentó el plugin Maven existente sin actualizar dependencias ni introducir claves. NVD devolvió HTTP 403 y el análisis falló por falta de documentos; no hay un reporte utilizable ni puede afirmarse ausencia de HIGH/CRITICAL backend. El informe backend documenta el comando y el fallo externo. No afecta el resultado de tests Auth ni cambia la deuda frontend.

## Validación y estado Git finales

| Validación final            | Resultado                                                                                                                                |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Auth/recovery + interceptor | **30/30 PASS**, sin fallos                                                                                                               |
| Suite global                | Compilación bloqueada antes de ejecutar tests por los **17 errores TypeScript históricos** de Global Search; no se reaplica el patch     |
| npm run build               | **SUCCESS**, warnings existentes de CSS/CommonJS, sin modificar budgets                                                                  |
| npm audit --omit=dev        | Exit 1: **23 vulnerabilidades (7 moderate, 15 high, 1 critical)** preexistentes; sin fixes                                               |
| Dependencias                | package.json/package-lock.json sin diff                                                                                                  |
| Global Search               | Archivo idéntico a deploy/vercel-frontend, fuera de Auth Hardening; patch externo intacto y git apply --check correcto                   |
| git diff --check            | Correcto                                                                                                                                 |
| Secret scan                 | 0 patrones private key/live API key/JWT firmado literal; revisión manual confirma solo fixtures sintéticos y ningún secreto real añadido |
| Lint                        | No disponible en package.json de la base; no se instaló infraestructura                                                                  |

Las correcciones añaden el fallback 429 y el test de claves opacas sin cambiar la limpieza del challenge tras verify fallido (MED-03). El backend termina test/verify con 205 tests y 0 failures/errors/skipped; el escaneo NVD es inconcluso por HTTP 403.

Patch separado: `C:\Users\ivanf\AppData\Local\Temp\auth-hardening-review-hpkepuus\global-search.component.spec.patch`. No está dentro de ningún árbol versionado de Auth Hardening.

### git status --short --untracked-files=all

```text
 M .gitignore
 M src/app/components/login/login.component.ts
 M src/app/interceptors/auth.interceptor.ts
 M src/app/interceptors/sanitization-functional.interceptor.ts
 M src/app/models/user.model.ts
 M src/app/services/auth.service.ts
?? docs/security/AUTH_2FA_MIGRATION.md
?? src/app/components/login/login-auth-contract.spec.ts
?? src/app/interceptors/sanitization-functional.interceptor.spec.ts
?? src/app/services/auth-challenge.spec.ts
?? src/app/services/password-reset-auth-compat.spec.ts
?? tsconfig.auth-tests.json
```

### git diff --stat

```text
 .gitignore                                         |  3 +
 src/app/components/login/login.component.ts        | 49 +++++++------
 src/app/interceptors/auth.interceptor.ts           |  6 +-
 .../sanitization-functional.interceptor.ts         |  4 +-
 src/app/models/user.model.ts                       | 11 ++-
 src/app/services/auth.service.ts                   | 84 +++++++++++++---------
 6 files changed, 97 insertions(+), 60 deletions(-)
```

Stat no incluye nuevos archivos sin seguimiento. Stashes intactos; sin móvil/PWA/dependencias/producción/commit/push/PR/deploy. **Frontend dependency remediation is a deployment blocker.** Pendientes: Frontend Dependency Hardening, MED-03 UX y repetición de Dependency Check backend con acceso NVD autorizado.
