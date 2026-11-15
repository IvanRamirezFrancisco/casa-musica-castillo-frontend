import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/** Predicción de agotamiento para una sección del catálogo */
export interface InventoryPrediction {
  sectionName:  string;
  sectionKey:   'jaranas' | 'quintas' | 'violines' | 'accesorios';
  i0:           number;
  iCurrent:     number;
  iCrit:        number;
  k:            number;
  daysToAlert:  number;
  currentStock: number;
  status:       'CRITICAL' | 'WARNING' | 'STABLE';
}

@Injectable({ providedIn: 'root' })
export class InventoryPredictionService {

  private readonly apiUrl = `${environment.apiUrl}/admin/inventory/prediction`;

  constructor(private http: HttpClient) {}

  getPredictions(): Observable<InventoryPrediction[]> {
    return this.http.get<InventoryPrediction[]>(this.apiUrl);
  }
}
