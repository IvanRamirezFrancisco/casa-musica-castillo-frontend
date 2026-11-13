import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { AdminPurchaseClusteringPredictionComponent } from './admin-purchase-clustering-prediction.component';
import { AdminPurchaseClusteringService } from '../../../services/admin-purchase-clustering.service';
import { OrderService } from '../../../services/order.service';
import { of } from 'rxjs';

describe('AdminPurchaseClusteringPredictionComponent', () => {
  let component: AdminPurchaseClusteringPredictionComponent;
  let fixture: ComponentFixture<AdminPurchaseClusteringPredictionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminPurchaseClusteringPredictionComponent, NoopAnimationsModule],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AdminPurchaseClusteringService,
          useValue: jasmine.createSpyObj('AdminPurchaseClusteringService', ['getModelStatus', 'predictOrder', 'getClusterOrders'])
        },
        {
          provide: OrderService,
          useValue: jasmine.createSpyObj('OrderService', ['getAllOrders', 'getOrderById'])
        }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminPurchaseClusteringPredictionComponent);
    component = fixture.componentInstance;
    
    // Mocks iniciales
    const clusteringSpy = TestBed.inject(AdminPurchaseClusteringService) as jasmine.SpyObj<AdminPurchaseClusteringService>;
    clusteringSpy.getModelStatus.and.returnValue(of({} as any));
    clusteringSpy.getClusterOrders.and.returnValue(of({ content: [] } as any));
    
    const orderSpy = TestBed.inject(OrderService) as jasmine.SpyObj<OrderService>;
    orderSpy.getAllOrders.and.returnValue(of({ content: [] } as any));
    
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Formato de porcentajes', () => {
    it('formatAlreadyPercent should append % without multiplying by 100', () => {
      // 1. discount_pct no se multiplica por 100
      expect(component.formatAlreadyPercent(10.0)).toBe('10.00 %');
      // 2. shipping_pct no se multiplica por 100
      expect(component.formatAlreadyPercent(13.8889)).toBe('13.89 %');
    });

    it('formatRatioAsPercent should multiply by 100 and append %', () => {
      // 3. accessory_value_share sí se convierte de proporción a porcentaje
      expect(component.formatRatioAsPercent(1.0)).toBe('100.00 %');
      // 4. largest_product_value_share sí se convierte a porcentaje
      expect(component.formatRatioAsPercent(0.9645)).toBe('96.45 %');
    });
  });

  describe('Interpretación rápida', () => {
    it('generateQuickInterpretation should use real values from prediction', () => {
      // 6. interpretación rápida usa los valores reales
      component.prediction.set({
        featureValues: [1500, 10, 5, 2, 1, 1, 2, 1, 1, 750]
      } as any);

      const interpretation = component.generateQuickInterpretation();
      expect(interpretation).toContain('2 unidades');
      expect(interpretation).toContain('un solo producto');
      expect(interpretation).toContain('El 100.00 % del valor');
      expect(interpretation).toContain('representa el 100.00 %');
    });
  });

  describe('Cálculo de barra de distancias', () => {
    it('getDistanceBarWidth should calculate relative width and maintain a minimum', () => {
      component.prediction.set({
        distancesToAllCentroids: [0.5, 1.0, 2.0]
      } as any);

      // max distance is 2.0
      expect(component.getDistanceBarWidth(2.0)).toBe(100); // (2/2) * 100
      expect(component.getDistanceBarWidth(1.0)).toBe(50); // (1/2) * 100
      expect(component.getDistanceBarWidth(0.5)).toBe(25); // (0.5/2) * 100
    });
  });

  describe('Explorar órdenes unificado', () => {
    it('exploreOrders should load from clusteringService and not use OrderService for quick cards', (done) => {
      const clusteringSpy = TestBed.inject(AdminPurchaseClusteringService) as jasmine.SpyObj<AdminPurchaseClusteringService>;
      const orderSpy = TestBed.inject(OrderService) as jasmine.SpyObj<OrderService>;
      
      // Reset spies to check calls
      clusteringSpy.getClusterOrders.calls.reset();
      orderSpy.getAllOrders.calls.reset();
      
      // Mock data from clustering service
      clusteringSpy.getClusterOrders.and.callFake((cluster: number) => {
        return of({
          content: [{ orderId: cluster, orderNumber: `MLSEED-${cluster}`, createdAt: '2023-01-01', total: 100 }]
        } as any);
      });
      
      component.loadExploreOrders();
      
      setTimeout(() => {
        expect(clusteringSpy.getClusterOrders).toHaveBeenCalled();
        // Verificar que no se use el listado general administrativo para construir tarjetas rápidas
        expect(orderSpy.getAllOrders).not.toHaveBeenCalled();
        
        const exploreOrders = component.exploreOrders();
        expect(exploreOrders.length).toBeGreaterThan(0);
        
        // Verificar que solo se muestran históricas confirmadas
        const allHistorical = exploreOrders.every(o => o.orderNumber.startsWith('MLSEED'));
        expect(allHistorical).toBeTrue();
        
        // Verificar que órdenes operativas ficticias no están en las tarjetas rápidas
        const hasOperational = exploreOrders.some(o => o.orderNumber === 'ORD-BDBF256A');
        expect(hasOperational).toBeFalse();
        
        done();
      }, 50);
    });

    it('should clear selection correctly on 404', () => {
      const routerSpy = spyOn(component['router'], 'navigate');
      component.predictionNotFound.set(true);
      component.orderIdInput.set('123');
      
      component.clearResult();
      
      expect(component.predictionNotFound()).toBeFalse();
      expect(component.orderIdInput()).toBe('');
      expect(routerSpy).toHaveBeenCalledWith([], {
        relativeTo: component['route'],
        queryParams: { orderId: null },
        queryParamsHandling: 'merge'
      });
    });
  });
});
