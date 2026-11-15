import { Injectable } from '@angular/core';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError, switchMap, take, timeout } from 'rxjs/operators';
import { PublicApiService } from './public-api.service';
import { PublicCategory, PublicProduct } from '../models/product.model';
import { ConnectivityService } from './connectivity.service';

export interface SearchBrandMatch {
  id: number;
  name: string;
  logoUrl?: string | null;
}

export interface SearchResult {
  products: PublicProduct[];
  categories: PublicCategory[];
  brands: SearchBrandMatch[];
  totalResults: number;
  executionTime: number;
  effectiveQuery?: string;
  suggestedTerm?: string | null;
  offline?: boolean;
  serverUnavailable?: boolean;
}

export interface NormalizedFrontendQuery {
  original: string;
  sanitized: string;
  normalizedOriginal: string;
  canonical: string;
  tokens: string[];
  typoCorrected: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class SearchService {
  private readonly MAX_QUERY_LENGTH = 100;
  private readonly MIN_QUERY_LENGTH = 2;
  private readonly AUTOCOMPLETE_PAGE_SIZE = 12;
  private readonly MAX_HISTORY_ITEMS = 8;
  private readonly HISTORY_STORAGE_KEY = 'search_history';

  private knownBrandsCache: Map<number, SearchBrandMatch> = new Map();

  private readonly SYNONYMS: Record<string, string> = {
    jaranas: 'jarana',
    guitarras: 'guitarra',
    microfonos: 'microfono',
    bajos: 'bajo',
    baterias: 'bateria',
    teclados: 'teclado',
    violines: 'violin',
    amplificadores: 'amplificador',
    pedales: 'pedal',
    trompetas: 'trompeta',
    saxofones: 'saxofon',
    flautas: 'flauta',
    ukuleles: 'ukulele',
    ukeleles: 'ukulele',
    ukelele: 'ukulele',
    quintas: 'quinta',
    huapangueras: 'huapanguera',
    cuerdas: 'cuerda',
    acusticas: 'acustica',
    acusticos: 'acustico',
    electricas: 'electrica',
    electricos: 'electrico',
    clasicas: 'clasica',
    clasicos: 'clasico',
  };

  private readonly TYPO_CORRECTIONS: Record<string, string> = {
    guitara: 'guitarra',
    gitarra: 'guitarra',
    gutarra: 'guitarra',
    guiatarra: 'guitarra',
    guitaras: 'guitarra',
    acustca: 'acustica',
    acustco: 'acustica',
    akustica: 'acustica',
    ascustica: 'acustica',
    yamha: 'yamaha',
    yamaa: 'yamaha',
    yamah: 'yamaha',
    yahama: 'yamaha',
    microfno: 'microfono',
    micrfono: 'microfono',
    microphono: 'microfono',
    eletrica: 'electrica',
    eletrico: 'electrico',
    elctrica: 'electrica',
    amplficador: 'amplificador',
    ampificador: 'amplificador',
    trompta: 'trompeta',
    saxfon: 'saxofon',
    violn: 'violin',
    violen: 'violin',
    tecldo: 'teclado',
    batria: 'bateria',
    fendr: 'fender',
    shur: 'shure',
    ibanz: 'ibanez',
    ibañez: 'ibanez',
  };

  private readonly DOMAIN_VOCABULARY: string[] = [
    'guitarra',
    'acustica',
    'clasica',
    'electrica',
    'electroacustica',
    'requinto',
    'jarana',
    'huapanguera',
    'quinta',
    'ukulele',
    'violin',
    'bajo',
    'bateria',
    'teclado',
    'piano',
    'amplificador',
    'microfono',
    'pedal',
    'trompeta',
    'saxofon',
    'flauta',
    'armonica',
    'acordeon',
    'cuerda',
    'cuerdas',
    'capotraste',
    'afinador',
    'estuche',
    'funda',
    'atril',
    'baquetas',
    'cable',
    'interfaz',
    'consola',
    'bocina',
    'yamaha',
    'fender',
    'shure',
    'ibanez',
    'casio',
    'roland',
    'gibson',
    'epiphone',
    'squier',
    'marshall',
    'boss',
    'cort',
    'takamine',
    'daddario',
    'ernie',
    'hohner',
    'pearl',
    'tama',
    'zildjian',
    'remo',
    'valenciana',
    'paracho',
    'castillo',
  ];

  constructor(
    private publicApiService: PublicApiService,
    private connectivityService: ConnectivityService
  ) {}

  /**
   * Precalienta la caché de categorías (2 min en PublicApiService) para que el autocompletado
   * no tenga que esperarlas. No se invoca al arranque, solo al enfocar el buscador.
   */
  public prefetchCategories(): void {
    this.publicApiService
      .getActiveCategories(true)
      .pipe(
        take(1),
        catchError(() => of([] as PublicCategory[]))
      )
      .subscribe();
  }

  /**
   * Normaliza un texto eliminando acentos/diacríticos y convirtiendo a minúsculas.
   */
  public normalizeText(value: string | null | undefined): string {
    if (!value) {
      return '';
    }
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Sanitiza defensivamente cualquier entrada del usuario (teclado, pegado o voz).
   * Elimina etiquetas HTML, caracteres de control y patrones de inyección,
   * tratando siempre la consulta como texto plano seguro.
   */
  public sanitizeSearchQuery(query: string): string {
    if (!query || typeof query !== 'string') {
      return '';
    }

    let sanitized = query
      // Eliminar etiquetas HTML completas o parciales (<script>, <img...>, etc.)
      .replace(/<[^>]*>?/gm, ' ')
      // Eliminar caracteres de control
      .replace(/[\x00-\x1F\x7F]/g, ' ');

    // Limpiar patrones comunes de pruebas de inyección SQL/XSS
    sanitized = this.removeSqlInjectionPatterns(sanitized);

    // Conservar únicamente letras, números, acentos, espacios y guiones/puntos/barras de modelos (ej. 4/4, C-40)
    sanitized = sanitized.replace(
      /[^a-zA-Z0-9\sáéíóúÁÉÍÓÚñÑüÜ\-_./]/g,
      ' '
    );

    // Normalizar espacios múltiples y recortar longitud máxima
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    if (sanitized.length > this.MAX_QUERY_LENGTH) {
      sanitized = sanitized.substring(0, this.MAX_QUERY_LENGTH).trim();
    }

    return sanitized;
  }

  /**
   * Analiza y normaliza la consulta de búsqueda, corrigiendo errores tipográficos leves
   * y separando tokens individuales para búsqueda multi-palabra.
   */
  public analyzeQuery(rawQuery: string): NormalizedFrontendQuery {
    const sanitized = this.sanitizeSearchQuery(rawQuery);
    const normalizedOriginal = this.normalizeText(sanitized);

    if (!normalizedOriginal) {
      return {
        original: rawQuery || '',
        sanitized: '',
        normalizedOriginal: '',
        canonical: '',
        tokens: [],
        typoCorrected: false,
      };
    }

    const rawWords = normalizedOriginal.split(' ').filter((w) => w.length > 0);
    const correctedWords: string[] = [];
    const tokens: string[] = [];
    let typoCorrected = false;

    for (const word of rawWords) {
      let current = word;
      if (this.TYPO_CORRECTIONS[current]) {
        current = this.TYPO_CORRECTIONS[current];
        typoCorrected = true;
      } else if (this.SYNONYMS[current]) {
        current = this.SYNONYMS[current];
      } else if (current.length >= 5) {
        const fuzzy = this.findClosestVocabularyWord(current);
        if (fuzzy && fuzzy !== current) {
          current = fuzzy;
          typoCorrected = true;
        }
      }
      correctedWords.push(current);
      if (current.length >= 2 && !tokens.includes(current)) {
        tokens.push(current);
      }
    }

    const canonical = correctedWords.join(' ');
    return {
      original: rawQuery,
      sanitized,
      normalizedOriginal,
      canonical,
      tokens,
      typoCorrected,
    };
  }

  /**
   * Alias de compatibilidad para componentes que invocan search(query).
   */
  search(query: string): Observable<SearchResult> {
    return this.searchProducts(query);
  }

  /**
   * Búsqueda agrupada para el autocompletado (Productos, Categorías, Marcas).
   *
   * Rendimiento:
   *  - 1 sola petición de productos (size 12), ranking local solo sobre esa página.
   *  - Categorías provienen de la caché en memoria de PublicApiService (2 min); si aún no
   *    están y tardan, se omiten tras 1.2 s en lugar de bloquear el autocompletado.
   *  - Marcas: no existe endpoint público; se reutilizan las vistas en productos ya cargados.
   *  - Fallback multi-palabra: SOLO si el backend respondió correctamente con 0 resultados
   *    (p. ej. backend antiguo), una única petición acotada (size 20).
   */
  searchProducts(query: string): Observable<SearchResult> {
    const startTime = performance.now();
    const analyzed = this.analyzeQuery(query);

    if (
      !analyzed.sanitized ||
      analyzed.sanitized.length < this.MIN_QUERY_LENGTH
    ) {
      return of({
        products: [],
        categories: [],
        brands: [],
        totalResults: 0,
        executionTime: 0,
      });
    }

    const searchKeyword = analyzed.canonical || analyzed.sanitized;
    const isMultiWord = analyzed.tokens.length >= 2;

    const categories$ = this.publicApiService.getActiveCategories(true).pipe(
      take(1),
      timeout({ first: 1200 }),
      catchError(() => of([] as PublicCategory[]))
    );

    const primaryCatalog$ = this.publicApiService
      .getCatalog({ keyword: searchKeyword, page: 0, size: this.AUTOCOMPLETE_PAGE_SIZE })
      .pipe(
        switchMap((response) => {
          const content = response?.content || [];
          if (content.length === 0 && isMultiWord && analyzed.tokens[0]) {
            return this.publicApiService
              .getCatalog({ keyword: analyzed.tokens[0], page: 0, size: 20 })
              .pipe(
                map((fallbackPage) => {
                  const filtered = this.filterByAllTokens(
                    fallbackPage?.content || [],
                    analyzed.tokens
                  );
                  return {
                    products: filtered,
                    totalElements: filtered.length as number | undefined,
                  };
                })
              );
          }
          return of({
            products: content,
            totalElements: response?.totalElements as number | undefined,
          });
        })
      );

    return forkJoin({
      catalogData: primaryCatalog$,
      allCategories: categories$,
    }).pipe(
      map(({ catalogData, allCategories }) => {
        const executionTime = performance.now() - startTime;
        const rawProducts = catalogData.products || [];

        this.registerBrandsFromProducts(rawProducts);

        const rankedProducts = this.dropDescriptionOnlyMatches(
          this.rankProducts(
            rawProducts,
            analyzed.normalizedOriginal,
            analyzed.canonical,
            analyzed.tokens
          ),
          analyzed.normalizedOriginal,
          analyzed.canonical,
          analyzed.tokens
        );

        const totalResults =
          typeof catalogData.totalElements === 'number' &&
          catalogData.totalElements > 0
            ? catalogData.totalElements
            : rankedProducts.length;

        return {
          products: rankedProducts,
          categories: this.matchCategories(allCategories || [], analyzed.tokens),
          brands: this.matchBrands(analyzed.tokens),
          totalResults,
          executionTime: Math.round(executionTime),
          effectiveQuery: searchKeyword,
          suggestedTerm: analyzed.typoCorrected ? analyzed.canonical : null,
          offline: false,
          serverUnavailable: false,
        };
      }),
      catchError(() => {
        const executionTime = performance.now() - startTime;
        const isOffline = !this.connectivityService.isOnline;
        return of({
          products: [],
          categories: [],
          brands: [],
          totalResults: 0,
          executionTime: Math.round(executionTime),
          effectiveQuery: searchKeyword,
          suggestedTerm: analyzed.typoCorrected ? analyzed.canonical : null,
          offline: isOffline,
          serverUnavailable: !isOffline,
        });
      })
    );
  }

  /**
   * Filtra productos verificando que todos los tokens de una consulta multi-palabra
   * aparezcan en nombre, sku, modelo, marca o categoría (la descripción NO cuenta),
   * con tolerancia aproximada Levenshtein <= 1.
   */
  public filterByAllTokens(
    products: PublicProduct[],
    tokens: string[]
  ): PublicProduct[] {
    if (!tokens || tokens.length === 0) {
      return products;
    }
    return products.filter((product) => {
      const haystack = this.normalizeText(
        [
          product.name,
          product.sku,
          product.model,
          product.brand?.name,
          product.category?.name,
        ]
          .filter(Boolean)
          .join(' ')
      );
      const haystackWords = haystack.split(' ');

      return tokens.every((token) => {
        if (haystack.includes(token)) {
          return true;
        }
        if (token.length >= 4) {
          return haystackWords.some(
            (hw) =>
              hw.length >= 4 &&
              Math.abs(hw.length - token.length) <= 1 &&
              hw[0] === token[0] &&
              this.levenshteinDistance(hw, token) <= 1
          );
        }
        return false;
      });
    });
  }

  /**
   * Nivel de relevancia de un producto (menor = más relevante):
   * 0 SKU exacto · 1 modelo exacto · 2 nombre exacto · 3 nombre inicia con el término ·
   * 4 nombre contiene frase/todos los tokens · 5 categoría · 6 marca ·
   * 7 combinación multi-token nombre/modelo/categoría/marca · 8 coincidencia parcial en nombre/modelo ·
   * 9 SOLO descripción · 10 sin coincidencia.
   */
  public scoreProduct(
    p: PublicProduct,
    normalizedOriginal: string,
    canonical: string,
    tokens: string[]
  ): number {
    const qOrig = normalizedOriginal || '';
    const qCanon = canonical || qOrig;
    const eff =
      tokens && tokens.length > 0
        ? tokens
        : qCanon.split(' ').filter((t) => t.length >= 2);

    const sku = this.normalizeText(p.sku);
    const name = this.normalizeText(p.name);
    const model = this.normalizeText(p.model);
    const brand = this.normalizeText(p.brand?.name);
    const category = this.normalizeText(p.category?.name);
    const description = this.normalizeText(p.description);

    if (sku && (sku === qOrig || sku === qCanon)) return 0;
    if (model && (model === qOrig || model === qCanon)) return 1;
    if (name && (name === qOrig || name === qCanon)) return 2;
    if (name && ((qOrig && name.startsWith(qOrig)) || (qCanon && name.startsWith(qCanon)))) return 3;
    if (
      name &&
      ((qCanon && name.includes(qCanon)) ||
        (eff.length > 0 && eff.every((t) => name.includes(t))))
    ) {
      return 4;
    }
    if (category && (category === qCanon || (qCanon && category.includes(qCanon)))) return 5;
    if (brand && (brand === qCanon || (qCanon && brand.includes(qCanon)))) return 6;
    if (eff.length > 1) {
      const fields = [name, model, category, brand].filter(Boolean);
      if (eff.every((t) => fields.some((f) => f.includes(t)))) return 7;
    }
    if (
      (name && eff.some((t) => name.includes(t))) ||
      (model && eff.some((t) => model.includes(t))) ||
      (category && eff.some((t) => t.length >= 3 && category.includes(t))) ||
      (brand && eff.some((t) => t.length >= 3 && brand.includes(t)))
    ) {
      return 8;
    }
    if (
      description &&
      ((qCanon && description.includes(qCanon)) ||
        eff.some((t) => description.includes(t)))
    ) {
      return 9;
    }
    return 10;
  }

  /**
   * Ordena por relevancia (ver `scoreProduct`) con desempate por stock, destacado e id.
   */
  public rankProducts(
    products: PublicProduct[],
    normalizedOriginal: string,
    canonical: string,
    tokens: string[]
  ): PublicProduct[] {
    if (!products || products.length <= 1) {
      return products || [];
    }
    const scored = products.map((p) => ({
      p,
      rank: this.scoreProduct(p, normalizedOriginal, canonical, tokens),
    }));
    scored.sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      const stockA = (a.p.stock ?? 0) > 0 ? 0 : 1;
      const stockB = (b.p.stock ?? 0) > 0 ? 0 : 1;
      if (stockA !== stockB) return stockA - stockB;
      const featA = a.p.featured ? 0 : 1;
      const featB = b.p.featured ? 0 : 1;
      if (featA !== featB) return featA - featB;
      return (a.p.id || 0) - (b.p.id || 0);
    });
    return scored.map((s) => s.p);
  }

  /**
   * Para el autocompletado: si existen coincidencias reales (nombre/modelo/sku/categoría/marca),
   * descarta los productos que solo coinciden por la descripción.
   */
  private dropDescriptionOnlyMatches(
    products: PublicProduct[],
    normalizedOriginal: string,
    canonical: string,
    tokens: string[]
  ): PublicProduct[] {
    const scored = products.map((p) => ({
      p,
      rank: this.scoreProduct(p, normalizedOriginal, canonical, tokens),
    }));
    const hasStrong = scored.some((s) => s.rank < 9);
    return hasStrong ? scored.filter((s) => s.rank < 9).map((s) => s.p) : products;
  }

  /** Raíz simple para comparar singular/plural en español (cuerdas ~ cuerda, violines ~ violin). */
  private stem(word: string): string {
    if (word.length > 5 && word.endsWith('es')) return word.slice(0, -2);
    if (word.length > 3 && word.endsWith('s')) return word.slice(0, -1);
    return word;
  }

  /**
   * Una entidad (categoría/marca) coincide solo si TODOS los tokens de la consulta
   * corresponden al NOMBRE de la entidad (por palabra, tolerando plural).
   * Nunca se infiere por los productos encontrados ni por su descripción.
   */
  private entityNameMatches(name: string, tokens: string[]): boolean {
    const normName = this.normalizeText(name);
    if (!normName || tokens.length === 0) return false;
    const nameWords = normName.split(' ').map((w) => this.stem(w));
    return tokens.every((token) => {
      if (token.length < 3) return false;
      const t = this.stem(token);
      return nameWords.some((w) => w === t || (t.length >= 4 && w.startsWith(t)));
    });
  }

  private matchCategories(
    allCategories: PublicCategory[],
    tokens: string[]
  ): PublicCategory[] {
    return allCategories
      .filter((cat) => this.entityNameMatches(cat.name, tokens))
      .slice(0, 3);
  }

  private matchBrands(tokens: string[]): SearchBrandMatch[] {
    const results: SearchBrandMatch[] = [];
    this.knownBrandsCache.forEach((br) => {
      if (results.length < 3 && this.entityNameMatches(br.name, tokens)) {
        results.push(br);
      }
    });
    return results;
  }

  private registerBrandsFromProducts(products: PublicProduct[]): void {
    for (const p of products) {
      if (p.brand && p.brand.id && p.brand.name) {
        this.knownBrandsCache.set(p.brand.id, {
          id: p.brand.id,
          name: p.brand.name,
          logoUrl: p.brand.logoUrl,
        });
      }
    }
  }

  private findClosestVocabularyWord(token: string): string | null {
    if (this.DOMAIN_VOCABULARY.includes(token)) {
      return token;
    }
    const maxDist = token.length >= 8 ? 2 : 1;
    let best: string | null = null;
    let bestDist = maxDist + 1;

    for (const candidate of this.DOMAIN_VOCABULARY) {
      if (Math.abs(candidate.length - token.length) > maxDist) {
        continue;
      }
      if (candidate[0] !== token[0]) {
        continue;
      }
      const dist = this.levenshteinDistance(token, candidate);
      if (dist < bestDist) {
        bestDist = dist;
        best = candidate;
      }
    }
    return best;
  }

  private levenshteinDistance(a: string, b: string): number {
    const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
      Array(b.length + 1).fill(0)
    );
    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    return dp[a.length][b.length];
  }

  private removeSqlInjectionPatterns(input: string): string {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|DECLARE)\b)/gi,
      /(--|;|\/\*|\*\/|xp_|sp_)/gi,
      /('|"|`|<|>|%|\*)/g,
    ];

    let cleaned = input;
    sqlPatterns.forEach((pattern) => {
      cleaned = cleaned.replace(pattern, ' ');
    });

    return cleaned;
  }

  /**
   * Valida si el query sanitizado alcanza la longitud mínima para buscar.
   */
  public isValidSearchQuery(query: string): boolean {
    const sanitized = this.sanitizeSearchQuery(query);
    return (
      sanitized.length >= this.MIN_QUERY_LENGTH &&
      sanitized.length <= this.MAX_QUERY_LENGTH
    );
  }

  /**
   * Guarda una búsqueda reciente válida y sanitizada en localStorage (máximo 8).
   */
  saveToSearchHistory(query: string): void {
    const sanitized = this.sanitizeSearchQuery(query);
    if (!sanitized || sanitized.length < this.MIN_QUERY_LENGTH) {
      return;
    }

    try {
      const history = this.getSearchHistory();
      const updated = [
        sanitized,
        ...history.filter(
          (item) => item.toLowerCase() !== sanitized.toLowerCase()
        ),
      ].slice(0, this.MAX_HISTORY_ITEMS);
      localStorage.setItem(this.HISTORY_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignorar si localStorage no está disponible
    }
  }

  /**
   * Obtiene el historial de búsquedas recientes (máx. 8 elementos).
   */
  getSearchHistory(): string[] {
    try {
      const history = localStorage.getItem(this.HISTORY_STORAGE_KEY);
      if (!history) return [];
      const parsed = JSON.parse(history);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item) => typeof item === 'string' && item.trim().length >= 2)
        .slice(0, this.MAX_HISTORY_ITEMS);
    } catch {
      return [];
    }
  }

  /**
   * Elimina un término individual del historial de búsquedas.
   */
  removeFromSearchHistory(term: string): void {
    try {
      const history = this.getSearchHistory().filter(
        (item) => item.toLowerCase() !== term.toLowerCase()
      );
      localStorage.setItem(this.HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch {
      // Ignorar errores de almacenamiento
    }
  }

  /**
   * Limpia completamente el historial de búsquedas recientes.
   */
  clearSearchHistory(): void {
    try {
      localStorage.removeItem(this.HISTORY_STORAGE_KEY);
    } catch {
      // Ignorar errores de almacenamiento
    }
  }
}
