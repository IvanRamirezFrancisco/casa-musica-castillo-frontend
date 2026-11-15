export interface HelpCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
  iconKey?: string;
  displayOrder: number;
  active: boolean;
  activeFaqCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Faq {
  id: number;
  categoryId: number;
  categoryName?: string;
  question: string;
  answer: string;
  displayOrder: number;
  active: boolean;
  featured: boolean;
  createdAt?: string;
  updatedAt?: string;
}
