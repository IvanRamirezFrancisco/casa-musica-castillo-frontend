/**
 * Modelos TypeScript para gestión de marcas
 */

export interface BrandDTO {
  id: number;
  name: string;
  description?: string;
  logoUrl?: string;
  logoProvider?: string;
  logoPublicId?: string;
  websiteUrl?: string;
  countryOrigin?: string;
  active: boolean;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBrandRequest {
  name: string;
  description?: string;
  logoUrl?: string;
  websiteUrl?: string;
  countryOrigin?: string;
  active?: boolean;
}

export interface BrandBasicInfo {
  id: number;
  name: string;
  logoUrl?: string;
  active: boolean;
}

export interface BrandListResponse {
  brands: BrandDTO[];
  totalBrands: number;
  currentPage: number;
  totalPages: number;
}

export interface BrandStatsResponse {
  brandId: number;
  brandName: string;
  productCount: number;
  totalSales: number;
  totalViews: number;
}
