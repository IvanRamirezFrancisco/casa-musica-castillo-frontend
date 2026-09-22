import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { Product, ProductCategory, ProductFilter, ProductSort, ProductSearchResponse, ProductReview, ProductQuestion } from '../models/product.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private http = inject(HttpClient);
  private readonly ADMIN_API_URL = `${environment.apiUrl}/admin/products`;
  
  private products: Product[] = [
    // Guitarras
    {
      id: '1',
      sku: 'FEN-STRAT-01',
      name: 'Guitarra Eléctrica Fender Stratocaster',
      description: 'Guitarra eléctrica clásica Fender Stratocaster con sonido auténtico y versatilidad excepcional. Perfecta para todos los estilos musicales.',
      shortDescription: 'Guitarra eléctrica profesional con sonido clásico',
      price: 899.99,
      originalPrice: 1099.99,
      discount: 18,
      images: ['/https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_400/v1782840424/Dise%C3%B1o_sin_t%C3%ADtulo_4_xruh6t.png', '/https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_400/v1782840424/Dise%C3%B1o_sin_t%C3%ADtulo_4_xruh6t.png', '/https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_400/v1782840424/Dise%C3%B1o_sin_t%C3%ADtulo_4_xruh6t.png'],
      category: { id: 'guitars', name: 'Guitarras', slug: 'guitarras', icon: 'music_note' },
      brand: 'Fender',
      inStock: true,
      stockQuantity: 15,
      rating: 4.8,
      reviewCount: 124,
      specifications: [
        { name: 'Cuerpo', value: 'Aliso' },
        { name: 'Mástil', value: 'Arce' },
        { name: 'Trastes', value: '22' },
        { name: 'Pastillas', value: '3 Single Coil' }
      ],
      tags: ['eléctrica', 'profesional', 'versátil'],
      featured: true,
      isNew: false,
      warranty: '1 Año',
      installmentInfo: {
        months: 18,
        monthlyPayment: 49.99
      },
      relatedProducts: ['2', '3', '5'],
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-15')
    },
    {
      id: '2',
      sku: 'TAY-814CE',
      name: 'Guitarra Acústica Taylor 814ce',
      description: 'Guitarra acústica de alta gama Taylor con electrificación y sonido excepcional. Ideal para presentaciones en vivo y grabaciones.',
      shortDescription: 'Guitarra acústica premium con electrificación',
      price: 3299.99,
      originalPrice: 3799.99,
      discount: 13,
      images: ['/https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_400/v1782840424/Dise%C3%B1o_sin_t%C3%ADtulo_4_xruh6t.png', '/https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_400/v1782840424/Dise%C3%B1o_sin_t%C3%ADtulo_4_xruh6t.png', '/https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_400/v1782840424/Dise%C3%B1o_sin_t%C3%ADtulo_4_xruh6t.png'],
      category: { id: 'guitars', name: 'Guitarras', slug: 'guitarras', icon: 'music_note' },
      brand: 'Taylor',
      inStock: true,
      stockQuantity: 8,
      rating: 4.9,
      reviewCount: 89,
      specifications: [
        { name: 'Tapa', value: 'Abeto de Sitka sólido' },
        { name: 'Aros y Fondo', value: 'Palisandro del Este Indio sólido' },
        { name: 'Mástil', value: 'Caoba tropical' },
        { name: 'Electrificación', value: 'Taylor ES2' }
      ],
      tags: ['acústica', 'premium', 'electrificada'],
      featured: true,
      isNew: false,
      warranty: '2 Años',
      installmentInfo: {
        months: 24,
        monthlyPayment: 137.49
      },
      relatedProducts: ['1', '4', '5'],
      createdAt: new Date('2024-01-20'),
      updatedAt: new Date('2024-01-20')
    },
    // Pianos
    {
      id: '3',
      sku: 'YAM-P125',
      name: 'Piano Digital Yamaha P-125',
      description: 'Piano digital portátil con teclas contrapesadas y sonidos auténticos de piano de cola. Perfecto para principiantes y profesionales.',
      shortDescription: 'Piano digital portátil de 88 teclas',
      price: 649.99,
      originalPrice: 749.99,
      discount: 13,
      images: ['/https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_400/v1782840424/Dise%C3%B1o_sin_t%C3%ADtulo_4_xruh6t.png', '/https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_400/v1782840424/Dise%C3%B1o_sin_t%C3%ADtulo_4_xruh6t.png', '/https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_400/v1782840424/Dise%C3%B1o_sin_t%C3%ADtulo_4_xruh6t.png'],
      category: { id: 'pianos', name: 'Pianos', slug: 'pianos', icon: 'piano' },
      brand: 'Yamaha',
      inStock: true,
      stockQuantity: 12,
      rating: 4.7,
      reviewCount: 156,
      specifications: [
        { name: 'Teclas', value: '88 teclas contrapesadas' },
        { name: 'Sonidos', value: '24 voces' },
        { name: 'Polifonía', value: '192 notas' },
        { name: 'Conectividad', value: 'USB, MIDI' }
      ],
      tags: ['digital', 'portátil', '88-teclas'],
      featured: false,
      isNew: true,
      warranty: '1 Año',
      installmentInfo: {
        months: 12,
        monthlyPayment: 54.16
      },
      relatedProducts: ['4', '1', '2'],
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-02-01')
    },
    // Baterías
    {
      id: '4',
      sku: 'PRL-EXX725S',
      name: 'Batería Pearl Export EXX725S',
      description: 'Set completo de batería Pearl Export con 5 tambores y herrajes incluidos. Excelente calidad para principiantes y intermedios.',
      shortDescription: 'Set completo de batería de 5 piezas',
      price: 799.99,
      originalPrice: 899.99,
      discount: 11,
      images: ['/https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_400/v1782840424/Dise%C3%B1o_sin_t%C3%ADtulo_4_xruh6t.png', '/https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_400/v1782840424/Dise%C3%B1o_sin_t%C3%ADtulo_4_xruh6t.png', '/https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_400/v1782840424/Dise%C3%B1o_sin_t%C3%ADtulo_4_xruh6t.png'],
      category: { id: 'drums', name: 'Baterías', slug: 'baterias', icon: 'radio' },
      brand: 'Pearl',
      inStock: true,
      stockQuantity: 6,
      rating: 4.6,
      reviewCount: 73,
      specifications: [
        { name: 'Configuración', value: '5 piezas' },
        { name: 'Bombo', value: '22" x 18"' },
        { name: 'Tarola', value: '14" x 5.5"' },
        { name: 'Toms', value: '10", 12", 16"' }
      ],
      tags: ['acústica', 'completa', 'principiantes'],
      featured: false,
      isNew: false,
      warranty: '1 Año',
      installmentInfo: {
        months: 18,
        monthlyPayment: 44.44
      },
      relatedProducts: ['3', '5', '1'],
      createdAt: new Date('2024-01-25'),
      updatedAt: new Date('2024-01-25')
    },
    // Bajos
    {
      id: '5',
      sku: 'MM-STINGRAY',
      name: 'Bajo Eléctrico Music Man StingRay',
      description: 'Bajo eléctrico de 4 cuerdas con sonido distintivo y construcción de alta calidad. Utilizado por profesionales en todo el mundo.',
      shortDescription: 'Bajo eléctrico profesional de 4 cuerdas',
      price: 1899.99,
      originalPrice: 2199.99,
      discount: 14,
      images: ['/https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_400/v1782840424/Dise%C3%B1o_sin_t%C3%ADtulo_4_xruh6t.png', '/https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_400/v1782840424/Dise%C3%B1o_sin_t%C3%ADtulo_4_xruh6t.png', '/https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_400/v1782840424/Dise%C3%B1o_sin_t%C3%ADtulo_4_xruh6t.png'],
      category: { id: 'bass', name: 'Bajos', slug: 'bajos', icon: 'queue_music' },
      brand: 'Music Man',
      inStock: true,
      stockQuantity: 4,
      rating: 4.9,
      reviewCount: 45,
      specifications: [
        { name: 'Cuerdas', value: '4' },
        { name: 'Cuerpo', value: 'Fresno del pantano' },
        { name: 'Mástil', value: 'Arce' },
        { name: 'Pastilla', value: 'Humbucker activa' }
      ],
      tags: ['eléctrico', 'profesional', '4-cuerdas'],
      featured: true,
      isNew: false,
      warranty: '2 Años',
      installmentInfo: {
        months: 24,
        monthlyPayment: 79.16
      },
      relatedProducts: ['1', '2', '4'],
      createdAt: new Date('2024-01-18'),
      updatedAt: new Date('2024-01-18')
    }
  ];

  private categories: ProductCategory[] = [
    { id: 'guitars', name: 'Guitarras', slug: 'guitarras', icon: 'music_note' },
    { id: 'pianos', name: 'Pianos', slug: 'pianos', icon: 'piano' },
    { id: 'drums', name: 'Baterías', slug: 'baterias', icon: 'radio' },
    { id: 'bass', name: 'Bajos', slug: 'bajos', icon: 'queue_music' },
    { id: 'wind', name: 'Vientos', slug: 'vientos', icon: 'wind_power' },
    { id: 'accessories', name: 'Accesorios', slug: 'accesorios', icon: 'settings' }
  ];

  constructor() { }

  // Obtener todos los productos
  getProducts(): Observable<Product[]> {
    return of(this.products).pipe(delay(500));
  }

  // Obtener producto por ID
  getProduct(id: string): Observable<Product | undefined> {
    const product = this.products.find(p => p.id === id);
    return of(product).pipe(delay(300));
  }

  // Buscar productos con filtros
  searchProducts(
    filter: ProductFilter = {},
    sort: ProductSort = { field: 'name', direction: 'asc' },
    page: number = 1,
    limit: number = 12
  ): Observable<ProductSearchResponse> {
    let filteredProducts = [...this.products];

    // Aplicar filtros
    if (filter.search) {
      const searchTerm = filter.search.toLowerCase();
      filteredProducts = filteredProducts.filter(p =>
        p.name.toLowerCase().includes(searchTerm) ||
        p.description.toLowerCase().includes(searchTerm) ||
        p.brand.toLowerCase().includes(searchTerm) ||
        p.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      );
    }

    if (filter.categories && filter.categories.length > 0) {
      filteredProducts = filteredProducts.filter(p =>
        filter.categories!.includes(p.category.id)
      );
    }

    if (filter.brands && filter.brands.length > 0) {
      filteredProducts = filteredProducts.filter(p =>
        filter.brands!.includes(p.brand)
      );
    }

    if (filter.priceRange) {
      filteredProducts = filteredProducts.filter(p =>
        p.price >= filter.priceRange!.min && p.price <= filter.priceRange!.max
      );
    }

    if (filter.inStockOnly) {
      filteredProducts = filteredProducts.filter(p => p.inStock);
    }

    if (filter.rating) {
      filteredProducts = filteredProducts.filter(p => p.rating >= filter.rating!);
    }

    // Aplicar ordenamiento
    filteredProducts.sort((a, b) => {
      let comparison = 0;
      
      switch (sort.field) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'price':
          comparison = a.price - b.price;
          break;
        case 'rating':
          comparison = a.rating - b.rating;
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }

      return sort.direction === 'asc' ? comparison : -comparison;
    });

    // Aplicar paginación
    const total = filteredProducts.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const paginatedProducts = filteredProducts.slice(startIndex, startIndex + limit);

    const response: ProductSearchResponse = {
      products: paginatedProducts,
      total,
      page,
      limit,
      totalPages,
      filters: {
        categories: this.categories,
        brands: Array.from(new Set(this.products.map(p => p.brand))),
        priceRange: {
          min: Math.min(...this.products.map(p => p.price)),
          max: Math.max(...this.products.map(p => p.price))
        }
      }
    };

    return of(response).pipe(delay(800));
  }

  // Obtener productos destacados
  getFeaturedProducts(): Observable<Product[]> {
    const featured = this.products.filter(p => p.featured);
    return of(featured).pipe(delay(400));
  }

  // Obtener productos nuevos
  getNewProducts(): Observable<Product[]> {
    const newProducts = this.products.filter(p => p.isNew);
    return of(newProducts).pipe(delay(400));
  }

  // Obtener categorías
  getCategories(): Observable<ProductCategory[]> {
    return of(this.categories).pipe(delay(200));
  }

  // Obtener productos por categoría
  getProductsByCategory(categoryId: string): Observable<Product[]> {
    const categoryProducts = this.products.filter(p => p.category.id === categoryId);
    return of(categoryProducts).pipe(delay(500));
  }

  // Obtener productos relacionados
  getRelatedProducts(productId: string): Observable<Product[]> {
    const product = this.products.find(p => p.id === productId);
    if (!product || !product.relatedProducts) {
      return of([]);
    }
    const related = this.products.filter(p => product.relatedProducts!.includes(p.id));
    return of(related).pipe(delay(400));
  }

  // Obtener reseñas de un producto (temporal - datos mock)
  getProductReviews(productId: string): Observable<ProductReview[]> {
    const reviewsMap: { [key: string]: ProductReview[] } = {
      '1': [ // Fender Stratocaster
        {
          id: 'r1-1',
          productId: '1',
          userId: 'u1',
          userName: 'Carlos Rodríguez',
          rating: 5,
          title: '¡El clásico nunca falla! Sonido legendario',
          comment: 'Compré esta Stratocaster hace 3 meses y no puedo estar más feliz. El sonido es cristalino, las pastillas single coil son versátiles y la ergonomía es perfecta. La uso para rock, blues y funk. El acabado es impecable y la relación calidad-precio es excelente. Totalmente recomendada tanto para profesionales como para estudiantes avanzados.',
          helpful: 89,
          notHelpful: 3,
          verified: true,
          createdAt: new Date('2024-01-20')
        },
        {
          id: 'r1-2',
          productId: '1',
          userId: 'u2',
          userName: 'María González',
          rating: 5,
          title: 'Mejor que mi guitarra anterior de gama alta',
          comment: 'Tuve una Gibson Les Paul por años, pero esta Strat me conquistó. El mástil es súper cómodo, los cambios de tono son suaves y el tremolo funciona perfectamente. La uso en presentaciones en vivo y nunca me ha fallado. El único detalle es que las cuerdas de fábrica no son las mejores, pero con unas Ernie Ball suena espectacular.',
          helpful: 62,
          notHelpful: 5,
          verified: true,
          createdAt: new Date('2024-02-05')
        },
        {
          id: 'r1-3',
          productId: '1',
          userId: 'u3',
          userName: 'Roberto Martínez',
          rating: 4,
          title: 'Excelente, pero requiere ajuste inicial',
          comment: 'Gran guitarra, el sonido es auténtico Fender. Sin embargo, tuve que llevarla a hacer un setup profesional porque venía con la acción un poco alta. Después del ajuste, es una maravilla. El acabado es hermoso y la construcción es sólida. Por el precio, es una inversión que vale la pena.',
          helpful: 45,
          notHelpful: 8,
          verified: true,
          createdAt: new Date('2024-02-18')
        }
      ],
      '2': [ // Taylor 814ce
        {
          id: 'r2-1',
          productId: '2',
          userId: 'u4',
          userName: 'Laura Sánchez',
          rating: 5,
          title: 'La mejor acústica que he tenido en mis manos',
          comment: 'Soy guitarrista profesional y esta Taylor supera todas mis expectativas. El sistema de amplificación ES2 es increíble, suena natural incluso a volumen alto. La resonancia es excepcional, los graves son profundos y los agudos brillantes sin ser estridentes. Perfecta para fingerstyle y strumming. La construcción es impecable, cada detalle está cuidado. Vale cada peso.',
          helpful: 127,
          notHelpful: 1,
          verified: true,
          createdAt: new Date('2024-01-10')
        },
        {
          id: 'r2-2',
          productId: '2',
          userId: 'u5',
          userName: 'David Flores',
          rating: 5,
          title: 'Inversión que no se arrepentirá de hacer',
          comment: 'Ahorré durante un año para comprar esta guitarra y valió totalmente la pena. La uso para grabaciones y el sonido que captura es increíble. El cutaway permite acceder a los trastes altos con facilidad. El acabado mate es elegante y no muestra huellas. La funda que incluye es de excelente calidad. Servicio de Casa de Música Castillo impecable.',
          helpful: 94,
          notHelpful: 2,
          verified: true,
          createdAt: new Date('2024-02-12')
        }
      ],
      '3': [ // Ludwig Classic Maple
        {
          id: 'r3-1',
          productId: '3',
          userId: 'u6',
          userName: 'Miguel Ángel Rivera',
          rating: 5,
          title: 'Sonido potente y construcción de primera',
          comment: 'Como baterista de rock, necesitaba un set que pudiera aguantar toques intensos. Esta Ludwig es una bestia. Los tambores son resonantes, los platillos Zildjian que incluye son de calidad profesional. El hardware es robusto y fácil de ajustar. La configuración fue sencilla y la afinación se mantiene estable. Para el precio, es un set completo que no necesita upgrades inmediatos.',
          helpful: 76,
          notHelpful: 4,
          verified: true,
          createdAt: new Date('2024-01-25')
        },
        {
          id: 'r3-2',
          productId: '3',
          userId: 'u7',
          userName: 'Fernando Castro',
          rating: 4,
          title: 'Excelente set, pero los platillos podrían mejorar',
          comment: 'El set de tambores es fantástico, construcción sólida y sonido profesional. Sin embargo, los platillos que incluye son básicos. Los reemplacé por unos Sabian AAX y ahora el set suena increíble. Los cascos son de arce genuino y la resonancia es perfecta. El bombo tiene un punch impresionante. Recomendado para niveles intermedios y avanzados.',
          helpful: 53,
          notHelpful: 7,
          verified: true,
          createdAt: new Date('2024-02-08')
        }
      ],
      '4': [ // Yamaha P-125
        {
          id: 'r4-1',
          productId: '4',
          userId: 'u8',
          userName: 'Ana Patricia Morales',
          rating: 5,
          title: 'Perfecto para aprender y para profesionales',
          comment: 'Soy profesora de piano y recomiendo este modelo a todos mis estudiantes. Las teclas con acción de martillo GHS son muy realistas, el tacto es similar a un piano acústico. Los 24 sonidos son de alta calidad, especialmente el grand piano. La conectividad Bluetooth es muy útil para usar con apps educativas. Portátil, no ocupa mucho espacio y el precio es excelente.',
          helpful: 142,
          notHelpful: 3,
          verified: true,
          createdAt: new Date('2024-01-15')
        },
        {
          id: 'r4-2',
          productId: '4',
          userId: 'u9',
          userName: 'Jorge Luis Ramírez',
          rating: 5,
          title: 'Mejor que pianos de mayor precio',
          comment: 'Probé varios modelos antes de decidirme y este Yamaha ganó por mucho. El sistema de altavoces suena potente y claro. La función de grabación es práctica para practicar y mejorar. Las teclas son sensibles a la velocidad, lo cual es fundamental. Lo uso para composición y presentaciones pequeñas. El sustento incluido es estable y el pedal funciona perfectamente.',
          helpful: 98,
          notHelpful: 5,
          verified: true,
          createdAt: new Date('2024-02-20')
        }
      ],
      '5': [ // Music Man Stingray
        {
          id: 'r5-1',
          productId: '5',
          userId: 'u10',
          userName: 'Ricardo Domínguez',
          rating: 5,
          title: 'El bajo de mis sueños, sonido único',
          comment: 'Toco en una banda de funk y este Stingray es exactamente lo que necesitaba. El sonido es agresivo, con mucho punch y sustain. El sistema activo de 2 bandas permite moldear el tono con precisión. El mástil es rápido y cómodo, perfecto para slap. La construcción es sólida como una roca. La inversión es alta pero vale cada centavo. Es mi bajo #1 ahora.',
          helpful: 115,
          notHelpful: 2,
          verified: true,
          createdAt: new Date('2024-01-28')
        },
        {
          id: 'r5-2',
          productId: '5',
          userId: 'u11',
          userName: 'Alejandro Vega',
          rating: 5,
          title: 'Leyenda del bajo por una razón',
          comment: 'Después de tocar Fender y Ibanez por años, finalmente me decidí por un Stingray y no me arrepiento. El tono es inconfundible, los graves son profundos sin ser fangosos. La pastilla humbucker en el puente es versátil. Lo uso para rock, metal y jazz. El acabado es hermoso y el hardware de primera. Si buscas un bajo profesional de por vida, este es.',
          helpful: 87,
          notHelpful: 4,
          verified: true,
          createdAt: new Date('2024-02-14')
        }
      ]
    };

    const reviews = reviewsMap[productId] || [];
    return of(reviews).pipe(delay(300));
  }

  // Obtener preguntas de un producto (temporal - datos mock)
  getProductQuestions(productId: string): Observable<ProductQuestion[]> {
    const questionsMap: { [key: string]: ProductQuestion[] } = {
      '1': [ // Fender Stratocaster
        {
          id: 'q1-1',
          productId: '1',
          userId: 'u12',
          userName: 'Luis Hernández',
          question: '¿Incluye funda de transporte o estuche?',
          answer: 'Sí, incluye una funda acolchada de marca Fender. Si deseas un estuche rígido, lo tenemos disponible por separado en nuestra sección de accesorios.',
          answeredBy: 'Casa de Música Castillo',
          createdAt: new Date('2024-02-01'),
          answeredAt: new Date('2024-02-01')
        },
        {
          id: 'q1-2',
          productId: '1',
          userId: 'u13',
          userName: 'Ana Torres',
          question: '¿Es apto para principiantes o es muy avanzada?',
          answer: 'Es perfecta tanto para principiantes como para profesionales. La Stratocaster es conocida por su facilidad de uso y versatilidad. Si eres principiante, te durará muchos años y crecerás musicalmente con ella.',
          answeredBy: 'Casa de Música Castillo',
          createdAt: new Date('2024-02-08'),
          answeredAt: new Date('2024-02-08')
        },
        {
          id: 'q1-3',
          productId: '1',
          userId: 'u14',
          userName: 'Pedro Ramírez',
          question: '¿Qué amplificador recomiendan para esta guitarra?',
          answer: 'Para esta Stratocaster recomendamos el Fender Champion 40 si buscas algo para practicar, o el Fender Blues Junior IV si vas a tocar en vivo. Ambos los tenemos en stock con descuento en combo.',
          answeredBy: 'Casa de Música Castillo',
          createdAt: new Date('2024-02-15'),
          answeredAt: new Date('2024-02-16')
        }
      ],
      '2': [ // Taylor 814ce
        {
          id: 'q2-1',
          productId: '2',
          userId: 'u15',
          userName: 'Carmen López',
          question: '¿Viene con estuche rígido incluido?',
          answer: 'Sí, incluye el estuche rígido original de Taylor con sistema de suspensión TSB para protección máxima. También incluye herramientas de mantenimiento y manual de cuidado.',
          answeredBy: 'Casa de Música Castillo',
          createdAt: new Date('2024-02-03'),
          answeredAt: new Date('2024-02-03')
        },
        {
          id: 'q2-2',
          productId: '2',
          userId: 'u16',
          userName: 'José Mendoza',
          question: '¿El sistema de amplificación requiere baterías o se conecta directo?',
          answer: 'El sistema ES2 se conecta directamente a un amplificador o consola, no requiere baterías. Es pasivo con un preamplificador externo incluido. Puedes usar cualquier cable de guitarra estándar de 6.3mm.',
          answeredBy: 'Casa de Música Castillo',
          createdAt: new Date('2024-02-10'),
          answeredAt: new Date('2024-02-11')
        }
      ],
      '3': [ // Ludwig Classic Maple
        {
          id: 'q3-1',
          productId: '3',
          userId: 'u17',
          userName: 'Daniel Ortiz',
          question: '¿Incluye todos los platillos y hardware necesario?',
          answer: 'Sí, es un set completo que incluye: hi-hat 14", crash 16", ride 20", todos los stands necesarios, pedal de bombo, banquillo y baquetas. Todo listo para empezar a tocar.',
          answeredBy: 'Casa de Música Castillo',
          createdAt: new Date('2024-02-05'),
          answeredAt: new Date('2024-02-05')
        },
        {
          id: 'q3-2',
          productId: '3',
          userId: 'u18',
          userName: 'Raúl Jiménez',
          question: '¿Es difícil de armar? ¿Ofrecen servicio de instalación?',
          answer: 'La batería viene con manual de ensamblaje ilustrado. Es relativamente sencillo para quien tenga experiencia. Si lo requieres, ofrecemos servicio de armado e instalación por $500 adicionales, incluye afinación profesional.',
          answeredBy: 'Casa de Música Castillo',
          createdAt: new Date('2024-02-12'),
          answeredAt: new Date('2024-02-13')
        }
      ],
      '4': [ // Yamaha P-125
        {
          id: 'q4-1',
          productId: '4',
          userId: 'u19',
          userName: 'Patricia Ruiz',
          question: '¿Incluye pedal de sustain y atril?',
          answer: 'Sí, incluye el pedal de sustain FC3A que simula el de un piano acústico, y un atril para partituras. El soporte (stand) se vende por separado, tenemos el modelo L-125 disponible.',
          answeredBy: 'Casa de Música Castillo',
          createdAt: new Date('2024-02-07'),
          answeredAt: new Date('2024-02-07')
        },
        {
          id: 'q4-2',
          productId: '4',
          userId: 'u20',
          userName: 'Alberto Cruz',
          question: '¿Se pueden conectar audífonos para practicar en silencio?',
          answer: 'Sí, tiene dos salidas de audífonos estándar de 6.3mm. Puedes practicar en silencio total sin molestar a nadie. También puedes conectar bocinas externas o un sistema de audio.',
          answeredBy: 'Casa de Música Castillo',
          createdAt: new Date('2024-02-18'),
          answeredAt: new Date('2024-02-18')
        }
      ],
      '5': [ // Music Man Stingray
        {
          id: 'q5-1',
          productId: '5',
          userId: 'u21',
          userName: 'Sergio Vargas',
          question: '¿Viene con estuche o funda?',
          answer: 'Incluye un estuche rígido Music Man original con sistema de protección acolchado y compartimento para accesorios. Es muy resistente y perfecto para transporte.',
          answeredBy: 'Casa de Música Castillo',
          createdAt: new Date('2024-02-09'),
          answeredAt: new Date('2024-02-09')
        },
        {
          id: 'q5-2',
          productId: '5',
          userId: 'u22',
          userName: 'Gabriel Reyes',
          question: '¿La batería de 9V para el sistema activo está incluida?',
          answer: 'Sí, viene con una batería de 9V instalada. Te recomendamos tener siempre una de repuesto. Las baterías alcalinas duran aproximadamente 200-300 horas de uso.',
          answeredBy: 'Casa de Música Castillo',
          createdAt: new Date('2024-02-16'),
          answeredAt: new Date('2024-02-17')
        }
      ]
    };

    const questions = questionsMap[productId] || [];
    return of(questions).pipe(delay(300));
  }

  // Obtener productos con descuento
  getDiscountedProducts(): Observable<Product[]> {
    const discounted = this.products.filter(p => p.discount && p.discount > 0);
    return of(discounted).pipe(delay(400));
  }

  // ==================== MÉTODOS CRUD PARA ADMIN ====================

  /**
   * 🔍 Obtener todos los productos con búsqueda, filtros y paginación (SERVER-SIDE)
   * GET /api/admin/products?page=0&size=20&search=guitarra&brandId=1&categoryId=2&active=true&sortBy=name&sortDir=ASC
   */
  getAllProducts(
    page: number = 0, 
    size: number = 20,
    search?: string,
    brandId?: number | null,
    categoryId?: number | null,
    active?: boolean | null,
    sortBy: string = 'id',
    sortDir: string = 'DESC'
  ): Observable<any> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sortBy', sortBy)
      .set('sortDir', sortDir);
    
    // Agregar parámetros opcionales solo si tienen valor
    if (search && search.trim() !== '') {
      params = params.set('search', search.trim());
    }
    if (brandId !== null && brandId !== undefined) {
      params = params.set('brandId', brandId.toString());
    }
    if (categoryId !== null && categoryId !== undefined) {
      params = params.set('categoryId', categoryId.toString());
    }
    if (active !== null && active !== undefined) {
      params = params.set('active', active.toString());
    }
    
    return this.http.get<any>(this.ADMIN_API_URL, { params });
  }

  /**
   * Obtener producto por ID (admin)
   * GET /api/admin/products/{id}
   */
  getProductById(id: number): Observable<any> {
    return this.http.get<any>(`${this.ADMIN_API_URL}/${id}`);
  }

  /**
   * Crear nuevo producto (admin)
   * POST /api/admin/products
   */
  createProduct(product: any): Observable<any> {
    return this.http.post<any>(this.ADMIN_API_URL, product);
  }

  /**
   * Actualizar producto existente (admin)
   * PUT /api/admin/products/{id}
   */
  updateProduct(id: number, product: any): Observable<any> {
    return this.http.put<any>(`${this.ADMIN_API_URL}/${id}`, product);
  }

  /**
   * Eliminar producto (admin)
   * DELETE /api/admin/products/{id}
   */
  deleteProduct(id: number): Observable<any> {
    return this.http.delete<any>(`${this.ADMIN_API_URL}/${id}`);
  }

  /**
   * Buscar productos con filtros (admin)
   * GET /api/admin/products/search?keyword=guitar&categoryId=1
   */
  searchProductsAdmin(keyword?: string, categoryId?: number, brandId?: number, page: number = 0, size: number = 20): Observable<any> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (keyword) params = params.set('keyword', keyword);
    if (categoryId) params = params.set('categoryId', categoryId.toString());
    if (brandId) params = params.set('brandId', brandId.toString());

    return this.http.get<any>(`${this.ADMIN_API_URL}/search`, { params });
  }
}
