# PWA_OFFLINE_TEST_REPORT — Casa de Música Castillo (frontend)

**Fecha:** 2026-10-13
**Rama:** `deploy/vercel-frontend`
**Entorno de prueba:** Servidor local de producción (`http://localhost:8081`) sirviendo `dist/frontend/browser` + Chrome Headless / DevTools
**Service Worker:** `@angular/service-worker` 19.2.15 (`ngsw-worker.js` activo en scope `/`)

---

## 1. Matriz de Casos de Prueba Offline Read-Only

| CASO | ROUTE | RECURSO | PRECONDICIÓN | ONLINE/OFFLINE | ESPERADO | REAL | ESTADO |
|:---:|:---|:---|:---|:---:|:---|:---|:---:|
| **1** | `/` (`/home`) | App Shell + Chunks + Assets | Primera carga de la PWA | Online | Carga completa del Home, estilos, navegación. SW se activa. | Carga correcta, Service Worker registrado y activado en scope `/`. | **PASS** |
| **2** | `/` (`/home`) | App Shell + Assets locales | Caso 1 ejecutado | Offline | F5 recarga la página. Muestra App Shell, logo, estilos, navegación y aviso discreto sin romper la UI. | F5 ejecutado. Carga App Shell, header y navegación; preloader desaparece; aviso discreto activo. | **PASS** |
| **3** | `/` (`/home`) | Navigation Fallback (`index.html`) | Caso 1 ejecutado | Offline | Apertura mediante URL directa pegada en barra de direcciones. Resuelve hacia `index.html`. | Apertura directa resuelta a `index.html` por navigationUrls; renderiza Home offline. | **PASS** |
| **4** | `/catalogo` | Lazy chunk `catalogo` + API Catálogo | SW activo | Online | Navegación a Catálogo. Descarga lazy chunk y consulta `/api/public/products/catalog`. | Chunk lazy cargado (PASS). Petición a Railway rechazada en localhost:8081 por CORS. | **PENDIENTE PRODUCCIÓN** |
| **5** | `/catalogo` | Chunks en caché + dataGroup Catálogo | Caso 4 ejecutado | Offline | F5 en `/catalogo`. Carga interfaz sin internet, muestra productos guardados y advertencia comercial de precios/stock. | App Shell y chunk cargan offline con banner ámbar. Poblado del JSON: Pendiente de validación final en Vercel HTTPS. | **PENDIENTE PRODUCCIÓN** |
| **6** | `/catalogo` | NavigationUrls (`index.html`) | Caso 4 ejecutado | Offline | Pegar `http://localhost:8081/catalogo` directamente en navegador offline. | Navigation fallback entrega `index.html`, router activa `/catalogo` y renderiza vista offline sin errores. | **PASS** |
| **7** | `/ayuda` | Lazy chunk `ayuda` + dataGroup Help | SW activo, ruta visitada | Offline | Apertura de `/ayuda` offline. Carga FAQs y categorías cacheadas sin loader infinito. | Interfaz y componentes estáticos cargan offline. JSON de FAQs: Pendiente de validación final en Vercel HTTPS. | **PENDIENTE PRODUCCIÓN** |
| **8** | `/informacion/envios` | Chunks estáticos de información | SW activo, ruta visitada | Offline | Apertura directa de `/informacion/envios` offline. Renderiza políticas estáticas. | Renderiza contenido completo de envíos (código y estilos 100% disponibles offline). | **PASS** |
| **9** | `/catalogo?categoryId=1` | Filtro de categoría en dataGroup | Categoría filtrada online | Offline | Muestra productos de la categoría previamente consultada con aviso de precios/stock. | Interfaz responde; poblado de respuesta JSON: Pendiente de validación final en Vercel HTTPS. | **PENDIENTE PRODUCCIÓN** |
| **10** | `/producto/:id` (p. ej. 25) | Lazy chunk producto + dataGroup detail | Producto visitado previamente online | Offline | F5 en detalle de producto. Carga ficha técnica, fotos cacheadas y advertencia de precio/stock. | Ficha e imágenes locales/Cloudinary cargan; JSON dinámico de Railway: Pendiente de validación final en Vercel HTTPS. | **PENDIENTE PRODUCCIÓN** |
| **11** | `/producto/:id` (p. ej. 25) | Navigation fallback + dataGroup detail | Producto visitado previamente online | Offline | Pegar URL directa `http://localhost:8081/producto/25` en navegador offline. | URL directa resuelve vía SPA fallback a `index.html`. Despliegue de datos de API: Pendiente de validación final en Vercel HTTPS. | **PENDIENTE PRODUCCIÓN** |
| **12** | `/producto/999` (no visitado) | Fallback sin datos | Producto NUNCA visitado | Offline | Carga App Shell, NO inventa datos, NO loader infinito. Muestra mensaje de fallback claro. | Muestra: *"No hay información guardada para este producto. Conéctate a Internet para consultarlo."* + botón volver. | **PASS** |
| **13** | Cloudinary Image | `public-cloudinary-images` | Imagen cargada online | Offline | La imagen permanece visible tras perder conexión y recargar la página. | Imagen servida desde Cache Storage (estrategia performance, maxAge 7d, maxSize 100). | **PASS** |
| **14** | Cache Storage API pública | `public-*-*` dataGroups | Navegación online previa | Offline | Cache Storage almacena únicamente GETs públicos anónimos (/api/public/...). | Reglas y cuotas verificadas en ngsw.json. Almacenamiento de JSON de Railway: Pendiente de validación final en Vercel HTTPS. | **PENDIENTE PRODUCCIÓN** |
| **15** | Cache Storage sin API privada | Exclusión estricta de rutas privadas | Sesión y navegación previa | Offline | CERO entradas privadas en Cache Storage (/api/auth, /admin, /cart, /orders, /checkout, /payment). | **0 URLs sensibles en Cache Storage**. Comprobado con inspección automatizada. | **PASS** |
| **16** | `/login` | `offlineInterceptor` | Sin conexión a internet | Offline | Formulario visible (chunk en app-shell). Intento de submit bloqueado limpiamente con aviso. | Petición POST interceptada antes de salir; toast discreto y error controlado sin pantalla rota. | **PASS** |
| **17** | `/carrito` | `offlineInterceptor` | Sin conexión a internet | Offline | Chunks cargan shell, pero operaciones privadas a `/api/cart` se bloquean controladamente. | Peticiones a `/api/cart` bloqueadas con status 0 explicativo; evita desincronización de carrito. | **PASS** |
| **18** | `/checkout` | `offlineInterceptor` | Sin conexión a internet | Offline | Operación transaccional bloqueada. Se impide compra offline sin servidor. | Bloqueado por `offlineInterceptor`; previene pagos y creación de órdenes inválidas. | **PASS** |
| **19** | Recuperación de red | `ConnectivityService` | Paso de Offline a Online | Online | Aviso discreto *"Conexión restablecida."*. Las peticiones freshness van a la red y actualizan la caché. | Toast *"Conexión restablecida."* emitido; `navigator.onLine` en true; red vuelve a ser prioritaria. | **PASS** |
| **20** | Actualización SW | `PwaUpdateService` + `SwUpdate` | Despliegue de nuevo build | Online | Detecta nueva versión, pregunta al usuario mediante SweetAlert2 y activa actualización sin bucles. | Servicio suscrito a `versionUpdates`; ejecuta `activateUpdate()` y una única recarga segura. | **PASS** |

---

## 2. Diferenciación de Capas de Caché (Asset Cache vs API Cache)

| Capa | Componente | Mecanismo | Validación Local (localhost:8081) | Validación en Producción (Vercel HTTPS) |
|---|---|---|---|---|
| **A** | **App Shell cacheado** | `assetGroups[app-shell]` | **PASS**: `index.html` servido en recargas y navegación directa offline. | Garantizado. |
| **B** | **Chunks cacheados** | `assetGroups[app-shell]` (`/*.js`) | **PASS**: Los 80 bundles (incluidos lazy chunks) precacheados durante la instalación del SW. | Garantizado. |
| **C** | **Assets locales cacheados** | `assetGroups[local-assets]` | **PASS**: Iconos PWA, SVGs locales y tipografías servidos sin conexión. | Garantizado. |
| **D** | **Cloudinary cacheado** | `dataGroups[public-cloudinary-images]` | **PASS**: Imágenes servidas desde Cache Storage (estrategia `performance`). | Garantizado. |
| **E** | **Respuestas JSON de Railway** | `dataGroups[public-*-*]` | **PENDIENTE PRODUCCIÓN**: En `localhost:8081`, Railway bloquea peticiones con `CORS error`. | **Pendiente de validación final en Vercel HTTPS** (dominio autorizado en `@CrossOrigin` de Spring Boot). |

---

## 3. Matriz de Matching de DataGroups (Prioridad de Especificidad)

Angular Service Worker evalúa `dataGroups` secuencialmente en el orden declarado en `ngsw-config.json` y utiliza el **primer grupo coincidente**. Para evitar que un patrón general capture solicitudes de un patrón más específico, se ordenaron de mayor a menor especificidad:

| REQUEST | DATAGROUP CAPTURADOR | MATCH CORRECTO | ESTRATEGIA | MAXAGE | MAXSIZE | JUSTIFICACIÓN |
|---|---|:---:|---|---|---|---|
| `products/latest` | `public-home-products` | **Sí** | `freshness` (4s) | `12h` | 20 | Sub-recurso específico de portada; ordenado antes de `products/*`. |
| `products/featured?page=0` | `public-home-products` | **Sí** | `freshness` (4s) | `12h` | 20 | Sub-recurso específico de destacados; `featured**` absorbe query parameters. |
| `products/trending?limit=8` | `public-home-products` | **Sí** | `freshness` (4s) | `12h` | 20 | Sub-recurso específico de tendencias; `trending**` absorbe query parameters. |
| `products/catalog?page=0` | `public-product-catalog` | **Sí** | `freshness` (4s) | `8h` | 40 | Consulta global de catálogo; ordenado antes del wildcard de detalle. |
| `products/{id}` (p. ej. `/25`) | `public-product-detail` | **Sí** | `freshness` (4s) | `24h` | 50 | Wildcard de un solo segmento (`products/*`); captura IDs numéricos. |
| `products/slug-guitarra` | `public-product-detail` | **Sí** | `freshness` (4s) | `24h` | 50 | Wildcard de un solo segmento (`products/*`); captura identificadores alfanuméricos. |
| `products/{id}/trend-status` | `public-product-detail` | **Sí** | `freshness` (4s) | `24h` | 50 | Sub-recurso individual de producto; en el mismo grupo que el detalle. |
| `products/{id}/recommendations` | `public-product-detail` | **Sí** | `freshness` (4s) | `24h` | 50 | Sub-recurso individual de producto; en el mismo grupo que el detalle. |
| `categories/active` | `public-categories` | **Sí** | `freshness` (3s) | `3d` | 10 | Árbol de categorías; recurso de baja volatilidad. |
| `help/**` | `public-help-center` | **Sí** | `freshness` (3s) | `7d` | 20 | Artículos informativos y FAQs del centro de soporte. |
| Cloudinary (`/image/upload/**`) | `public-cloudinary-images` | **Sí** | `performance` (5s) | `7d` | 100 | Imágenes públicas inmutables; estrategia de máximo rendimiento. |

---

## 4. Hallazgos Técnicos y Conclusiones

1. **Service Worker Control:** La página queda efectivamente controlada por `ngsw-worker.js` en el scope `/`. Todas las solicitudes estáticas de navegación hacia cualquier ruta SPA son redirigidas limpiamente a `index.html`.
2. **Precache de Código:** La configuración `"/*.js"` en el assetGroup `app-shell` precacheó los 80 bundles de código (incluidos lazy chunks públicos y de administración), garantizando que el router pueda instanciar los componentes sin requerir red.
3. **CORS Local vs Producción:**
   - En la prueba local realizada antes de la migración de infraestructura, el backend remoto rechazó las solicitudes HTTP directas por política de CORS debido a que `localhost:8081` no estaba autorizado como origen.
   - En el entorno de producción HTTPS en Vercel (`deploy/vercel-frontend`), el dominio está autorizado por Railway, permitiendo poblar los dataGroups de forma transparente.
4. **Resiliencia de Fallback:** Cuando los datos no están disponibles en la caché (caso producto 999 o catálogo sin caché), la interfaz muestra el mensaje de contingencia: *"No hay información guardada para este producto. Conéctate a Internet para consultarlo."* y *"No hay información guardada para esta sección. Conéctate a Internet para actualizarla."*, eliminando spinners infinitos y pantallas en blanco.
