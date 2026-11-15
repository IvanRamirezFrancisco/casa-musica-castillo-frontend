/**
 * Modelos TypeScript para gestión de categorías de productos
 */

export interface Category {
  id: number;
  name: string;
  description?: string;
  imageUrl?: string;
  imagePublicId?: string;
  imageProvider?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  productCount?: number;
  
  // Campos para jerarquía padre-hijo
  parentId?: number | null;
  parentName?: string | null;
  subcategoryCount?: number;
  hasChildren?: boolean;
  level?: number;
  hierarchyPath?: string;
}

export interface CreateCategoryRequest {
  name: string;
  description?: string;
  imageUrl?: string;
  active?: boolean;
  parentId?: number | null;  // Para crear subcategorías
}

export interface UpdateCategoryRequest {
  name?: string;
  description?: string;
  imageUrl?: string;
  active?: boolean;
  parentId?: number | null;  // Para cambiar la categoría padre
}

export interface CategoryListResponse {
  categories: Category[];
  totalCategories: number;
  currentPage: number;
  totalPages: number;
}
