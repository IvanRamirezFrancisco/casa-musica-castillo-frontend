# Frontend Dependency Hardening

Estado: implementación y validación de dependencias completadas. Audit producción: 0; audit completo: 3 Moderate de build justificados, 0 High/Critical. Suite global bloqueada por deuda histórica separada. No constituye autorización de deployment. Rama security/frontend-dependency-hardening, base security/auth-hardening-web, HEAD inicial 2b2f681. Sin commit/push/PR/deploy. Stashes intactos.

## Baseline

Node 22.23.2, npm 11.1.0; Angular 19.2.15, CLI/build 19.2.18, Material/CDK 19.2.19, TypeScript 5.6.3, RxJS 7.8.2, Zone.js 0.15.1, PDF.js 3.11.174. Producción: 23 paquetes afectados (7 Moderate, 15 High, 1 Critical), 62 advisories únicos. La auditoría previa de este chat contiene la tabla individual. npm ls --all inicial: exit 0.

## Fase Angular 19 a 20

Migración oficial ng update @angular/cli@^20 @angular/core@^20: framework 20.3.34, CLI/build 20.3.41. Se omitieron las migraciones OPCIONALES de control flow/signals; todas las obligatorias se ejecutaron. CLI añadió convenciones de generación a angular.json para preservar comportamiento anterior. Core no necesitó cambios de aplicación. Material/CDK: ng update @angular/material@^20, destino 20.2.14.

Material encontró src/styles.backup.css con BOM UTF-16LE; no tiene consumidores. Se convirtió a UTF-8 sin cambiar reglas ni comportamiento CSS (se limpiaron espacios finales señalados por Git); copia original fuera del repositorio en el directorio temporal indicado más abajo. Se repitió oficialmente ng update @angular/material --migrate-only --from=19.2.19 --to=20.2.14 --allow-dirty, con éxito. No se saltó la migración.

El CLI seleccionó TypeScript 5.9.3; se ajustó mediante npm a 5.8.3 para respetar la etapa solicitada. Árbol npm y tipos aplicación/Auth: exit 0. Auth/recovery/sanitización: 30/30 PASS. Build: exit 0, budgets intactos. Artefactos PWA presentes: ngsw.json, ngsw-worker.js, manifest e index; sin rutas auth en dataGroups. Audit producción: 10 (2 Moderate, 7 High, 1 Critical). npm ci reprodujo correctamente esta fase.

## PDF durante la transición

Ambos getDocument existentes usan ahora isEvalSupported:false como mitigación temporal. No constituye remediación completa. Librería y worker siguen alineados en 3.11.174 hasta la fase PDF definitiva. No se instaló canvas manualmente.

## Incidencias del gestor

El primer intento Angular 20 a 21 falla en npm 11.1.0: TypeError Cannot read properties of null (reading edgesOut), dentro de Arborist loadPeerSet al resolver peers opcionales del builder. npm 10.9.8 incluido con Node reproduce el problema. Angular restaura package.json; npm ci del lock 20 pasa. npm estable 11.21.1 en carpeta TEMP resolvió el fallo de Arborist y permitió todas las migraciones; engines compatible; no se cambió npm global ni Node. Nunca se usó force, legacy-peer-deps u overrides. Referencias: https://github.com/npm/cli/issues/8261 y https://github.com/npm/cli/issues/9787 .

## Auth y alcance

No se cambió comportamiento AuthService, login, challenge, guards ni interceptores. Challenge conserva memory-only. No se recuperó el patch Global Search, ni stashes PWA. No hay cambios backend/móvil. Global Search conserva sus 17 errores históricos de TypeScript; no presentar suite global como verde.

## Registros temporales y rollback

Registros fuera del árbol: C:/Users/ivanf/AppData/Local/Temp/castillo-dependency-hardening/. Incluyen baseline-tree.txt, angular20-results.json, logs de validación, angular20.patch y styles.backup.original-utf16.css. Herramientas npm de prueba también están aisladas allí. El patch de fase es una instantánea acumulada respecto a HEAD; no se aplica automáticamente.

Cada fase debe restaurar conjuntamente manifests/lock/código/worker correspondiente; no mezclar PDF.js nuevo con worker antiguo. Volver a dependencias vulnerables solo permite diagnóstico aislado, no deployment. Frontend dependency remediation is a deployment blocker.

## Excepción acotada Vite (último recurso)

El padre estable más reciente @angular/build 22.2.4 fija exactamente Vite 8.3.0. npm update dentro de rangos no puede sustituir ese pin; npm audit sugiere bajar Angular a 21, incompatible con el destino solicitado. Se aplica únicamente @angular/build -> vite 8.3.5: parche estable de la misma línea 8.3, Node compatible, seis advisories corregidos desde 8.3.3. No se añade Vite a dependencies raíz, ni se ignoran advisories. Debe validarse con npm ci, árbol, Auth/PDF/build y dev-server local. Retirar el override cuando un padre Angular estable adopte un Vite corregido. Fuente: https://github.com/advisories/GHSA-9jrq-w75r-8gcw y https://github.com/vitejs/vite/releases/tag/v8.3.5 . No se aplica override de parser 6 a 7 porque sería un salto major sin compatibilidad acreditada.

## Versiones iniciales y finales

| Dependencia | Antes | Después |
|---|---|---|
| @angular/core | 19.2.15 | 22.2.3 |
| @angular/cli | 19.2.18 | 22.2.4 |
| @angular-devkit/build-angular | 19.2.18 | 22.2.4 |
| @angular/material | 19.2.19 | 22.2.4 |
| @angular/cdk | 19.2.19 | 22.2.4 |
| @angular/service-worker | 19.2.15 | 22.2.3 |
| typescript | 5.6.3 | 6.0.3 |
| @types/node | 18.19.130 | 22.20.5 |
| rxjs | 7.8.2 | 7.8.2 |
| zone.js | 0.15.1 | 0.15.1 |
| pdfjs-dist | 3.11.174 | 6.4.299 |
| canvas | 2.11.2 | ausente |
| @mapbox/node-pre-gyp | 1.0.11 | ausente |
| tar | 6.2.1 | ausente |
| @napi-rs/canvas | ausente | 1.0.13 |
| postcss | 8.5.8 | 8.5.28 |
| autoprefixer | 10.4.27 | 10.6.0 |
| tailwindcss | 3.4.1 | 3.4.19 |
| browserslist | 4.28.1 | 4.29.4 |
| baseline-browser-mapping | 2.9.19 | 2.11.33 |
| source-map-js | 1.2.1 | 1.2.2 |
| yaml | 2.8.2 | 2.9.1 |

Node se conservó en 22.23.2; RxJS en 7.8.2 y Zone.js en 0.15.1. npm global continúa en 11.1.0. npm 11.21.1 fue solo herramienta aislada de migración. El npm original 11.1.0 ejecutó el npm ci final correctamente: 919 paquetes añadidos. package-lock.json se generó exclusivamente mediante npm/CLI; no se editó a mano.

## Fases y validaciones

| Fase | Framework | CLI/build | Material/CDK | TypeScript | Auth | Build | Audit producción |
|---|---|---|---|---|---|---|---|
| 19 a 20 | 20.3.34 | 20.3.41 | 20.2.14 | 5.8.3 | 30/30 | PASS | 10: 2 M, 7 H, 1 C |
| 20 a 21 | 21.2.25 | 21.2.28 | 21.2.14 | 5.9.3 | 30/30 | PASS | 10: 2 M, 7 H, 1 C |
| 21 a 22 | 22.2.3 | 22.2.4 | 22.2.4 | 6.0.3 | 30/30 | PASS | 10: 2 M, 7 H, 1 C |
| PDF.js 6 | 22.2.3 | 22.2.4 | 22.2.4 | 6.0.3 | 30/30 | PASS | 4: 2 M, 2 H, 0 C |
| Final, después de npm ci | 22.2.3 | 22.2.4 | 22.2.4 | 6.0.3 | 30/30 | PASS | 0 |

Cada fase pasó npm ls --all y tipos aplicación/Auth antes del siguiente major. Se verificaron artefactos PWA en cada major. No se saltaron majors. No se crearon commits de fase.

### Angular 20 a 21

Comandos oficiales ng update @angular/cli@^21 @angular/core@^21 y ng update @angular/material@^21, usando --allow-dirty por la prohibición de commits intermedios. Tras resolver el gestor, todas las migraciones obligatorias terminaron.

La migración de bootstrap añadió provideZoneChangeDetection() en main.ts para mantener Zone.js. Se ejecutó la migración oficial de control flow: 76 archivos, cambios de sintaxis/imports. No se ejecutó la migración opcional de Router a signals ni la de Vitest.

Se actualizó @types/node 18.19.130 a 22.20.5 porque Vite del builder 21 declaraba incompatible el peer 18. No cambió Node. El chequeo nuevo de host listeners rechazó tres parámetros KeyboardEvent no utilizados; se retiraron únicamente esos argumentos y sus enlaces $event en MainHeader y AdminDemandForecast, sin cambiar las acciones Escape.

### Angular 21 a 22

Comandos oficiales ng update @angular/cli@^22 @angular/core@^22 y ng update @angular/material@^22. Se revalidaron las últimas versiones estables antes de instalar. No se usaron next/beta/RC como destinos directos.

Migraciones ejecutadas: Eager explícito en 56 componentes; withXhr() en configuración HTTP y tres specs, conservando backend XHR/interceptores; $safeNavigationMigration en siete templates para preservar semántica; convención de lib de TypeScript y dependencia istanbul-lib-instrument para Karma. Las de canMatch, hidratación/SSR y outputs no necesitaron cambios adicionales.

El CLI intentó suprimir nullishCoalescingNotNullable y optionalChainNotNullable; se retiraron esas supresiones y los dos tsconfig app/spec quedaron iguales al baseline. strict, strictTemplates y demás controles originales permanecen activos. No se añadieron any para silenciar errores: los ocho $any que aparecen como líneas nuevas en el diff son expresiones preexistentes reformateadas por la migración.

Las conversiones automáticas alcanzan Global Search .ts/.html, exclusivamente sintaxis de template y metadatos Eager. Su spec NO cambió. No se recuperó su patch histórico ni se modificó su contrato funcional.

## PDF.js y worker definitivo

pdfjs-dist 6.4.299, ESM. Ambos consumidores conservan Blob/ArrayBuffer, página 1 y escala 1.5; el render ahora proporciona canvas conforme al tipo v6. Se extrajo un adaptador pequeño y tipado compartido en src/app/shared/pdf/pdf-preview.ts; no se reescribieron los visores. Los errores asíncronos de render muestran el mensaje controlado existente.

GlobalWorkerOptions.workerSrc apunta a /assets/pdfjs/pdf.worker.min.mjs. Los builders build/test copian ese archivo directamente de node_modules/pdfjs-dist/build, por lo que npm ci + build siempre emiten el worker de la versión instalada. Se eliminó el worker vendorizado 3.11.174. No se versiona otra copia generada del worker. El app shell precarga el nuevo asset (1,264,342 bytes); no se cachean PDFs privados ni rutas auth.

isEvalSupported:false se aplicó a v3 durante la transición. PDF.js moderno eliminó esa opción y el último compilador eval, por lo que no se pasa una propiedad obsoleta/ignorada a v6. Se verificó ausencia de eval/new Function en los módulos distribuidos y una prueba examina el worker emitido. No hay ScriptingManager, ejecución de acciones JavaScript del PDF ni innerHTML de su contenido. CSP productiva no se cambió. Fuente primaria: https://github.com/mozilla/pdf.js/commit/f6bac014ea397bcabee7d42d07fbd9f67c2322c6 .

Nueve tests nuevos: worker ESM configurado; versión de worker igual a librería/sin eval; contrato binario de carga; propagación de fallo worker; PDF sintético real y primera página a escala 1.5; PDF corrupto rechazado; canvas sin contexto; render real del consumidor cliente; render real del modal administrativo. Fixtures vectoriales sintéticos sin clientes, secretos, fuentes ni recursos externos. 9/9 PASS también después del npm ci final.

## Transitivas y limpieza

npm update de los padres CSS/tooling, y refresco de transitivas existentes dentro de los rangos que sus padres declaran. No se añadieron transitivas vulnerables como dependencias raíz. Se corrigieron source-map-js, picomatch, YAML, brace-expansion, minimatch, nanoid, Browserslist, baseline-browser-mapping, fast-uri, flatted, lodash, engine.io, socket.io-parser/adapter, follow-redirects, ws y tmp cuando aparecían en el audit completo.

Tailwind se conservó en major 3 (3.4.19). PostCSS 8.5.28 y Autoprefixer 10.6.0. La copia independiente del parser 7 se resolvió en 7.1.7; las dos copias bajo Tailwind/postcss-nested permanecen en 6.1.5 por sus rangos ^6.

Eliminadas después de buscar imports, imports dinámicos, scripts, templates y tests: papaparse, @types/papaparse, @tailwindcss/forms. Solo aparecían declaradas en package.json.

Reclasificadas a devDependencies: autoprefixer, postcss, tailwindcss, @types/zxcvbn. Son tooling/tipos, no imports runtime de la app. Se actualizaron antes de reclasificar; moverlas NO se presenta como arreglo del advisory restante. Vercel instala devDependencies por defecto (https://vercel.com/docs/builds/configure-a-build#install-command). No hay exclusión local configurada; npm ci y build con esta clasificación pasaron. Debe mantenerse la instalación de devDependencies en el entorno de build.

canvas, @mapbox/node-pre-gyp y tar ya NO aparecen ni en instalación ni en lockfile, como consecuencia de actualizar padres Angular/PDF.js. npm ls tar --all muestra vacío; npm explain tar devuelve no encontrado (resultado esperado). PDF.js trae @napi-rs/canvas 1.0.13 opcional mediante npm, sin añadirlo manualmente a raíz; no lo importa código de la aplicación y no se publica un binding nativo .node en dist. El render real en Chrome usa canvas DOM.

## Audit final y justificación de deuda Moderate

- npm audit --omit=dev: exit 0, found 0 vulnerabilities.
- npm audit: exit 1, 3 Moderate, 0 Low/High/Critical; un único advisory subyacente.
- npm ls --all: exit 0, sin invalid/extraneous inesperado ni conflictos de peers.

| Paquete marcado | Versión | Motivo | Exposición y decisión |
|---|---|---|---|
| postcss-selector-parser | 6.1.5 (dos copias) | GHSA-rj75-hqrm-r3gf / CVE-2026-104844, complejidad cuadrática con selectores CSS no confiables | Solo build de fuentes versionadas; no hay endpoint que procese CSS de usuarios. No se envía al browser. Mantener como deuda Moderate de tooling. |
| postcss-nested | 6.2.0 | Propagación del mismo parser | Solo pipeline CSS del build; no es otro CVE independiente. La rama exigida por Tailwind 3 mantiene parser ^6. |
| tailwindcss | 3.4.19 | Propagación del parser y postcss-nested | Tooling dev/build, sin ejecución browser. No pasar a Tailwind 4 ni imponer parser major 7 mediante override no acreditado. |

El advisory indica que el uso ordinario durante build con fuentes confiables no está afectado por la condición de explotación; corregido desde parser 7.1.6. Referencia: https://github.com/advisories/GHSA-rj75-hqrm-r3gf . Revisar esta justificación si se introduce CSS suministrado por usuarios o builds de fuentes no confiables. La deuda sigue registrada y requiere seguimiento; no se afirmó audit completo limpio.

El mínimo solicitado de 0 High/Critical se cumple también en el audit completo. El bloqueo original de dependencias de producción queda remediado en esta rama; los informes Auth anteriores se conservan como snapshots históricos. Esto NO autoriza deploy ni acredita regresión funcional completa del negocio.

## Pruebas finales y límites

| Comprobación | Resultado |
|---|---|
| git diff --check | PASS |
| npm ci, npm original 11.1.0 | PASS, 919 paquetes |
| npm ls --all | PASS |
| TypeScript aplicación/Auth/PDF focal | PASS |
| Auth/recovery/sanitización | 30/30 PASS, mismas assertions |
| PDF | 9/9 PASS, worker real y ambos consumidores |
| Suite global npm test | FAIL de compilación por los mismos 17 errores históricos del spec Global Search; no ejecutó tests |
| TypeScript global --noEmit | 17 errores, todos en ese mismo spec, sin nuevos errores fuera de él |
| npm run build | PASS |
| Audit producción | 0 |
| Audit completo | 3 Moderate de build justificados |
| PWA Chrome local | PASS, 11 comprobaciones |
| Vite dev server 8.3.5 | PASS, HTTP 200 para /, /main.js y /@vite/client |

Ocho archivos críticos revisados: los cuerpos de seis clases (AuthService, recovery y componentes login/register/forgot/reset) se compararon por AST, con igualdad y preservando literales. Los dos interceptores funcionales se verificaron sin diff, al igual que los guards. La memoria del challenge conserva el contrato auditado; los 30 tests incluyen controles de no persistencia. No se redujeron assertions, ni se deshabilitaron tests.

No se ejecutaron compras/pagos reales, APIs backend, cuentas productivas ni deployment Vercel. Catálogo, checkout y administración pasaron compilación de templates, pero no existe validación end-to-end completa de esos flujos en este trabajo; la suite global sigue bloqueada por la deuda indicada.

## PWA y Vercel

node scripts/verify-pwa-local.cjs usa Chrome instalado, perfil temporal nuevo, servidor loopback, CSP de prueba connect-src self y proxy que rechaza conexiones externas sin reenviarlas. No cambia CSP/configuración productiva.

Verificó: worker PDF hash idéntico al paquete; precarga en manifest SW; ausencia de grupo auth; login Angular renderizado; control SW; worker PDF cacheado; chunks lazy cacheados; red real indisponible; login renderizado offline; detección de manifiesto sintético nuevo; activación de actualización. La prueba del protocolo de actualización se aísla en una página local vacía para no competir con el prompt/autoactivación de la aplicación. El prompt existente se revisó, no se automatizó una aceptación del usuario.

El manifiesto sintético solo se sirve en memoria durante el test; no se cambian los archivos construidos ni producción. Servidores y Chrome temporal se apagaron y el perfil se eliminó. Registro: pwa-final-results.json en TEMP.

vercel.json no cambió. Build sigue npm run build, output efectivo dist/frontend/browser; .mjs ya está excluido del rewrite SPA. Node local satisface engines; no se modificó configuración de Node ni proyecto remoto. La configuración efectiva del dashboard Vercel no se consultó ni se desplegó; verificarla antes de rollout.

## Warnings y riesgos restantes

- Históricos: CommonJS sweetalert2/zxcvbn; CSS admin-products sobre budget 80 kB. Total final 87.16 kB (antes 87.09, diferencia +0.07 kB); límite de error 120 kB intacto. No se aumentaron budgets.
- El warning CommonJS PDF.js desapareció al usar ESM.
- Nuevos: 39 diagnósticos NG8107 de optional chaining redundante, mantenidos visibles; builders Webpack/Karma y paquetes animations/platform-browser-dynamic deprecados. No se migra tooling ni animaciones por conveniencia.
- Tres Moderate de build y override Vite acotado deben revisarse en futuras actualizaciones del padre.
- Suite global y regresión integrada de negocio pendientes en su alcance separado.

## Rollout y rollback

Sin commit/push/PR/merge/deploy. Antes de rollout: revisión del diff mecánico, aprobación de deuda Moderate de build/override, comprobar Node/install/build/output Vercel, y regresión integrada en entorno de prueba. Publicar todos los assets del mismo build (incluido worker .mjs y ngsw.json). No recuperar stashes PWA ni patch Global Search.

Snapshots acumulados de fases 20/21/22 están fuera del repositorio. Restaurar coordinadamente package.json/lock, código y mapeo de worker de la fase elegida; reinstalar con npm ci y validar. El worker antiguo existe en HEAD si se revierte TODO el conjunto; nunca combinar v6 con worker v3. Volver a una fase vulnerable no cumple criterios de producción. No se aplicó rollback automático.

## Comandos reproducibles

~~~text
npm ci
npm ls --all
node node_modules/typescript/bin/tsc --noEmit --incremental false -p tsconfig.app.json
node node_modules/typescript/bin/tsc --noEmit --incremental false -p tsconfig.auth-tests.json
node node_modules/typescript/bin/tsc --noEmit --incremental false -p tsconfig.pdf-tests.json
npm test -- --watch=false --browsers=ChromeHeadless --ts-config=tsconfig.auth-tests.json --include=src/app/services/auth-challenge.spec.ts --include=src/app/services/password-reset-auth-compat.spec.ts --include=src/app/components/login/login-auth-contract.spec.ts --include=src/app/interceptors/sanitization-functional.interceptor.spec.ts
npm test -- --watch=false --browsers=ChromeHeadless --ts-config=tsconfig.pdf-tests.json --include=src/app/shared/pdf/pdf-preview.spec.ts
npm test -- --watch=false --browsers=ChromeHeadless
npm run build
node scripts/verify-pwa-local.cjs
npm audit --omit=dev
npm audit
npm ls tar --all
npm ls pdfjs-dist
npm ls canvas
npm ls @napi-rs/canvas
git diff --check
~~~

Los comandos de árbol para paquetes ausentes pueden devolver no encontrado; no instalar paquetes para silenciar esa ausencia. Lint no disponible en package.json; no se agregó infraestructura de lint.

## Advisories iniciales (HEAD reconstruido solo en TEMP)

La consulta de los manifests originales, sin instalar y sin modificar la rama, reprodujo 23 paquetes / 62 advisories. La severidad agregada inicial fue 7 Moderate, 15 High, 1 Critical. Esta tabla conserva identificador, severidad, título, paquetes que lo reportaban y rango afectado de npm.

| Advisory | Severidad | Descripción | Reportado por | Rango inicial |
|---|---|---|---|---|
| [GHSA-58c5-g7wp-6w37](https://github.com/advisories/GHSA-58c5-g7wp-6w37) | high | Angular is Vulnerable to XSRF Token Leakage via Protocol-Relative URLs in Angular HTTP Client | @angular/common | <19.2.16 |
| [GHSA-48r7-hpm6-gfxm](https://github.com/advisories/GHSA-48r7-hpm6-gfxm) | high | @angular/common: Denial of Service (DoS) via OOM in Date Formatting (formatDate) | @angular/common | <=19.2.25 |
| [GHSA-39pv-4j6c-2g6v](https://github.com/advisories/GHSA-39pv-4j6c-2g6v) | high | @angular/common: Weak 32-Bit Cache Key Hashing in `HttpTransferCache` Leading to Cross-Request Data Leakage and State Poisoning | @angular/common | <=19.2.25 |
| [GHSA-p3vc-36g9-x9gr](https://github.com/advisories/GHSA-p3vc-36g9-x9gr) | high | @angular/common: Denial of Service (DoS) via OOM in Number Formatting (digitsInfo) | @angular/common | >=19.0.0-next.0 <19.2.23 |
| [GHSA-q6f4-qqrg-jv6x](https://github.com/advisories/GHSA-q6f4-qqrg-jv6x) | high | @angular/common: Information Leak via Default Caching of Credentialed Requests in HttpTransferCache | @angular/common | >=19.0.0-next.0 <19.2.23 |
| [GHSA-jhpw-976m-542j](https://github.com/advisories/GHSA-jhpw-976m-542j) | high | Angular: Cache-Key Ambiguity in HttpTransferCache Leading to Cross-Request Response Reuse and State Poisoning | @angular/common | <=19.2.25 |
| [GHSA-p297-fm68-3q8c](https://github.com/advisories/GHSA-p297-fm68-3q8c) | moderate | Angular: Information Leak via `HttpTransferCache` Bypass When Using `withRequestsMadeViaParent` | @angular/common | <=19.2.25 |
| [GHSA-jfgx-762w-99vr](https://github.com/advisories/GHSA-jfgx-762w-99vr) | moderate | @angular/common: XSRF Token Leakage via URL Parsing Discrepancy in Angular HTTP Client (Incomplete fix for CVE-2025-66035) | @angular/common | <=19.2.25 |
| [GHSA-g93w-mfhg-p222](https://github.com/advisories/GHSA-g93w-mfhg-p222) | high | Angular vulnerable to XSS in i18n attribute bindings | @angular/compiler, @angular/core | >=19.0.0-next.0 <19.2.20 |
| [GHSA-jrmj-c5cx-3cw6](https://github.com/advisories/GHSA-jrmj-c5cx-3cw6) | high | Angular has XSS Vulnerability via Unsanitized SVG Script Attributes | @angular/compiler, @angular/core | >=19.0.0-next.0 <19.2.18 |
| [GHSA-v4hv-rgfq-gp49](https://github.com/advisories/GHSA-v4hv-rgfq-gp49) | high | Angular Stored XSS Vulnerability via SVG Animation, SVG URL and MathML Attributes | @angular/compiler | >=19.0.0-next.0 <19.2.17 |
| [GHSA-58w9-8g37-x9v5](https://github.com/advisories/GHSA-58w9-8g37-x9v5) | moderate | @angular/compiler: Two-Way Property Binding Sanitization Bypass (XSS) | @angular/compiler | <=19.2.25 |
| [GHSA-f3m7-gqxr-g87x](https://github.com/advisories/GHSA-f3m7-gqxr-g87x) | moderate | Angular: Template and Attribute Namespace Sanitization Bypass (XSS) | @angular/compiler, @angular/core | >=19.0.0-next.0 <19.2.22 |
| [GHSA-jj27-h5hq-8x99](https://github.com/advisories/GHSA-jj27-h5hq-8x99) | high | Angular i18n: Cross-Site Scripting (XSS) via event-handler attributes | @angular/compiler, @angular/core | <=19.2.25 |
| [GHSA-hh8m-fm6v-7cvg](https://github.com/advisories/GHSA-hh8m-fm6v-7cvg) | moderate | Angular: Sanitization bypass via directive host bindings on concrete host elements in @angular/core and @angular/compiler | @angular/compiler, @angular/core | <=19.2.25 |
| [GHSA-prjf-86w9-mfqv](https://github.com/advisories/GHSA-prjf-86w9-mfqv) | high | Angular i18n vulnerable to Cross-Site Scripting | @angular/core | >=19.0.0-next.0 <=19.2.18 |
| [GHSA-692r-grfm-v8x7](https://github.com/advisories/GHSA-692r-grfm-v8x7) | moderate | @angular/core: Angular Template and Dynamic Component Namespace Bypass leading to Cross-Site Scripting (XSS) | @angular/core | >=19.0.0-next.0 <19.2.22 |
| [GHSA-rgjc-h3x7-9mwg](https://github.com/advisories/GHSA-rgjc-h3x7-9mwg) | high | Angular Client Hydration DOM Clobbering & Response-Cache Poisoning | @angular/core | <=19.2.25 |
| [GHSA-ff3f-86qr-9cv3](https://github.com/advisories/GHSA-ff3f-86qr-9cv3) | high | Angular Server-Side Rendering (SSR): Denial of Service via Numeric URL Matrix Parameters | @angular/router | <=19.2.25 |
| [GHSA-62vg-58rm-qff7](https://github.com/advisories/GHSA-62vg-58rm-qff7) | high | @angular/router: Denial of Service via Unmatched Empty-Path Outlet Route Matching in Server-Side Rendering (SSR) | @angular/router | <=19.2.25 |
| [GHSA-qxh6-94w6-9r5p](https://github.com/advisories/GHSA-qxh6-94w6-9r5p) | high | @angular/service-worker: Sensitive Header Leakage on Cross-Origin Redirects in Angular Service Worker | @angular/service-worker | <=19.2.25 |
| [GHSA-95qp-cmmw-mgqv](https://github.com/advisories/GHSA-95qp-cmmw-mgqv) | moderate | @angular/service-worker: Request Credential & Cache Policy Stripping | @angular/service-worker | >=19.0.0-next.0 <19.2.23 |
| [GHSA-gv2q-mqqv-365m](https://github.com/advisories/GHSA-gv2q-mqqv-365m) | moderate | Angular Service Worker Policy-Bypass & Credential-Stripping Vulnerabilities | @angular/service-worker | >=19.0.0-next.0 <19.2.23 |
| [GHSA-w5vr-8v7q-w6rv](https://github.com/advisories/GHSA-w5vr-8v7q-w6rv) | moderate | baseline-browser-mapping process termination on invalid input causes denial of service | baseline-browser-mapping | >=2.0.0 <2.11.0 |
| [GHSA-f886-m6hf-6m8v](https://github.com/advisories/GHSA-f886-m6hf-6m8v) | moderate | brace-expansion: Zero-step sequence causes process hang and memory exhaustion | brace-expansion | <1.1.13 |
| [GHSA-3jxr-9vmj-r5cp](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp) | high | brace-expansion: DoS via exponential-time expansion of consecutive non-expanding {} groups | brace-expansion | <1.1.16 |
| [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg) | high | brace-expansion: DoS via unbounded expansion length causing an out-of-memory process crash | brace-expansion | <1.1.17 |
| [GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895) | high | brace-expansion: DoS via unbounded intermediate arrays, bypassing the CVE-2026-14257 mitigation | brace-expansion | <1.1.18 |
| [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) | moderate | brace-expansion: Quadratic-time expansion of the `{a},b}` rewrite causes CPU denial of service | brace-expansion | <1.1.21 |
| [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7) | high | brace-expansion: DoS via uncontrolled recursion on nested brace groups causing stack exhaustion | brace-expansion | <1.1.20 |
| [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | high | brace-expansion: DoS via uncontrolled recursion in parseCommaParts causing stack exhaustion | brace-expansion | <1.1.19 |
| [GHSA-c83g-rgw3-j3cx](https://github.com/advisories/GHSA-c83g-rgw3-j3cx) | high | Browserslist: Unbounded memory growth (no cache eviction) via distinct query results, leading to eventual OOM | browserslist | <=4.28.6 |
| [GHSA-73wf-gq98-2v4g](https://github.com/advisories/GHSA-73wf-gq98-2v4g) | high | Browserslist: Uncaught crash / prototype write via untrusted browserslist-stats.json custom stats (normalizeStats) | browserslist | <=4.28.6 |
| [GHSA-3ppc-4f35-3m26](https://github.com/advisories/GHSA-3ppc-4f35-3m26) | high | minimatch has a ReDoS via repeated wildcards with non-matching literal in pattern | minimatch | <3.1.3 |
| [GHSA-7r86-cg39-jmmj](https://github.com/advisories/GHSA-7r86-cg39-jmmj) | high | minimatch has ReDoS: matchOne() combinatorial backtracking via multiple non-adjacent GLOBSTAR segments | minimatch | <3.1.3 |
| [GHSA-23c5-xmqv-rm74](https://github.com/advisories/GHSA-23c5-xmqv-rm74) | high | minimatch ReDoS: nested *() extglobs generate catastrophically backtracking regular expressions | minimatch | <3.1.4 |
| [GHSA-28wg-ghj8-5hjv](https://github.com/advisories/GHSA-28wg-ghj8-5hjv) | high | nanoid: non-secure generators can loop indefinitely with negative size | nanoid | <3.3.16 |
| [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) | high | nanoid: custom generators can loop indefinitely when size is zero | nanoid | <3.3.18 |
| [GHSA-xwg4-73v4-xw9w](https://github.com/advisories/GHSA-xwg4-73v4-xw9w) | high | nanoid: Integer Overflow or Wraparound | nanoid | <3.3.12 |
| [GHSA-wgrm-67xf-hhpq](https://github.com/advisories/GHSA-wgrm-67xf-hhpq) | high | PDF.js vulnerable to arbitrary JavaScript execution upon opening a malicious PDF | pdfjs-dist | <=4.1.392 |
| [GHSA-3v7f-55p6-f55p](https://github.com/advisories/GHSA-3v7f-55p6-f55p) | moderate | Picomatch: Method Injection in POSIX Character Classes causes incorrect Glob Matching | picomatch | <2.3.2 |
| [GHSA-c2c7-rcm5-vvqj](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj) | high | Picomatch has a ReDoS vulnerability via extglob quantifiers | picomatch | <2.3.2 |
| [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) | moderate | PostCSS has XSS via Unescaped </style> in its CSS Stringify Output | postcss | <8.5.10 |
| [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q) | high | PostCSS: Arbitrary file read and information disclosure via attacker-controlled sourceMappingURL in CSS comments | postcss | <=8.5.11 |
| [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp) | moderate | PostCSS: incomplete fix of GHSA-6g55-p6wh-862q — attacker-controlled sourceMappingURL reads arbitrary .map files when `from` is unset | postcss | <=8.5.22 |
| [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849) | high | PostCSS: Path Traversal in Previous Source Map Auto-Loading (sourceMappingURL) leads to Arbitrary .map File Disclosure | postcss | <=8.5.17 |
| [GHSA-w9m9-85wc-3x92](https://github.com/advisories/GHSA-w9m9-85wc-3x92) | low | postcss-selector-parser allows denial of service through uncontrolled AST recursion | postcss-selector-parser | >=6.1.0 <6.1.3 |
| [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) | moderate | PostCSS: Quadratic complexity in flat selector parsing allows CPU exhaustion | postcss-selector-parser | <7.1.6 |
| [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) | high | source-map-js allows event-loop denial of service through indexed source-map section offsets | source-map-js | >=1.0.0 <1.2.2 |
| [GHSA-34x7-hfp2-rc4v](https://github.com/advisories/GHSA-34x7-hfp2-rc4v) | high | node-tar Vulnerable to Arbitrary File Creation/Overwrite via Hardlink Path Traversal | tar | <7.5.7 |
| [GHSA-8qq5-rm4j-mr97](https://github.com/advisories/GHSA-8qq5-rm4j-mr97) | high | node-tar is Vulnerable to Arbitrary File Overwrite and Symlink Poisoning via Insufficient Path Sanitization | tar | <=7.5.2 |
| [GHSA-83g3-92jg-28cx](https://github.com/advisories/GHSA-83g3-92jg-28cx) | high | Arbitrary File Read/Write via Hardlink Target Escape Through Symlink Chain in node-tar Extraction | tar | <7.5.8 |
| [GHSA-qffp-2rhf-9h96](https://github.com/advisories/GHSA-qffp-2rhf-9h96) | high | tar has Hardlink Path Traversal via Drive-Relative Linkpath | tar | <=7.5.9 |
| [GHSA-9ppj-qmqm-q256](https://github.com/advisories/GHSA-9ppj-qmqm-q256) | high | node-tar Symlink Path Traversal via Drive-Relative Linkpath | tar | <=7.5.10 |
| [GHSA-r6q2-hw4h-h46w](https://github.com/advisories/GHSA-r6q2-hw4h-h46w) | high | Race Condition in node-tar Path Reservations via Unicode Ligature Collisions on macOS APFS | tar | <=7.5.3 |
| [GHSA-vmf3-w455-68vh](https://github.com/advisories/GHSA-vmf3-w455-68vh) | moderate | node-tar applies PAX size override to intermediary GNU long-name/long-link headers, causing tar parser interpretation differential (file smuggling) | tar | <=7.5.15 |
| [GHSA-w8wr-v893-vjvp](https://github.com/advisories/GHSA-w8wr-v893-vjvp) | moderate | node-tar: Process crash via PAX numeric path type confusion | tar | <=7.5.17 |
| [GHSA-23hp-3jrh-7fpw](https://github.com/advisories/GHSA-23hp-3jrh-7fpw) | critical | node-tar: Decompression/parse DoS via unlimited input | tar | <=7.5.18 |
| [GHSA-8x88-c5mf-7j5w](https://github.com/advisories/GHSA-8x88-c5mf-7j5w) | high | node-tar: Negative tar entry size causes infinite loop in archive replace | tar | <=7.5.17 |
| [GHSA-gvwx-54wh-qm9j](https://github.com/advisories/GHSA-gvwx-54wh-qm9j) | moderate | node-tar: Uncaught Exception DoS via NUL byte in PAX path/linkpath records | tar | <=7.5.16 |
| [GHSA-r292-9mhp-454m](https://github.com/advisories/GHSA-r292-9mhp-454m) | high | node-tar: Uncontrolled recursion in mapHas/filesFilter allows uncatchable stack-overflow DoS via crafted long-path tar with member selection | tar | <=7.5.20 |
| [GHSA-48c2-rrv3-qjmp](https://github.com/advisories/GHSA-48c2-rrv3-qjmp) | moderate | yaml is vulnerable to Stack Overflow via deeply nested YAML collections | yaml | >=2.0.0 <2.8.3 |

## Archivos creados, modificados y eliminados

Los cambios de componentes/templates son mayoritariamente migraciones oficiales. Cambios manuales: tres parámetros Escape sin uso; adaptación PDF y sus pruebas; assets worker/PWA; clasificación/remediación de dependencias; conversión de backup CSS; limpieza de whitespace reportado por Git; documentación y prueba PWA. No hay cambios backend/móvil.

Archivos nuevos: este reporte, scripts/verify-pwa-local.cjs, src/app/shared/pdf/pdf-preview.ts, su spec y tsconfig.pdf-tests.json. Eliminado src/assets/pdfjs/pdf.worker.min.js, reemplazado por copia emitida desde el paquete moderno mediante angular.json.

### git status --short --untracked-files=all

~~~text
 M angular.json
 M ngsw-config.json
 M package-lock.json
 M package.json
 M src/app/app.component.html
 M src/app/app.component.ts
 M src/app/app.config.ts
 M src/app/components/accept-invitation/accept-invitation.component.html
 M src/app/components/accept-invitation/accept-invitation.component.ts
 M src/app/components/admin/admin-abandoned-carts/admin-abandoned-carts.component.html
 M src/app/components/admin/admin-abandoned-carts/admin-abandoned-carts.component.ts
 M src/app/components/admin/admin-backups/admin-backups.component.html
 M src/app/components/admin/admin-backups/admin-backups.component.ts
 M src/app/components/admin/admin-brands/admin-brands.component.html
 M src/app/components/admin/admin-brands/admin-brands.component.ts
 M src/app/components/admin/admin-categories/admin-categories.component.html
 M src/app/components/admin/admin-categories/admin-categories.component.ts
 M src/app/components/admin/admin-coupons/admin-coupons.component.html
 M src/app/components/admin/admin-coupons/admin-coupons.component.ts
 M src/app/components/admin/admin-customers/admin-customers.component.html
 M src/app/components/admin/admin-customers/admin-customers.component.ts
 M src/app/components/admin/admin-dashboard/admin-dashboard.component.html
 M src/app/components/admin/admin-dashboard/admin-dashboard.component.ts
 M src/app/components/admin/admin-db-management/admin-db-management.component.html
 M src/app/components/admin/admin-db-management/admin-db-management.component.ts
 M src/app/components/admin/admin-db-management/tabs/admin-db-monitoring/admin-db-monitoring.component.html
 M src/app/components/admin/admin-demand-forecast/admin-demand-forecast.component.html
 M src/app/components/admin/admin-demand-forecast/admin-demand-forecast.component.ts
 M src/app/components/admin/admin-help-center/admin-help-center.component.html
 M src/app/components/admin/admin-help-center/admin-help-center.component.ts
 M src/app/components/admin/admin-layout/admin-layout.component.html
 M src/app/components/admin/admin-layout/admin-layout.component.ts
 M src/app/components/admin/admin-orders/admin-orders.component.html
 M src/app/components/admin/admin-orders/admin-orders.component.ts
 M src/app/components/admin/admin-payment-settings/admin-payment-settings.component.html
 M src/app/components/admin/admin-payment-settings/admin-payment-settings.component.ts
 M src/app/components/admin/admin-products/admin-products.component.html
 M src/app/components/admin/admin-products/admin-products.component.ts
 M src/app/components/admin/admin-purchase-clustering-prediction/admin-purchase-clustering-prediction.component.html
 M src/app/components/admin/admin-purchase-clustering-prediction/admin-purchase-clustering-prediction.component.spec.ts
 M src/app/components/admin/admin-purchase-clustering-prediction/admin-purchase-clustering-prediction.component.ts
 M src/app/components/admin/admin-purchase-clustering/admin-purchase-clustering.component.html
 M src/app/components/admin/admin-roles/admin-roles.component.html
 M src/app/components/admin/admin-roles/admin-roles.component.ts
 M src/app/components/admin/admin-staff/admin-staff.component.html
 M src/app/components/admin/admin-staff/admin-staff.component.ts
 M src/app/components/admin/admin-staff/staff-form-modal.component.html
 M src/app/components/admin/admin-staff/staff-form-modal.component.ts
 M src/app/components/admin/csv-import-export/csv-import-export.component.html
 M src/app/components/admin/csv-import-export/csv-import-export.component.ts
 M src/app/components/admin/order-detail-modal/order-detail-modal.component.html
 M src/app/components/admin/order-detail-modal/order-detail-modal.component.ts
 M src/app/components/cart-toast/cart-toast.component.ts
 M src/app/components/cart/cart.component.html
 M src/app/components/cart/cart.component.ts
 M src/app/components/catalogo/catalogo.component.html
 M src/app/components/catalogo/catalogo.component.ts
 M src/app/components/checkout/checkout.component.html
 M src/app/components/checkout/checkout.component.ts
 M src/app/components/forgot-password/forgot-password.component.html
 M src/app/components/forgot-password/forgot-password.component.ts
 M src/app/components/global-search/global-search.component.html
 M src/app/components/global-search/global-search.component.ts
 M src/app/components/help-center/help-center.component.html
 M src/app/components/help-center/help-center.component.ts
 M src/app/components/home/home.component.html
 M src/app/components/home/home.component.ts
 M src/app/components/information-page/information-page.component.ts
 M src/app/components/login/login.component.html
 M src/app/components/login/login.component.ts
 M src/app/components/main-footer/main-footer.component.ts
 M src/app/components/main-header/main-header.component.html
 M src/app/components/main-header/main-header.component.ts
 M src/app/components/mercado-pago-return/mercado-pago-return.component.ts
 M src/app/components/not-found/not-found.component.ts
 M src/app/components/ofertas/ofertas.component.html
 M src/app/components/ofertas/ofertas.component.ts
 M src/app/components/order-detail/order-detail.component.html
 M src/app/components/order-detail/order-detail.component.ts
 M src/app/components/order-list/order-list.component.html
 M src/app/components/order-list/order-list.component.ts
 M src/app/components/payments-info/payments-info.component.html
 M src/app/components/payments-info/payments-info.component.ts
 M src/app/components/product-detail/product-detail.component.html
 M src/app/components/product-detail/product-detail.component.ts
 M src/app/components/product-detail/product-recommendation-card/product-recommendation-card.component.ts
 M src/app/components/product-reviews/product-reviews.component.html
 M src/app/components/product-reviews/product-reviews.component.ts
 M src/app/components/profile-layout/profile-layout.component.ts
 M src/app/components/profile-security/profile-security.component.html
 M src/app/components/profile-security/profile-security.component.ts
 M src/app/components/register/register.component.html
 M src/app/components/register/register.component.ts
 M src/app/components/reset-password/reset-password.component.html
 M src/app/components/reset-password/reset-password.component.ts
 M src/app/components/search-results/search-results.component.html
 M src/app/components/search-results/search-results.component.ts
 M src/app/components/server-error/server-error.component.ts
 M src/app/components/shipping-info/shipping-info.component.html
 M src/app/components/shipping-info/shipping-info.component.ts
 M src/app/components/site-map/site-map.component.html
 M src/app/components/site-map/site-map.component.ts
 M src/app/components/user-profile/user-profile.component.html
 M src/app/components/user-profile/user-profile.component.ts
 M src/app/components/verify-account/verify-account.component.html
 M src/app/components/verify-account/verify-account.component.ts
 M src/app/components/wishlist/wishlist.component.html
 M src/app/components/wishlist/wishlist.component.ts
 M src/app/google-auth-setup/google-auth-setup.component.html
 M src/app/google-auth-setup/google-auth-setup.component.ts
 M src/app/services/auth-challenge.spec.ts
 M src/app/services/password-reset-auth-compat.spec.ts
 M src/app/shared/components/info-tooltip/info-tooltip.component.ts
 M src/app/shared/components/notification-center/notification-center.component.html
 D src/assets/pdfjs/pdf.worker.min.js
 M src/main.ts
 M src/styles.backup.css
 M tsconfig.json
?? docs/security/FRONTEND_DEPENDENCY_HARDENING.md
?? scripts/verify-pwa-local.cjs
?? src/app/shared/pdf/pdf-preview.spec.ts
?? src/app/shared/pdf/pdf-preview.ts
?? tsconfig.pdf-tests.json
~~~

### git diff --stat

~~~text
 angular.json                                       |    40 +-
 ngsw-config.json                                   |     3 +-
 package-lock.json                                  | 17124 +++++++++----------
 package.json                                       |    53 +-
 src/app/app.component.html                         |    74 +-
 src/app/app.component.ts                           |     7 +-
 src/app/app.config.ts                              |     4 +-
 .../accept-invitation.component.html               |   371 +-
 .../accept-invitation.component.ts                 |     7 +-
 .../admin-abandoned-carts.component.html           |   617 +-
 .../admin-abandoned-carts.component.ts             |     3 +-
 .../admin-backups/admin-backups.component.html     |  1256 +-
 .../admin/admin-backups/admin-backups.component.ts |     3 +-
 .../admin/admin-brands/admin-brands.component.html |   933 +-
 .../admin/admin-brands/admin-brands.component.ts   |     3 +-
 .../admin-categories.component.html                |   538 +-
 .../admin-categories/admin-categories.component.ts |     3 +-
 .../admin-coupons/admin-coupons.component.html     |   758 +-
 .../admin/admin-coupons/admin-coupons.component.ts |     7 +-
 .../admin-customers/admin-customers.component.html |  1047 +-
 .../admin-customers/admin-customers.component.ts   |     3 +-
 .../admin-dashboard/admin-dashboard.component.html |   217 +-
 .../admin-dashboard/admin-dashboard.component.ts   |     3 +-
 .../admin-db-management.component.html             |    27 +-
 .../admin-db-management.component.ts               |    10 +-
 .../admin-db-monitoring.component.html             |     6 +-
 .../admin-demand-forecast.component.html           |   778 +-
 .../admin-demand-forecast.component.ts             |     7 +-
 .../admin-help-center.component.html               |   621 +-
 .../admin-help-center.component.ts                 |     7 +-
 .../admin/admin-layout/admin-layout.component.html |   138 +-
 .../admin/admin-layout/admin-layout.component.ts   |     7 +-
 .../admin/admin-orders/admin-orders.component.html |   703 +-
 .../admin/admin-orders/admin-orders.component.ts   |     3 +-
 .../admin-payment-settings.component.html          |   284 +-
 .../admin-payment-settings.component.ts            |     7 +-
 .../admin-products/admin-products.component.html   |  2991 ++--
 .../admin-products/admin-products.component.ts     |     3 +-
 ...n-purchase-clustering-prediction.component.html |     2 +-
 ...urchase-clustering-prediction.component.spec.ts |     4 +-
 ...min-purchase-clustering-prediction.component.ts |     3 +-
 .../admin-purchase-clustering.component.html       |     6 +-
 .../admin/admin-roles/admin-roles.component.html   |  1188 +-
 .../admin/admin-roles/admin-roles.component.ts     |     3 +-
 .../admin/admin-staff/admin-staff.component.html   |  1223 +-
 .../admin/admin-staff/admin-staff.component.ts     |     3 +-
 .../admin-staff/staff-form-modal.component.html    |   549 +-
 .../admin-staff/staff-form-modal.component.ts      |     7 +-
 .../csv-import-export.component.html               |   723 +-
 .../csv-import-export.component.ts                 |     8 +-
 .../order-detail-modal.component.html              |   965 +-
 .../order-detail-modal.component.ts                |    32 +-
 .../components/cart-toast/cart-toast.component.ts  |    34 +-
 src/app/components/cart/cart.component.html        |   710 +-
 src/app/components/cart/cart.component.ts          |     3 +-
 .../components/catalogo/catalogo.component.html    |  1224 +-
 src/app/components/catalogo/catalogo.component.ts  |     3 +-
 .../components/checkout/checkout.component.html    |  2079 +--
 src/app/components/checkout/checkout.component.ts  |     3 +-
 .../forgot-password/forgot-password.component.html |   336 +-
 .../forgot-password/forgot-password.component.ts   |     7 +-
 .../global-search/global-search.component.html     |   741 +-
 .../global-search/global-search.component.ts       |     2 +
 .../help-center/help-center.component.html         |   440 +-
 .../help-center/help-center.component.ts           |     7 +-
 src/app/components/home/home.component.html        |   667 +-
 src/app/components/home/home.component.ts          |     3 +-
 .../information-page/information-page.component.ts |   142 +-
 src/app/components/login/login.component.html      |   613 +-
 src/app/components/login/login.component.ts        |     7 +-
 .../main-footer/main-footer.component.ts           |     7 +-
 .../main-header/main-header.component.html         |   324 +-
 .../main-header/main-header.component.ts           |    15 +-
 .../mercado-pago-return.component.ts               |    79 +-
 .../components/not-found/not-found.component.ts    |     7 +-
 src/app/components/ofertas/ofertas.component.html  |   222 +-
 src/app/components/ofertas/ofertas.component.ts    |     3 +-
 .../order-detail/order-detail.component.html       |  1322 +-
 .../order-detail/order-detail.component.ts         |    32 +-
 .../order-list/order-list.component.html           |   195 +-
 .../components/order-list/order-list.component.ts  |     3 +-
 .../payments-info/payments-info.component.html     |    60 +-
 .../payments-info/payments-info.component.ts       |     3 +-
 .../product-detail/product-detail.component.html   |  1598 +-
 .../product-detail/product-detail.component.ts     |     3 +-
 .../product-recommendation-card.component.ts       |   140 +-
 .../product-reviews/product-reviews.component.html |   383 +-
 .../product-reviews/product-reviews.component.ts   |     3 +-
 .../profile-layout/profile-layout.component.ts     |     7 +-
 .../profile-security.component.html                |  1119 +-
 .../profile-security/profile-security.component.ts |     7 +-
 .../components/register/register.component.html    |   500 +-
 src/app/components/register/register.component.ts  |     7 +-
 .../reset-password/reset-password.component.html   |   442 +-
 .../reset-password/reset-password.component.ts     |     7 +-
 .../search-results/search-results.component.html   |   240 +-
 .../search-results/search-results.component.ts     |     3 +-
 .../server-error/server-error.component.ts         |     7 +-
 .../shipping-info/shipping-info.component.html     |    84 +-
 .../shipping-info/shipping-info.component.ts       |     3 +-
 .../components/site-map/site-map.component.html    |    39 +-
 src/app/components/site-map/site-map.component.ts  |     7 +-
 .../user-profile/user-profile.component.html       |   208 +-
 .../user-profile/user-profile.component.ts         |     7 +-
 .../verify-account/verify-account.component.html   |    89 +-
 .../verify-account/verify-account.component.ts     |     7 +-
 .../components/wishlist/wishlist.component.html    |   367 +-
 src/app/components/wishlist/wishlist.component.ts  |     4 +-
 .../google-auth-setup.component.html               |    44 +-
 .../google-auth-setup.component.ts                 |     7 +-
 src/app/services/auth-challenge.spec.ts            |     4 +-
 .../services/password-reset-auth-compat.spec.ts    |     4 +-
 .../info-tooltip/info-tooltip.component.ts         |     7 +-
 .../notification-center.component.html             |   375 +-
 src/assets/pdfjs/pdf.worker.min.js                 |    22 -
 src/main.ts                                        |     3 +-
 src/styles.backup.css                              |   Bin 14278 -> 6829 bytes
 tsconfig.json                                      |     6 +-
 118 files changed, 24850 insertions(+), 23578 deletions(-)
~~~

El stat anterior corresponde a archivos ya versionados; no incluye los cinco archivos nuevos sin stage. No se ejecutó git add. Rama y stashes permanecen intactos.

## Revisión de secretos y cierre

Se revisaron el diff completo, las líneas añadidas y los cinco archivos nuevos. No se introdujeron credenciales reales, JWT firmados reales, claves privadas, API keys, passwords ni challenges reales. Los fixtures PDF son sintéticos; las variables legítimas de Auth se conservaron. Los patrones automatizados no sustituyeron la revisión manual. No se cambió backend ni móvil; no se hizo git add/commit/push/PR/merge/deploy. Rama security/frontend-dependency-hardening, ambos stashes intactos. Servidor loopback de desarrollo apagado tras verificar su PID/puerto; prueba PWA cerró su Chrome/perfil y servidores propios.
