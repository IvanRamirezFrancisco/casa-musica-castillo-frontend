import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminPaymentSettingsComponent } from './admin-payment-settings.component';

describe('AdminPaymentSettingsComponent', () => {
  let component: AdminPaymentSettingsComponent;
  let fixture: ComponentFixture<AdminPaymentSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminPaymentSettingsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminPaymentSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
