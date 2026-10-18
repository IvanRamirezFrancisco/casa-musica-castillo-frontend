import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, of, throwError, timer } from 'rxjs';
import { catchError, finalize, retry, shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  PublicProduct,
  PublicCategory,
  SpringPage,
  ProductRecommendation,
  PublicTrendingProduct,
  ProductTrendStatus
} from '../models/product.model';

/**
 * Servicio Angular para consumir la API pública del Storefront.
 *
 * Todos los métodos apuntan a `/api/public/...` — rutas que NO requieren
 * autenticación JWT (permitAll() en el backend).
 *
 * Nunca incluir el token Authorization en estas llamadas.
 */
@Injectable({ providedIn: 'root' })
export class PublicApiService {
  private http = inject(HttpClient);

  private readonly BASE = `${environment.apiUrl}/public`;
  private readonly PRODUCTS = `${this.BASE}/products`;
  private readonly CATEGORIES = `${this.BASE}/categories`;

  /**
   * Caché en memoria de snapshots de productos ya recibidos desde el catálogo,
   * home o detalle. Permite mostrar el detalle de forma instantánea al navegar
   * desde /catalogo -> /producto/:id mientras se revalida en segundo plano.
   */
  private readonly productSnapshots = new Map<number, PublicProduct>();

  /** Caché ligera en memoria para categorías activas y peticiones en vuelo */
  private readonly categoriesCache = new Map<boolean, { data: PublicCategory[]; expiresAt: number }>();
  private readonly categoriesInFlight = new Map<boolean, Observable<PublicCategory[]>>();

  /** Deduplicación de peticiones de catálogo en vuelo con los mismos parámetros */
  private readonly catalogInFlight = new Map<string, Observable<SpringPage<PublicProduct>>>();

  /**
   * Devuelve el snapshot en memoria de un producto si ya fue cargado en la sesión
   * (por ejemplo, en /catalogo o /home).
   */
  getCachedProductSnapshot(id: number): PublicProduct | null {
    return this.productSnapshots.get(id) ?? null;
  }

  private rememberProduct(product: PublicProduct | null | undefined): void {
    if (product && typeof product.id === 'number') {
      this.productSnapshots.set(product.id, product);
    }
  }

  private rememberProducts(products: PublicProduct[] | null | undefined): void {
    if (!Array.isArray(products)) return;
    for (const p of products) {
      this.rememberProduct(p);
    }
  }

  /**
   * Reintento controlado (1 vez con backoff de 1.4s) únicamente para errores
   * transitorios de red o arranque en frío de Render (status 0 online, 502, 503, 504).
   * Nunca reintenta en 404, 400 ni cuando el navegador está offline.
   */
  private retryOnTransientServerWake<T>() {
    return retry<T>({
      count: 1,
      delay: (error: unknown) => {
        const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
        if (!isOnline) {
          return throwError(() => error);
        }
        if (error instanceof HttpErrorResponse) {
          const isTransient =
            error.status === 0 ||
            error.status === 502 ||
            error.status === 503 ||
            error.status === 504;
          if (isTransient) {
            return timer(1400);
          }
        }
        return throwError(() => error);
      }
    });
  }

  // ── Productos ───────────────────────────────────────────────────────────────

  /**
   * GET /api/public/products/latest
   * Devuelve los últimos 8 productos activos.
   */
  getLatestProducts(): Observable<PublicProduct[]> {
    return this.http.get<PublicProduct[]>(`${this.PRODUCTS}/latest`).pipe(
      this.retryOnTransientServerWake(),
      tap(products => this.rememberProducts(products))
    );
  }

  /**
   * GET /api/public/products/featured
   * Devuelve productos destacados paginados.
   */
  getFeaturedProducts(page = 0, size = 12): Observable<SpringPage<PublicProduct>> {
    const params = new HttpParams()
      .set('page', page)
      .set('size', size);
    return this.http.get<SpringPage<PublicProduct>>(`${this.PRODUCTS}/featured`, { params }).pipe(
      this.retryOnTransientServerWake(),
      tap(res => this.rememberProducts(res?.content))
    );
  }

  /**
   * GET /api/public/products/catalog
   * Catálogo completo con filtros opcionales.
   *
   * @param keyword    texto de búsqueda (opcional)
   * @param categoryId filtro por categoría (opcional)
   * @param brandId    filtro por marca (opcional)
   * @param page       página 0-indexed (default 0)
   * @param size       tamaño de página (default 12, máx 50 en el backend)
   */
  getCatalog(options: {
    keyword?:    string;
    categoryId?: number;
    brandId?:    number;
    page?:       number;
    size?:       number;
    sortBy?:     'featured' | 'price_asc' | 'price_desc' | 'name_asc';
  } = {}): Observable<SpringPage<PublicProduct>> {
    let params = new HttpParams()
      .set('page', options.page ?? 0)
      .set('size', options.size ?? 12)
      .set('sortBy', options.sortBy ?? 'featured');

    if (options.keyword?.trim()) {
      params = params.set('keyword', options.keyword.trim());
    }
    if (options.categoryId != null) {
      params = params.set('categoryId', options.categoryId);
    }
    if (options.brandId != null) {
      params = params.set('brandId', options.brandId);
    }

    const cacheKey = params.toString();
    const existingInFlight = this.catalogInFlight.get(cacheKey);
    if (existingInFlight) {
      return existingInFlight;
    }

    const request$ = this.http.get<SpringPage<PublicProduct>>(`${this.PRODUCTS}/catalog`, { params }).pipe(
      this.retryOnTransientServerWake(),
      tap(res => this.rememberProducts(res?.content)),
      finalize(() => this.catalogInFlight.delete(cacheKey)),
      shareReplay(1)
    );

    this.catalogInFlight.set(cacheKey, request$);
    return request$;
  }

  /**
   * GET /api/public/products/{id}
   * Detalle de un producto activo. El backend retorna 404 si no existe
   * o está inactivo.
   */
  getProductById(id: number): Observable<PublicProduct> {
    return this.http.get<PublicProduct>(`${this.PRODUCTS}/${id}`).pipe(
      this.retryOnTransientServerWake(),
      tap(product => this.rememberProduct(product)),
      catchError(err => {
        // Si hubo un fallo transitorio de red o servidor y ya tenemos el snapshot completo en memoria
        // (p. ej. cargado segundos antes en /catalogo), devolvemos el snapshot para no romper la navegación.
        const snapshot = this.productSnapshots.get(id);
        if (snapshot && err instanceof HttpErrorResponse && err.status !== 404) {
          return of(snapshot);
        }
        return throwError(() => err);
      })
    );
  }

  /**
   * GET /api/public/products/trending
   * Devuelve los productos en tendencia basados en el pronóstico de demanda.
   */
  getTrendingProducts(limit = 8): Observable<PublicTrendingProduct[]> {
    const params = new HttpParams().set('limit', limit);
    return this.http.get<PublicTrendingProduct[]>(`${this.PRODUCTS}/trending`, { params }).pipe(
      catchError(() => of([]))
    );
  }

  /**
   * GET /api/public/products/{id}/trend-status
   * Verifica si un producto está en tendencia (endpoint secundario no bloqueante).
   */
  getProductTrendStatus(id: number): Observable<ProductTrendStatus> {
    return this.http.get<ProductTrendStatus>(`${this.PRODUCTS}/${id}/trend-status`).pipe(
      catchError(() => of({ productId: id, trending: false, label: null, reason: null }))
    );
  }

  // ── Categorías ──────────────────────────────────────────────────────────────

  /**
   * GET /api/public/categories/active
   * Categorías activas con deduplicación en vuelo y caché en memoria de 2 minutos.
   *
   * @param withProducts si true, solo retorna categorías con ≥1 producto activo
   */
  getActiveCategories(withProducts = false): Observable<PublicCategory[]> {
    const now = Date.now();
    const cached = this.categoriesCache.get(withProducts);
    if (cached && cached.expiresAt > now) {
      return of(cached.data);
    }

    const inFlight = this.categoriesInFlight.get(withProducts);
    if (inFlight) {
      return inFlight;
    }

    const params = new HttpParams().set('withProducts', withProducts);
    const request$ = this.http.get<PublicCategory[]>(`${this.CATEGORIES}/active`, { params }).pipe(
      this.retryOnTransientServerWake(),
      tap(categories => {
        if (Array.isArray(categories) && categories.length > 0) {
          this.categoriesCache.set(withProducts, {
            data: categories,
            expiresAt: Date.now() + 120_000
          });
        }
      }),
      catchError(err => {
        if (cached?.data?.length) {
          return of(cached.data);
        }
        return throwError(() => err);
      }),
      finalize(() => this.categoriesInFlight.delete(withProducts)),
      shareReplay(1)
    );

    this.categoriesInFlight.set(withProducts, request$);
    return request$;
  }

  // ── Recomendaciones ──────────────────────────────────────────────────────────

  /**
   * GET /api/public/products/{id}/recommendations
   * Devuelve productos complementarios usando reglas de asociación (Propuesta 2).
   * Endpoint secundario no bloqueante: si falla, degrada a lista vacía.
   */
  getRecommendations(productId: number): Observable<ProductRecommendation[]> {
    return this.http.get<ProductRecommendation[]>(`${this.PRODUCTS}/${productId}/recommendations`).pipe(
      catchError(() => of([]))
    );
  }
}
