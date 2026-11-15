import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { SearchService } from './search.service';

export interface CatalogSearchOptions {
  /** Conserva categoryId/brandId de la URL actual (solo aplica si ya estamos en /catalogo). */
  keepFilters?: boolean;
  /** Reemplaza la entrada del historial (útil para búsqueda mientras se escribe). */
  replaceUrl?: boolean;
}

/**
 * Punto ÚNICO de navegación de búsqueda del catálogo. La URL (`/catalogo?search=...`)
 * es la fuente de verdad: header, buscador del catálogo y chips solo llaman a estos métodos.
 *
 *  - search(term):    aplicar término de búsqueda.
 *  - clearSearch():   X del buscador / chip → quita ÚNICAMENTE `search`, conserva otros filtros.
 *  - clearAll():      "Limpiar todo" → /catalogo sin parámetros.
 */
@Injectable({ providedIn: 'root' })
export class CatalogSearchNavService {
  static readonly SEARCH_PARAM = 'search';
  /** Parámetro legado, aún leído por compatibilidad con enlaces antiguos. */
  static readonly LEGACY_SEARCH_PARAM = 'busqueda';

  constructor(
    private router: Router,
    private searchService: SearchService
  ) {}

  isOnCatalog(url: string = this.router.url): boolean {
    const segments =
      this.router.parseUrl(url).root.children['primary']?.segments ?? [];
    return segments.length > 0 && segments[0].path === 'catalogo';
  }

  getSearchFromUrl(url: string = this.router.url): string {
    const params = this.router.parseUrl(url).queryParams;
    const raw =
      params[CatalogSearchNavService.SEARCH_PARAM] ??
      params[CatalogSearchNavService.LEGACY_SEARCH_PARAM] ??
      '';
    return typeof raw === 'string' ? raw : '';
  }

  hasSearchInUrl(): boolean {
    return this.getSearchFromUrl().length > 0;
  }

  search(term: string, options: CatalogSearchOptions = {}): Promise<boolean> {
    const clean = this.searchService.sanitizeSearchQuery(term);
    if (clean.length < 2) {
      return clean.length === 0 ? this.clearSearch() : Promise.resolve(false);
    }
    const onCatalog = this.isOnCatalog();
    const queryParams: Record<string, string | null> = {
      [CatalogSearchNavService.SEARCH_PARAM]: clean,
      [CatalogSearchNavService.LEGACY_SEARCH_PARAM]: null,
      page: null,
    };
    if (!options.keepFilters) {
      queryParams['categoryId'] = null;
      queryParams['brandId'] = null;
    }
    return this.router.navigate(['/catalogo'], {
      queryParams,
      queryParamsHandling: onCatalog ? 'merge' : '',
      replaceUrl: !!options.replaceUrl,
    });
  }

  clearSearch(): Promise<boolean> {
    if (!this.isOnCatalog() || !this.hasSearchInUrl()) {
      return Promise.resolve(true);
    }
    return this.router.navigate(['/catalogo'], {
      queryParams: {
        [CatalogSearchNavService.SEARCH_PARAM]: null,
        [CatalogSearchNavService.LEGACY_SEARCH_PARAM]: null,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  clearAll(): Promise<boolean> {
    return this.router.navigate(['/catalogo'], { queryParams: {} });
  }

  /** Aplica categoría y/o marca conservando el estado de URL (sin término de búsqueda). */
  filterBy(filters: { categoryId?: number; brandId?: number }): Promise<boolean> {
    return this.router.navigate(['/catalogo'], {
      queryParams: {
        categoryId: filters.categoryId ?? null,
        brandId: filters.brandId ?? null,
        [CatalogSearchNavService.SEARCH_PARAM]: null,
        [CatalogSearchNavService.LEGACY_SEARCH_PARAM]: null,
        page: null,
      },
    });
  }
}
