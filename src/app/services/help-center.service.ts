import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HelpCategory, Faq } from '../models/help-center.model';

@Injectable({
  providedIn: 'root'
})
export class HelpCenterService {
  private readonly publicApi = `${environment.apiUrl}/public/help`;
  private readonly adminApi = `${environment.apiUrl}/admin/help`;

  constructor(private http: HttpClient) {}

  // --- Público ---
  
  getPublicCategories(): Observable<HelpCategory[]> {
    return this.http.get<HelpCategory[]>(`${this.publicApi}/categories`);
  }

  getPublicFaqs(): Observable<Faq[]> {
    return this.http.get<Faq[]>(`${this.publicApi}/faqs`);
  }

  getFeaturedFaqs(): Observable<Faq[]> {
    return this.http.get<Faq[]>(`${this.publicApi}/faqs/featured`);
  }

  searchFaqs(query: string): Observable<Faq[]> {
    const params = new HttpParams().set('q', query);
    return this.http.get<Faq[]>(`${this.publicApi}/search`, { params });
  }

  // --- Admin ---

  getAdminCategories(): Observable<HelpCategory[]> {
    return this.http.get<HelpCategory[]>(`${this.adminApi}/categories`);
  }

  createCategory(category: Partial<HelpCategory>): Observable<HelpCategory> {
    return this.http.post<HelpCategory>(`${this.adminApi}/categories`, category);
  }

  updateCategory(id: number, category: Partial<HelpCategory>): Observable<HelpCategory> {
    return this.http.put<HelpCategory>(`${this.adminApi}/categories/${id}`, category);
  }

  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${this.adminApi}/categories/${id}`);
  }

  getAdminFaqs(): Observable<Faq[]> {
    return this.http.get<Faq[]>(`${this.adminApi}/faqs`);
  }

  createFaq(faq: Partial<Faq>): Observable<Faq> {
    return this.http.post<Faq>(`${this.adminApi}/faqs`, faq);
  }

  updateFaq(id: number, faq: Partial<Faq>): Observable<Faq> {
    return this.http.put<Faq>(`${this.adminApi}/faqs/${id}`, faq);
  }

  deleteFaq(id: number): Observable<void> {
    return this.http.delete<void>(`${this.adminApi}/faqs/${id}`);
  }
}
