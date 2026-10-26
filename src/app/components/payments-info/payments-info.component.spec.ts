import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaymentsInfoComponent } from './payments-info.component';

describe('PaymentsInfoComponent', () => {
  let component: PaymentsInfoComponent;
  let fixture: ComponentFixture<PaymentsInfoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([])],
      imports: [PaymentsInfoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PaymentsInfoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
