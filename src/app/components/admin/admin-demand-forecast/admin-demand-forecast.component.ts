import { Component, OnInit, OnDestroy, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AdminDemandForecastService } from '../../../services/admin-demand-forecast.service';
import { DemandForecastModelStatusDTO, DemandForecastListDTO, DemandForecastDetailDTO } from '../../../models/demand-forecast.models';
import { InfoTooltipComponent } from '../../../shared/components/info-tooltip/info-tooltip.component';

import { Chart, ChartConfiguration, registerables } from 'chart.js';
Chart.register(...registerables);

@Component({
  selector: 'app-admin-demand-forecast',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatBadgeModule,
    MatTooltipModule,
    InfoTooltipComponent
  ],
  templateUrl: './admin-demand-forecast.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./admin-demand-forecast.component.css']
})
export class AdminDemandForecastComponent implements OnInit, OnDestroy {

  modelStatus: DemandForecastModelStatusDTO | null = null;
  statusLoading = true;
  statusError = false;
  showTechInfo = false;

  products: DemandForecastListDTO[] = [];
  totalElements = 0;
  pageSize = 10;
  pageIndex = 0;
  tableLoading = true;
  tableError = false;

  // Filters
  filterSearch = '';
  filterCategory: number | undefined = undefined;
  filterTrend = '';
  filterPriority = '';
  filterForecastStatus = '';
  filterActive = '';

  displayedColumns: string[] = [
    'productInfo',
    'status',
    'forecast',
    'trend',
    'priority',
    'stock',
    'replenishment',
    'actions'
  ];

  selectedProduct: DemandForecastDetailDTO | null = null;
  detailLoading = false;
  detailError = false;
  chartInstance: Chart | null = null;

  constructor(private forecastService: AdminDemandForecastService) {}

  ngOnInit(): void {
    this.loadModelStatus();
    this.loadProducts();
  }

  ngOnDestroy(): void {
    this.closeDetail(); // Cleanup chart and overflow
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.selectedProduct || this.detailLoading) {
      this.closeDetail();
    }
  }

  loadModelStatus(): void {
    this.statusLoading = true;
    this.statusError = false;
    this.forecastService.getModelStatus().subscribe({
      next: (status) => {
        this.modelStatus = status;
        this.statusLoading = false;
      },
      error: () => {
        this.statusError = true;
        this.statusLoading = false;
      }
    });
  }

  loadProducts(sortBy?: string, sortDirection?: string): void {
    this.tableLoading = true;
    this.tableError = false;

    let activeParam: boolean | undefined = undefined;
    if (this.filterActive === 'true') activeParam = true;
    if (this.filterActive === 'false') activeParam = false;

    this.forecastService.getForecasts(
      this.pageIndex,
      this.pageSize,
      this.filterCategory,
      this.filterTrend || undefined,
      this.filterPriority || undefined,
      this.filterForecastStatus || undefined,
      activeParam,
      this.filterSearch || undefined,
      sortBy,
      sortDirection
    ).subscribe({
      next: (response) => {
        this.products = response.content;
        this.totalElements = response.totalElements;
        this.tableLoading = false;
      },
      error: () => {
        this.tableError = true;
        this.tableLoading = false;
      }
    });
  }

  applyFilter(): void {
    this.pageIndex = 0;
    this.loadProducts();
  }

  clearFilters(): void {
    this.filterSearch = '';
    this.filterCategory = undefined;
    this.filterTrend = '';
    this.filterPriority = '';
    this.filterForecastStatus = '';
    this.filterActive = '';
    this.applyFilter();
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadProducts();
  }

  onSortChange(sort: Sort): void {
    if (!sort.active || sort.direction === '') {
      this.loadProducts();
      return;
    }
    this.loadProducts(sort.active, sort.direction);
  }

  viewDetail(productId: number): void {
    this.selectedProduct = null;
    this.detailLoading = true;
    this.detailError = false;

    document.body.style.overflow = 'hidden';

    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }

    this.forecastService.getForecastDetail(productId).subscribe({
      next: (detail) => {
        this.selectedProduct = detail;
        this.detailLoading = false;
        setTimeout(() => this.renderChart(detail), 0);
      },
      error: () => {
        this.detailError = true;
        this.detailLoading = false;
      }
    });
  }

  closeDetail(): void {
    this.selectedProduct = null;
    this.detailLoading = false;
    document.body.style.overflow = '';
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeDetail();
    }
  }

  toggleTechInfo(): void {
    this.showTechInfo = !this.showTechInfo;
  }

  private renderChart(detail: DemandForecastDetailDTO): void {
    const canvas = document.getElementById('forecastChart') as HTMLCanvasElement;
    if (!canvas) return;

    if (detail.forecastStatus === 'INSUFFICIENT_HISTORY' || !detail.historyTail || detail.historyTail.length === 0) {
       return;
    }

    const labels = [];
    const actualData = [];
    
    // Process history
    detail.historyTail.forEach((record, index) => {
      labels.push(`Sem. ${record.weekStart}`);
      actualData.push(record.unitsSold);
    });
    
    // Add forecast point
    labels.push('Próx. Semana (Estimado)');
    actualData.push(null); // No actual data for forecast week
    
    const forecastData = new Array(detail.historyTail.length).fill(null);
    forecastData.push(detail.forecastUnitsRoundedUp);

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Ventas Históricas (Unidades)',
            data: actualData,
            borderColor: '#6D1331',
            backgroundColor: 'rgba(109, 19, 49, 0.1)',
            borderWidth: 2,
            tension: 0.3,
            fill: true,
            pointBackgroundColor: '#6D1331',
            pointRadius: 4
          },
          {
            label: 'Pronóstico',
            data: forecastData,
            borderColor: '#C5A059',
            backgroundColor: '#C5A059',
            borderWidth: 2,
            borderDash: [5, 5],
            pointBackgroundColor: '#C5A059',
            pointRadius: 6,
            pointStyle: 'rectRot'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: (context) => {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  label += context.parsed.y;
                }
                return label;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Unidades'
            }
          }
        }
      }
    };

    this.chartInstance = new Chart(canvas, config);
  }

  // Traducciones
  translateTrend(trend: string): string {
    switch (trend) {
      case 'CRECIENTE': return 'Demanda creciente';
      case 'DECRECIENTE': return 'Demanda decreciente';
      case 'ESTABLE': return 'Demanda estable';
      default: return trend || 'N/A';
    }
  }

  translatePriority(priority: string): string {
    switch (priority) {
      case 'ALTA': return 'Prioridad alta';
      case 'MEDIA': return 'Prioridad media';
      case 'BAJA': return 'Prioridad baja';
      default: return priority || 'N/A';
    }
  }

  translateStatus(status: string): string {
    switch (status) {
      case 'AVAILABLE': return 'Pronóstico disponible';
      case 'INSUFFICIENT_HISTORY': return 'Historial insuficiente';
      default: return status || 'N/A';
    }
  }

  getInterpretation(detail: DemandForecastDetailDTO): string {
    let text = '';
    const relChange = detail.relativeChange ? (detail.relativeChange * 100).toFixed(1) : '0';
    const estUnits = detail.forecastUnitsRoundedUp || 0;
    
    if (detail.trend === 'CRECIENTE') {
      text += `La demanda reciente aumentó ${relChange}%. Para la próxima semana se estiman ${estUnits} unidades. `;
    } else if (detail.trend === 'DECRECIENTE') {
      text += `La demanda reciente disminuyó ${relChange}%. Para la próxima semana se estiman ${estUnits} unidades. `;
    } else if (detail.trend === 'ESTABLE') {
      text += `La demanda reciente se mantiene estable. Para la próxima semana se estiman ${estUnits} unidades. `;
    }

    if (detail.suggestedReplenishment > 0) {
      text += `Se recomienda reponer ${detail.suggestedReplenishment} unidades para cubrir la demanda estimada.`;
    } else {
      text += `El stock actual es suficiente para cubrir la demanda estimada.`;
    }
    return text;
  }
  
  getPriorityInterpretation(detail: DemandForecastDetailDTO): string {
    if (detail.demandPriority === 'ALTA') return 'Este producto requiere seguimiento prioritario.';
    if (detail.demandPriority === 'MEDIA') return 'Se recomienda mantener seguimiento regular.';
    if (detail.demandPriority === 'BAJA') return 'No requiere atención inmediata.';
    return '';
  }
}
