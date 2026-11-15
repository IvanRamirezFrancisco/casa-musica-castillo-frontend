export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  shortDescription: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  images: string[];
  category: ProductCategory;
  brand: string;
  inStock: boolean;
  stockQuantity: number;
  rating: number;
  reviewCount: number;
  specifications: ProductSpecification[];
  tags: string[];
  featured: boolean;
  isNew: boolean;
  warranty?: string;
  installmentInfo?: {
    months: number;
    monthlyPayment: number;
  };
  relatedProducts?: string[]; // IDs de productos relacionados
  
  // NUEVOS CAMPOS: Sistema híbrido de especificaciones
  customAttributes?: ProductAttribute[];  // Atributos dinámicos clave-valor
  detailedDescription?: string;           // Descripción rica con HTML
  
  // Campos opcionales para logística de envío (mantener compatibilidad)
  weight?: number;                        // Peso en kilogramos
  dimensions?: string;                    // Dimensiones como string (formato libre)
  
  createdAt: Date;
  updatedAt: Date;
}

// Nueva interfaz para atributos personalizados
export interface ProductAttribute {
  key: string;    // Nombre del atributo (ej: "Calibre", "Material", "Tipo de Madera")
  value: string;  // Valor del atributo (ej: ".009-.042", "Caoba", "Acero niquelado")
}

export interface ProductReview {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  title: string;
  comment: string;
  helpful: number;
  notHelpful: number;
  verified: boolean; // Si el usuario compró el producto
  createdAt: Date;
}

export interface ProductQuestion {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  question: string;
  answer?: string;
  answeredBy?: string;
  createdAt: Date;
  answeredAt?: Date;
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  icon: string;
  parentId?: string;
  subcategories?: ProductCategory[];
}

export interface ProductSpecification {
  name: string;
  value: string;
  unit?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedOptions?: { [key: string]: string };
}

export interface ProductFilter {
  categories?: string[];
  brands?: string[];
  priceRange?: {
    min: number;
    max: number;
  };
  inStockOnly?: boolean;
  rating?: number;
  search?: string;
}

export interface ProductSort {
  field: 'name' | 'price' | 'rating' | 'createdAt';
  direction: 'asc' | 'desc';
}

export interface ProductSearchResponse {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  filters: {
    categories: ProductCategory[];
    brands: string[];
    priceRange: {
      min: number;
      max: number;
    };
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// API PÚBLICA — Storefront (mapea PublicProductDTO / PublicCategoryDTO del backend)
// ══════════════════════════════════════════════════════════════════════════════

export interface PublicProductImage {
  url: string;
  displayOrder: number;
}

export interface PublicCategoryRef {
  id: number;
  name: string;
  parentId: number | null;
  parentName: string | null;
}

export interface PublicBrandRef {
  id: number;
  name: string;
  logoUrl: string | null;
}

export interface PublicProductAttribute {
  name: string;
  value: string;
  displayOrder: number;
}

/** Mapea exactamente com.security.dto.public_api.PublicProductDTO */
export interface PublicProduct {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  detailedDescription: string | null;
  price: number;
  discountPrice: number | null;
  stock: number;
  imageUrl: string | null;
  images: PublicProductImage[];
  category: PublicCategoryRef | null;
  brand: PublicBrandRef | null;
  attributes: PublicProductAttribute[];
  model: string | null;
  weight: number | null;
  dimensions: string | null;
  featured: boolean;
  averageRating: number;
  reviewCount: number;
}

/** Mapea exactamente com.security.dto.public_api.PublicCategoryDTO */
export interface PublicCategory {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  parentId: number | null;
  parentName: string | null;
  activeProductCount: number;
}

/** Respuesta paginada de Spring Data (Page<T>) */
export interface SpringPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;       // página actual (0-indexed)
  size: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

/** Propuesta 2: Recomendaciones transaccionales */
export interface ProductRecommendation {
  productId: number;
  sku: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  categoryId: number | null;
  categoryName: string | null;
  rating: number;
  reviewCount: number;
  specifications: ProductSpecification[];
  tags: string[];
  featured: boolean;
  isNew: boolean;
  warranty?: string;
  installmentInfo?: {
    months: number;
    monthlyPayment: number;
  };
  relatedProducts?: string[]; // IDs de productos relacionados
  
  // NUEVOS CAMPOS: Sistema híbrido de especificaciones
  customAttributes?: ProductAttribute[];  // Atributos dinámicos clave-valor
  detailedDescription?: string;           // Descripción rica con HTML
  
  // Campos opcionales para logística de envío (mantener compatibilidad)
  weight?: number;                        // Peso en kilogramos
  dimensions?: string;                    // Dimensiones como string (formato libre)
  
  createdAt: Date;
  updatedAt: Date;
}

// Nueva interfaz para atributos personalizados
export interface ProductAttribute {
  key: string;    // Nombre del atributo (ej: "Calibre", "Material", "Tipo de Madera")
  value: string;  // Valor del atributo (ej: ".009-.042", "Caoba", "Acero niquelado")
}

export interface ProductReview {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  title: string;
  comment: string;
  helpful: number;
  notHelpful: number;
  verified: boolean; // Si el usuario compró el producto
  createdAt: Date;
}

export interface ProductQuestion {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  question: string;
  answer?: string;
  answeredBy?: string;
  createdAt: Date;
  answeredAt?: Date;
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  icon: string;
  parentId?: string;
  subcategories?: ProductCategory[];
}

export interface ProductSpecification {
  name: string;
  value: string;
  unit?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedOptions?: { [key: string]: string };
}

export interface ProductFilter {
  categories?: string[];
  brands?: string[];
  priceRange?: {
    min: number;
    max: number;
  };
  inStockOnly?: boolean;
  rating?: number;
  search?: string;
}

export interface ProductSort {
  field: 'name' | 'price' | 'rating' | 'createdAt';
  direction: 'asc' | 'desc';
}

export interface ProductSearchResponse {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  filters: {
    categories: ProductCategory[];
    brands: string[];
    priceRange: {
      min: number;
      max: number;
    };
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// API PÚBLICA — Storefront (mapea PublicProductDTO / PublicCategoryDTO del backend)
// ══════════════════════════════════════════════════════════════════════════════

export interface PublicProductImage {
  url: string;
  displayOrder: number;
}

export interface PublicCategoryRef {
  id: number;
  name: string;
  parentId: number | null;
  parentName: string | null;
}

export interface PublicBrandRef {
  id: number;
  name: string;
  logoUrl: string | null;
}

export interface PublicProductAttribute {
  name: string;
  value: string;
  displayOrder: number;
}

/** Mapea exactamente com.security.dto.public_api.PublicProductDTO */
export interface PublicProduct {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  detailedDescription: string | null;
  price: number;
  discountPrice: number | null;
  stock: number;
  imageUrl: string | null;
  images: PublicProductImage[];
  category: PublicCategoryRef | null;
  brand: PublicBrandRef | null;
  attributes: PublicProductAttribute[];
  model: string | null;
  weight: number | null;
  dimensions: string | null;
  featured: boolean;
  averageRating: number;
  reviewCount: number;
}

/** Mapea exactamente com.security.dto.public_api.PublicCategoryDTO */
export interface PublicCategory {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  parentId: number | null;
  parentName: string | null;
  activeProductCount: number;
}

/** Respuesta paginada de Spring Data (Page<T>) */
export interface SpringPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;       // página actual (0-indexed)
  size: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

/** Propuesta 2: Recomendaciones transaccionales */
export interface ProductRecommendation {
  productId: number;
  sku: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  categoryId: number | null;
  categoryName: string | null;
  regularPrice: number;
  effectivePrice: number;
  discountPrice: number | null;
  stock: number;
  hasDiscount: boolean;
  recommendationReason: string;
}
