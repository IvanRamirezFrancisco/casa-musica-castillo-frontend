import { Component, provideZoneChangeDetection } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEsMx from '@angular/common/locales/es-MX';
import { PurchaseClusteringSummary, PurchaseClusterProfile, PurchaseClusterOrdersPage } from '../../../models/purchase-clustering.models';
import { AdminPurchaseClusteringPredictionComponent } from '../admin-purchase-clustering-prediction/admin-purchase-clustering-prediction.component';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AdminPurchaseClusteringComponent } from './admin-purchase-clustering.component';
import { AdminPurchaseClusteringService } from '../../../services/admin-purchase-clustering.service';
import { AuthService } from '../../../services/auth.service';
import { OrderService } from '../../../services/order.service';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';

// Prediction is covered separately; these tests exercise the parent's historical view.
@Component({ selector: 'app-admin-purchase-clustering-prediction', standalone: true, template: '' })
class PredictionStubComponent {}

describe('AdminPurchaseClusteringComponent', () => {
  let component: AdminPurchaseClusteringComponent;
  let fixture: ComponentFixture<AdminPurchaseClusteringComponent>;
  let clusteringServiceSpy: jasmine.SpyObj<AdminPurchaseClusteringService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let orderServiceSpy: jasmine.SpyObj<OrderService>;
  let routerSpy: jasmine.Spy<Router['navigate']>;

  beforeAll(() => registerLocaleData(localeEsMx));

  const mockSummary: PurchaseClusteringSummary = {
    runId: 1,
    modelVersion: '1.0',
    algorithm: 'K-Means',
    selectedK: 2,
    ordersAnalyzed: 100,
    featureCount: 5,
    datasetView: 'view',
    dataOrigin: 'origin',
    periodStart: '2023-01-01',
    periodEnd: '2023-12-31',
    inertia: 100,
    silhouetteScore: 0.5,
    daviesBouldinScore: 0.5,
    calinskiHarabaszScore: 0.5,
    featureNames: [],
    preprocessingConfig: {},
    notebookName: 'notebook',
    status: 'COMPLETED',
    active: true,
    executedAt: '2023-12-31T00:00:00Z',
    academicData: true,
    dataDisclaimer: 'Disclaimer',
    integrity: {
      expectedClusters: 2,
      actualProfiles: 2,
      expectedOrders: 100,
      assignedOrders: 100,
      profileOrdersSum: 100,
      profilePercentageSum: 100,
      consistent: true
    }
  };

  function profile(clusterNumber: number, orderCount: number): PurchaseClusterProfile {
    return {
      clusterNumber, clusterName: 'Cluster ' + clusterNumber, clusterDescription: null,
      orderCount, percentage: orderCount, recommendedAction: 'Acción de prueba',
      averageTotal: null, averageDiscountPct: null, averageShippingPct: null,
      averageUnitPrice: null, averageTotalUnits: null, averageUniqueProducts: null,
      averageUniqueCategories: null, averageUnitsPerProduct: null, averageAccessoryUnits: null,
      averageInstrumentUnits: null, averageViolinUnits: null, averageJaranaUnits: null,
      averageQuintaUnits: null, averageAccessoryValueShare: null, averageInstrumentValueShare: null,
      averageLargestProductValueShare: null, weekendPercentage: null,
      dominantPaymentMethod: null, dominantDeliveryType: null
    };
  }
  const mockProfiles: PurchaseClusterProfile[] = [profile(1, 40), profile(2, 60)];

  const emptyOrders: PurchaseClusterOrdersPage = { content: [], page: 0, size: 10, totalElements: 0, totalPages: 0, first: true, last: true, empty: true };

  beforeEach(async () => {
    clusteringServiceSpy = jasmine.createSpyObj<AdminPurchaseClusteringService>('AdminPurchaseClusteringService', [
      'getActiveSummary', 'getActiveProfiles', 'getActiveProfile', 'getClusterOrders'
    ]);
    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', ['hasPermission']);
    orderServiceSpy = jasmine.createSpyObj<OrderService>('OrderService', ['getOrderById']);

    authServiceSpy.hasPermission.and.returnValue(true);

    clusteringServiceSpy.getActiveSummary.and.returnValue(of(mockSummary));
    clusteringServiceSpy.getActiveProfiles.and.returnValue(of(mockProfiles));
    clusteringServiceSpy.getClusterOrders.and.returnValue(of(emptyOrders));

    await TestBed.configureTestingModule({
      imports: [AdminPurchaseClusteringComponent],
      providers: [
        provideZoneChangeDetection(), provideRouter([]),
        { provide: AdminPurchaseClusteringService, useValue: clusteringServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: OrderService, useValue: orderServiceSpy }
      ]
    }).overrideComponent(AdminPurchaseClusteringComponent, {
      remove: { imports: [AdminPurchaseClusteringPredictionComponent] },
      add: { imports: [PredictionStubComponent] }
    }).compileComponents();
    routerSpy = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    fixture = TestBed.createComponent(AdminPurchaseClusteringComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component.currentTab()).toBe('prediction');
    expect((fixture.nativeElement as HTMLElement).querySelector('app-admin-purchase-clustering-prediction')).not.toBeNull();
    expect(component).toBeTruthy();
  });

  it('should load initial data and select profile with highest orderCount', fakeAsync(() => {
    clusteringServiceSpy.getActiveSummary.and.returnValue(of(mockSummary));
    clusteringServiceSpy.getActiveProfiles.and.returnValue(of(mockProfiles));
    clusteringServiceSpy.getClusterOrders.and.returnValue(of(emptyOrders));
    
    fixture.detectChanges();
    tick();

    expect(component.summary()).toEqual(mockSummary);
    expect(component.selectedClusterNumber()).toBe(2); // Profile 2 has 60 orders
  }));

  it('should change cluster and reset page index', fakeAsync(() => {
    clusteringServiceSpy.getActiveSummary.and.returnValue(of(mockSummary));
    clusteringServiceSpy.getActiveProfiles.and.returnValue(of(mockProfiles));
    clusteringServiceSpy.getClusterOrders.and.returnValue(of(emptyOrders));
    
    fixture.detectChanges();
    tick();

    component.pageIndex.set(2);
    component.selectCluster(1);
    
    expect(component.selectedClusterNumber()).toBe(1);
    expect(component.pageIndex()).toBe(0);
  }));

  it('should change page', () => {
    component.selectedClusterNumber.set(1);
    clusteringServiceSpy.getClusterOrders.and.returnValue(of(emptyOrders));
    component.onPageChange(2);
    expect(component.pageIndex()).toBe(2);
  });

  it('should change size and reset page index', () => {
    component.selectedClusterNumber.set(1);
    component.pageIndex.set(2);
    clusteringServiceSpy.getClusterOrders.and.returnValue(of(emptyOrders));
    
    const select = document.createElement('select');
    select.add(new Option('50', '50'));
    select.value = '50';
    const change = new Event('change');
    select.addEventListener('change', event => component.onPageSizeChange(event), { once: true });
    select.dispatchEvent(change);
    
    expect(component.pageSize()).toBe(50);
    expect(component.pageIndex()).toBe(0);
  });

  it('should show academic data disclaimer if true', fakeAsync(() => {
    component.setTab('historical');
    clusteringServiceSpy.getActiveSummary.and.returnValue(of(mockSummary));
    clusteringServiceSpy.getActiveProfiles.and.returnValue(of(mockProfiles));
    clusteringServiceSpy.getClusterOrders.and.returnValue(of(emptyOrders));
    
    fixture.detectChanges();
    tick(50);
    fixture.detectChanges();
    
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('#tech-details')?.textContent).toContain('Origen del análisis: datos de demostración.');
    fixture.destroy();
    tick(50);
  }));

  it('should show integrity warning if inconsistent', fakeAsync(() => {
    component.setTab('historical');
    const inconsistentSummary = { ...mockSummary, integrity: { ...mockSummary.integrity, consistent: false } };
    clusteringServiceSpy.getActiveSummary.and.returnValue(of(inconsistentSummary));
    clusteringServiceSpy.getActiveProfiles.and.returnValue(of(mockProfiles));
    clusteringServiceSpy.getClusterOrders.and.returnValue(of(emptyOrders));
    
    fixture.detectChanges();
    tick(50);
    fixture.detectChanges();
    
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('#tech-details')?.textContent).toContain('Existen discrepancias entre el resumen y los perfiles.');
    expect(compiled.querySelector('.integrity-badge.inconsistent')).not.toBeNull();
    fixture.destroy();
    tick(50);
  }));

  it('should handle empty profiles without selecting', fakeAsync(() => {
    component.setTab('historical');
    clusteringServiceSpy.getActiveSummary.and.returnValue(of(mockSummary));
    clusteringServiceSpy.getActiveProfiles.and.returnValue(of([]));
    
    fixture.detectChanges();
    tick();
    
    expect(component.selectedClusterNumber()).toBeNull();
    expect(component.isLoading()).toBeFalse();
    expect(clusteringServiceSpy.getClusterOrders).not.toHaveBeenCalled();
  }));

  it('should handle errors correctly', fakeAsync(() => {
    component.setTab('historical');
    clusteringServiceSpy.getActiveSummary.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    clusteringServiceSpy.getActiveProfiles.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    
    fixture.detectChanges();
    tick();
    
    expect(component.error()).toContain('No hay ningún modelo de clustering activo en este momento.');
    expect(component.isLoading()).toBeFalse();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent).toContain(component.error()!);
    expect(clusteringServiceSpy.getClusterOrders).not.toHaveBeenCalled();
  }));

  it('should analyze historical order and navigate to prediction', () => {
    spyOn(window, 'scrollTo');
    component.analyzeHistoricalOrder(123);
    
    expect(routerSpy).toHaveBeenCalledWith([], {
      relativeTo: jasmine.anything(),
      queryParams: { orderId: '123' },
      queryParamsHandling: 'merge'
    });
    expect(component.currentTab()).toBe('prediction');
    expect(window.scrollTo).toHaveBeenCalled();
  });
});
