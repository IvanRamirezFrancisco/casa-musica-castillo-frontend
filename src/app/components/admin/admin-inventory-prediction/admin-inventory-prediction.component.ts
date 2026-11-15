import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import {
  InventoryPrediction,
  InventoryPredictionService,
} from '../../../services/inventory-prediction.service';

Chart.register(...registerables, annotationPlugin);

// ── Constantes visuales ───────────────────────────────────────────────────────

const SECTION_COLORS: Record<string, string> = {
  jaranas:    '#e74c3c',
  quintas:    '#3498db',
  violines:   '#9b59b6',
  accesorios: '#27ae60',
};

// Opciones de horizonte temporal fijo (Bug #4)
export type HorizonOption = 30 | 90 | 180 | 365 | 'tcrit';

export const HORIZON_OPTIONS: { label: string; value: HorizonOption }[] = [
  { label: '30 dias',          value: 30  },
  { label: '90 dias',          value: 90  },
  { label: '180 dias',         value: 180 },
  { label: '1 año',           value: 365 },
  { label: 'Hasta agotamiento', value: 'tcrit' },
];

// ── Funciones puras del modelo matematico ─────────────────────────────────────

/**
 * Calcula la constante de decaimiento k:
 *   k = -ln(I(t) / I0) / t
 * Retorna 0 si el calculo no es valido.
 */
export function calcK(i0: number, iAtT: number, t: number): number {
  if (i0 <= 0 || iAtT <= 0 || t <= 0 || iAtT >= i0) return 0;
  return -Math.log(iAtT / i0) / t;
}

/**
 * Valida si los datos de una seccion permiten calcular k.
 * iCurrent == i0 es valido (recien reabastecido, k = K_MIN).
 * Solo invalida si iCurrent <= 0 o iCurrent > i0 (dato corrupto).
 */
export function isSectionValid(pred: InventoryPrediction): boolean {
  return pred.iCurrent > 0 && pred.iCurrent <= pred.i0;
}

/**
 * Genera datos discretos (enteros via Math.floor) para la grafica.
 */
export function generateDiscreteStockData(
  i0: number,
  k: number,
  steps: number[]
): { x: number; y: number }[] {
  return steps.map((t) => ({
    x: t,
    y: Math.floor(Math.max(i0 * Math.exp(-k * t), 0)),
  }));
}

/**
 * Calcula el horizonte dinamico: max(tCrit * 1.3, 30).
 * Genera entre 10 y 15 barras con step = Math.max(1, floor(horizon / 14)).
 */
export function calcHorizonSteps(horizonDays: number): number[] {
  const total = Math.max(horizonDays, 1);
  const step  = Math.max(1, Math.floor(total / 14));  // Bug #4: entre 10-15 barras
  const steps: number[] = [];
  for (let d = 0; d <= total; d += step) {
    steps.push(d);
  }
  if (steps[steps.length - 1] < total) steps.push(total);
  return steps;
}

/**
 * Color semantico de barra segun nivel de stock vs I_crit.
 * Verde: > 2*iCrit | Ambar: <= 2*iCrit | Rojo: <= iCrit
 */
export function getBarColor(stockValue: number, iCrit: number, alpha = 'CC'): string {
  if (stockValue <= iCrit)     return `#e74c3c${alpha}`;
  if (stockValue <= 2 * iCrit) return `#f39c12${alpha}`;
  return                              `#27ae60${alpha}`;
}

// ── Interfaz de formulas para el panel de texto ───────────────────────────────

export interface FormulaInfo {
  sectionName:    string;
  sectionKey:     string;
  i0:             number;
  iCurrent:       number;
  iCrit:          number;
  k:              number;
  tCrit:          number;
  kFormatted:     string;
  tCritFormatted: string;
}

// ── Componente ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-admin-inventory-prediction',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-inventory-prediction.component.html',
  styleUrl: './admin-inventory-prediction.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminInventoryPredictionComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  @ViewChild('predChart') private canvasRef!: ElementRef<HTMLCanvasElement>;

  predictions:     InventoryPrediction[] = [];
  selectedSection: number      = 0;
  selectedHorizon: HorizonOption = 90;    // Bug #4: horizonte configurable
  isLoading  = true;
  loadError  = false;

  formulaInfo:   FormulaInfo | null = null;
  horizonOptions = HORIZON_OPTIONS;

  // Bug #1: estado de validez de la seccion activa
  chartInvalidReason: 'no-stock' | 'invalid-data' | null = null;

  private chart:     Chart | null = null;
  private dataLoaded = false;

  constructor(
    private readonly predictionService: InventoryPredictionService,
    private readonly cdr: ChangeDetectorRef,
    private readonly zone: NgZone
  ) {}

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadPredictions();
  }

  ngAfterViewInit(): void {
    if (this.dataLoaded) this.scheduleBuild();
  }

  ngOnDestroy(): void {
    this.destroyChart();
  }

  // ── Publico ───────────────────────────────────────────────────────────────

  loadPredictions(): void {
    this.isLoading = true;
    this.loadError = false;
    this.cdr.markForCheck();

    this.predictionService.getPredictions().subscribe({
      next: (data: InventoryPrediction[]) => {
        this.predictions     = data;
        this.selectedSection = 0;
        this.isLoading       = false;
        this.dataLoaded      = true;
        this.applyDefaultHorizon();
        this.updateFormulaInfo();
        this.cdr.markForCheck();
        this.scheduleBuild();
      },
      error: (err: unknown) => {
        console.error('[InventoryPrediction] Error al cargar predicciones:', err);
        this.isLoading = false;
        this.loadError = true;
        this.cdr.markForCheck();
      },
    });
  }

  selectSection(index: number): void {
    if (this.selectedSection === index) return;
    this.selectedSection = index;
    this.applyDefaultHorizon();
    this.updateFormulaInfo();
    this.cdr.markForCheck();
    this.scheduleBuild();
  }

  /** Bug #4: cambia el horizonte temporal y reconstruye la grafica */
  setHorizon(h: HorizonOption): void {
    this.selectedHorizon = h;
    this.cdr.markForCheck();
    this.scheduleBuild();
  }

  /** Bug #4: "Hasta t_crit" se deshabilita si la seccion no tiene k valida */
  isTCritDisabled(): boolean {
    const pred = this.predictions[this.selectedSection];
    if (!pred) return true;
    return !isSectionValid(pred) || pred.k <= 0;
  }

  // ── Helpers de template ───────────────────────────────────────────────────

  /** Acceso tipado a la prediccion activa, nunca undefined dentro del bloque @if */
  get activePrediction(): InventoryPrediction {
    return this.predictions[this.selectedSection];
  }

  trackByKey(_: number, p: InventoryPrediction): string {
    return p.sectionKey;
  }

  cardClass(p: InventoryPrediction): string {
    if (p.status === 'CRITICAL') return 'crit';
    if (p.status === 'WARNING')  return 'warn';
    return 'ok';
  }

  isBadgeCritical(p: InventoryPrediction): boolean {
    return p.status === 'CRITICAL' || p.currentStock === 0 || p.daysToAlert < 15;
  }

  sectionColor(key: string): string {
    return SECTION_COLORS[key] ?? '#7b1a1a';
  }

  lastUpdatedHours(): number {
    return 0;
  }

  // ── Logica interna ────────────────────────────────────────────────────────

  /** Bug #4: horizonte default segun estado de la seccion */
  private applyDefaultHorizon(): void {
    const pred = this.predictions[this.selectedSection];
    if (!pred) return;
    // Default: 30d para criticas, 90d para normales
    if (pred.status === 'CRITICAL' || pred.daysToAlert < 30) {
      this.selectedHorizon = 30;
    } else {
      this.selectedHorizon = 90;
    }
  }

  private updateFormulaInfo(): void {
    const pred = this.predictions[this.selectedSection];
    if (!pred) { this.formulaInfo = null; return; }

    const tCrit = pred.k > 0
      ? Math.floor(-Math.log(pred.iCrit / pred.i0) / pred.k)
      : 0;

    this.formulaInfo = {
      sectionName:    pred.sectionName,
      sectionKey:     pred.sectionKey,
      i0:             Math.floor(pred.i0),
      iCurrent:       Math.floor(pred.iCurrent),
      iCrit:          Math.floor(pred.iCrit),
      k:              pred.k,
      tCrit,
      kFormatted:     pred.k.toFixed(6),
      tCritFormatted: tCrit > 0 ? `${tCrit} dias` : 'Infinito (k = 0)',
    };
  }

  // ── Chart.js ──────────────────────────────────────────────────────────────

  private scheduleBuild(): void {
    // Paso 1: evaluar validez y actualizar el estado (muestra/oculta canvas)
    this.zone.run(() => {
      this.evaluateValidity();
      this.cdr.markForCheck();
    });
    // Paso 2: tras un tick, el DOM ya refleja el @if correcto → construir chart
    this.zone.runOutsideAngular(() => {
      setTimeout(() => this.buildChart(), 80);
    });
  }

  private evaluateValidity(): void {
    const pred = this.predictions[this.selectedSection];
    if (!pred) { this.chartInvalidReason = null; return; }
    if (pred.iCurrent <= 0) {
      this.chartInvalidReason = 'no-stock';
    } else if (pred.iCurrent > pred.i0) {
      this.chartInvalidReason = 'invalid-data';
    } else {
      this.chartInvalidReason = null;
    }
  }

  private destroyChart(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  private buildChart(): void {
    // Si el estado es inválido, no hay canvas en el DOM → salir
    if (this.chartInvalidReason !== null) return;
    if (!this.canvasRef?.nativeElement || this.predictions.length === 0) return;

    this.destroyChart();

    const pred = this.predictions[this.selectedSection];
    if (!pred) return;

    // ── Bug #4: calcular horizonte segun opcion seleccionada ───────────
    const tCritRaw = pred.k > 0
      ? Math.ceil(-Math.log(pred.iCrit / pred.i0) / pred.k)
      : 30;

    let horizonDays: number;
    if (this.selectedHorizon === 'tcrit') {
      horizonDays = Math.max(Math.ceil(tCritRaw * 1.3), 30);
    } else {
      horizonDays = this.selectedHorizon;
    }

    // step = max(1, floor(horizon / 14)) — entre 10 y 15 barras
    const steps  = calcHorizonSteps(horizonDays);
    const labels = steps.map((t) => `${t}d`);

    // ── Datos discretos (Math.floor) ───────────────────────────────────
    const rawPoints  = generateDiscreteStockData(pred.i0, pred.k, steps);
    const values     = rawPoints.map((p) => p.y);

    // ── Color semantico por barra ──────────────────────────────────────
    const iCrit       = Math.floor(pred.iCrit);
    const barColors   = values.map((v) => getBarColor(v, iCrit, 'DD'));
    const borderColors = values.map((v) => getBarColor(v, iCrit, 'FF'));

    // ── stepSize entero para eje Y ─────────────────────────────────────
    const yAxisMax = Math.floor(pred.i0);
    const stepSize =
      yAxisMax <= 20  ? 1  :
      yAxisMax <= 50  ? 5  :
      yAxisMax <= 100 ? 10 :
      yAxisMax <= 200 ? 20 :
      yAxisMax <= 500 ? 50 : 100;

    // ── Anotaciones ───────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const annotations: Record<string, any> = {
      critLine: {
        type: 'line',
        yMin: iCrit,
        yMax: iCrit,
        borderColor: '#e74c3c',
        borderWidth: 2,
        borderDash: [8, 4],
        label: {
          display: true,
          content: `I_crit = ${iCrit} uds.`,
          position: 'end',
          backgroundColor: '#e74c3c',
          color: '#fff',
          font: { size: 10, weight: 'bold' },
          padding: { x: 8, y: 4 },
          borderRadius: 4,
          yAdjust: -14,
        },
      },
    };

    if (tCritRaw > 0 && tCritRaw <= steps[steps.length - 1]) {
      const closestIdx = steps.reduce((bestIdx, t, i) =>
        Math.abs(t - tCritRaw) < Math.abs(steps[bestIdx] - tCritRaw) ? i : bestIdx
      , 0);
      annotations['tCritLine'] = {
        type: 'line',
        xMin: closestIdx,
        xMax: closestIdx,
        borderColor: '#f39c12',
        borderWidth: 2,
        borderDash: [5, 4],
        label: {
          display: true,
          content: `Agotamiento \u2248 ${tCritRaw} dias`,
          position: 'start',
          backgroundColor: 'rgba(234, 179, 8, 0.9)',
          color: '#fff',
          font: { size: 11, weight: 'bold' },
          padding: { x: 8, y: 4 },
          borderRadius: 4,
          yAdjust: -80,
        },
      };
    }

    // ── Configuracion final ────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: ChartConfiguration<'bar'> & { options: { plugins: { annotation: any } } } = {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: pred.sectionName,
          data: values,
          backgroundColor: barColors,
          borderColor: borderColors,
          borderWidth: 1.5,
          borderRadius: 3,
          borderSkipped: 'bottom',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            titleColor: '#f8fafc',
            bodyColor: '#cbd5e1',
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              // Bug #4: "Dia X: N unidades" sin decimales
              title: (items) => `Dia ${items[0]?.label ?? ''}`,
              label: (ctx) => {
                const val   = ctx.parsed.y ?? 0;
                const pct   = pred.i0 > 0 ? ((val / pred.i0) * 100).toFixed(0) : '0';
                const nivel = val <= iCrit       ? 'Critico'
                            : val <= 2 * iCrit   ? 'Advertencia'
                            : 'Normal';
                const daysLeft = pred.k > 0 && val > iCrit
                  ? Math.round(-Math.log(iCrit / Math.max(val, 0.001)) / pred.k)
                  : 0;
                const lines = [
                  ` Stock: ${val} uds. (${pct}% de I\u2080)`,
                  ` Estado: ${nivel}`,
                ];
                if (daysLeft > 0) {
                  lines.push(` D\u00edas hasta agotamiento: ${daysLeft} d\u00edas`);
                }
                return lines;
              },
            },
          },
          annotation: { annotations },
        },
        scales: {
          x: {
            grid:   { color: 'rgba(0,0,0,0.05)', lineWidth: 1 },
            border: { color: 'rgba(0,0,0,0.15)' },
            ticks:  {
              color: '#6c757d',
              font: { size: 11 },
              autoSkip: false,   // Bug #4: control manual del eje X
              maxRotation: 45,
            },
            title: {
              display: true,
              text: 'Dias desde hoy',
              color: '#6c757d',
              font: { size: 11 },
            },
          },
          y: {
            grid:   { color: 'rgba(0,0,0,0.05)', lineWidth: 1 },
            border: { color: 'rgba(0,0,0,0.15)' },
            min: 0,
            max: yAxisMax + stepSize,
            ticks: {
              color: '#6c757d',
              font: { size: 11 },
              stepSize,
              precision: 0,
              // Bug general: solo enteros en el eje Y
              callback: (val) => Number.isInteger(val) ? `${val} uds.` : null,
            },
            title: {
              display: true,
              text: 'Stock (uds. enteras)',
              color: '#6c757d',
              font: { size: 11 },
            },
          },
        },
        animation: { duration: 400, easing: 'easeInOutQuart' },
      },
    };

    this.chart = new Chart(
      this.canvasRef.nativeElement,
      config as unknown as ChartConfiguration,
    );
  }
}
