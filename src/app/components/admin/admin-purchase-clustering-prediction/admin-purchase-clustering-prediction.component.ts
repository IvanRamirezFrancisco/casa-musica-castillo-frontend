import { Component, OnInit, OnDestroy, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of } from 'rxjs';
import { takeUntil, finalize, debounceTime, switchMap, catchError } from 'rxjs/operators';
import { AdminPurchaseClusteringService } from '../../../services/admin-purchase-clustering.service';
import { OrderService } from '../../../services/order.service';
import { PurchaseClusteringModelStatus, PurchaseOrderClusteringPrediction } from '../../../models/purchase-clustering.models';
import { Order, OrderStatus, PaymentStatus } from '../../../models/order.model';

@Component({
  selector: 'app-admin-purchase-clustering-prediction',
  standalone: true,
  imports: [CommonModule, FormsModule, MatTooltipModule],
  templateUrl: './admin-purchase-clustering-prediction.component.html',
  styleUrls: ['./admin-purchase-clustering-prediction.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  providers: [CurrencyPipe, DecimalPipe]
})
export class AdminPurchaseClusteringPredictionComponent implements OnInit, OnDestroy {
  modelStatus = signal<PurchaseClusteringModelStatus | null>(null);
  isModelStatusLoading = signal<boolean>(true);
  modelStatusError = signal<string | null>(null);

  orderIdInput = signal<string>('');
  
  // Búsqueda
  searchTerm = signal<string>('');
  searchTerm$ = new Subject<string>();
  searchResults = signal<Order[]>([]);
  isSearching = signal<boolean>(false);
  showDropdown = signal<boolean>(false);
  exploreOrders = signal<any[]>([]);

  prediction = signal<PurchaseOrderClusteringPrediction | null>(null);
  isPredicting = signal<boolean>(false);
  predictionError = signal<string | null>(null);
  predictionNotFound = signal<boolean>(false);

  showTechnicalDetails = signal<boolean>(false);

  private destroy$ = new Subject<void>();

  featureNames = [
    'Total de la orden',
    'Porcentaje de descuento',
    'Porcentaje de envío',
    'Unidades totales',
    'Productos distintos',
    'Categorías distintas',
    'Unidades por producto',
    'Proporción del valor en accesorios',
    'Concentración del producto principal',
    'Precio unitario promedio'
  ];

  clusterNames = [
    'Accesorios por volumen',
    'Instrumento con accesorios',
    'Instrumento individual',
    'Accesorio individual',
    'Accesorios variados'
  ];

  constructor(
    private clusteringService: AdminPurchaseClusteringService,
    private orderService: OrderService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadModelStatus();
    this.loadExploreOrders();
    this.setupSearch();
    
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const orderId = params['orderId'];
      if (orderId && !isNaN(Number(orderId)) && Number(orderId) > 0) {
        this.orderIdInput.set(orderId);
        this.analyzeOrder(Number(orderId));
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // --- Búsqueda de órdenes operativas ---
  private setupSearch(): void {
    this.searchTerm$.pipe(
      takeUntil(this.destroy$),
      debounceTime(300),
      switchMap(term => {
        if (!term.trim()) {
          this.searchResults.set([]);
          this.isSearching.set(false);
          return of(null);
        }
        this.isSearching.set(true);
        // Pedimos más órdenes para tener buena variedad de ambas
        return this.orderService.getAllOrders(0, 20, 'createdAt', 'DESC', { search: term }).pipe(
          catchError(() => of(null)),
          finalize(() => this.isSearching.set(false))
        );
      })
    ).subscribe(res => {
      if (res && res.content) {
        this.searchResults.set(res.content);
        this.showDropdown.set(true);
      } else {
        this.searchResults.set([]);
      }
    });
  }

  loadExploreOrders(): void {
    // Carga ejemplos históricos directamente desde la fuente analítica (clusters 0, 1, 2, 3)
    import('rxjs').then(({ forkJoin }) => {
      const requests = [0, 1, 2, 3].map(c => this.clusteringService.getClusterOrders(c, 0, 1));
      forkJoin(requests).pipe(takeUntil(this.destroy$)).subscribe({
        next: (res) => {
          const examples = res.map(r => r.content[0]).filter(o => !!o).map(o => ({
            id: o.orderId,
            orderNumber: o.orderNumber,
            orderDate: o.createdAt,
            total: o.total
          }));
          this.exploreOrders.set(examples);
        }
      });
    });
  }

  onSearchChange(term: string): void {
    this.searchTerm.set(term);
    this.searchTerm$.next(term);
  }

  selectOrder(order: Order): void {
    this.orderIdInput.set(order.id.toString());
    this.searchTerm.set(order.orderNumber);
    this.showDropdown.set(false);
  }

  hideDropdownDelay(): void {
    setTimeout(() => {
      this.showDropdown.set(false);
    }, 200);
  }

  loadModelStatus(): void {
    this.isModelStatusLoading.set(true);
    this.modelStatusError.set(null);
    this.clusteringService.getModelStatus().pipe(
      takeUntil(this.destroy$),
      finalize(() => this.isModelStatusLoading.set(false))
    ).subscribe({
      next: (status) => this.modelStatus.set(status),
      error: (err: HttpErrorResponse) => {
        this.modelStatusError.set('No se pudo cargar el estado del modelo operativo.');
      }
    });
  }

  isFormValid(): boolean {
    const val = Number(this.orderIdInput());
    return !isNaN(val) && val > 0 && Number.isInteger(val) && this.orderIdInput().trim().length > 0;
  }

  onSubmit(): void {
    if (this.isFormValid()) {
      const orderId = Number(this.orderIdInput());
      // Update URL without triggering reload
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { orderId: orderId },
        queryParamsHandling: 'merge'
      });
      this.analyzeOrder(orderId);
    }
  }

  analyzeOrder(orderId: number): void {
    this.isPredicting.set(true);
    this.predictionError.set(null);
    this.predictionNotFound.set(false);
    this.prediction.set(null);
    this.showTechnicalDetails.set(false);

    this.clusteringService.predictOrder(orderId).pipe(
      takeUntil(this.destroy$),
      finalize(() => this.isPredicting.set(false))
    ).subscribe({
      next: (res) => {
        this.prediction.set(res);
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 404) {
          this.predictionNotFound.set(true);
        } else if (err.status === 403) {
          this.predictionError.set('No tienes permiso para consultar la analítica de patrones de compra.');
        } else if (err.status === 401) {
          // Handled by auth interceptor
        } else {
          this.predictionError.set('No fue posible procesar la orden en este momento.');
        }
      }
    });
  }

  clearResult(): void {
    this.prediction.set(null);
    this.predictionError.set(null);
    this.predictionNotFound.set(false);
    this.orderIdInput.set('');
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { orderId: null },
      queryParamsHandling: 'merge'
    });
  }

  toggleTechnicalDetails(): void {
    this.showTechnicalDetails.set(!this.showTechnicalDetails());
  }

  getMinDistanceIndex(): number {
    const pred = this.prediction();
    if (!pred || !pred.distancesToAllCentroids || pred.distancesToAllCentroids.length === 0) return -1;
    let minIdx = 0;
    let minVal = pred.distancesToAllCentroids[0];
    for (let i = 1; i < pred.distancesToAllCentroids.length; i++) {
      if (pred.distancesToAllCentroids[i] < minVal) {
        minVal = pred.distancesToAllCentroids[i];
        minIdx = i;
      }
    }
    return minIdx;
  }

  // --- Utilidades de Formato ---
  getDistanceBarWidth(dist: number): number {
    const pred = this.prediction();
    if (!pred || !pred.distancesToAllCentroids || pred.distancesToAllCentroids.length === 0) return 0;
    
    // Encontrar la distancia máxima para escalar
    let maxDist = pred.distancesToAllCentroids[0];
    for (const d of pred.distancesToAllCentroids) {
      if (d > maxDist) maxDist = d;
    }
    
    if (maxDist === 0) return 0;
    
    // Calculamos el porcentaje relativo (barra corta = poca distancia, barra larga = mucha distancia)
    // Nos aseguramos de que haya un mínimo visible (ej. 2%)
    const pct = (dist / maxDist) * 100;
    return Math.max(2, pct);
  }

  formatAlreadyPercent(value: number): string {
    return (value).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %';
  }

  formatRatioAsPercent(value: number): string {
    return (value * 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %';
  }

  // Genera un texto explicativo utilizando los datos reales de la orden
  generateQuickInterpretation(): string {
    const p = this.prediction();
    if (!p) return '';
    const units = p.featureValues[3] || 0;
    const prods = p.featureValues[4] || 0;
    const accShare = this.formatRatioAsPercent(p.featureValues[7] || 0);
    const mainShare = this.formatRatioAsPercent(p.featureValues[8] || 0);

    const txtUnits = units === 1 ? '1 unidad' : `${units} unidades`;
    const txtProds = prods === 1 ? 'un solo producto' : `${prods} productos distintos`;

    return `Esta orden contiene ${txtUnits} de ${txtProds}. El ${accShare} del valor de los productos corresponde a accesorios y el artículo de mayor importe representa el ${mainShare} de la compra.`;
  }
}
