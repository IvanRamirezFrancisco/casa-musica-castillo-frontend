import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ShippingSettings } from '../models/order.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ShippingSettingsService {
  private apiUrl = `${environment.apiUrl}/admin/shipping-settings`;

  constructor(private http: HttpClient) {}

  getSettings(): Observable<ShippingSettings> {
    return this.http.get<ShippingSettings>(this.apiUrl);
  }

  updateSettings(settings: ShippingSettings): Observable<ShippingSettings> {
    return this.http.put<ShippingSettings>(this.apiUrl, settings);
  }
}
