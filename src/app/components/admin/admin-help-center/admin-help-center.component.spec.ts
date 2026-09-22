import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminHelpCenterComponent } from './admin-help-center.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { HelpCenterService } from '../../../services/help-center.service';
import { of } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';

describe('AdminHelpCenterComponent Diagnostic', () => {
  let component: AdminHelpCenterComponent;
  let fixture: ComponentFixture<AdminHelpCenterComponent>;

  beforeEach(async () => {
    const mockService = {
      getAdminCategories: () => of([]),
      getAdminFaqs: () => of([])
    };

    await TestBed.configureTestingModule({
      imports: [AdminHelpCenterComponent, HttpClientTestingModule, FormsModule],
      providers: [
        { provide: HelpCenterService, useValue: mockService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminHelpCenterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('Diagnostic Test - Category Modal ElementFromPoint', (done) => {
    // Abrir Modal
    component.openCategoryModal();
    fixture.detectChanges();
    
    // Esperar a que renderice
    setTimeout(() => {
      // 1. Obtener Input Nombre
      const input = fixture.debugElement.query(By.css('input[placeholder="Ej. Envíos y Entregas"]'));
      if (!input) {
         console.log('--- START DIAGNOSTIC ---');
         console.log('ERROR: No se encontro el input');
         done();
         return;
      }
      const inputEl = input.nativeElement;

      const rect = inputEl.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      
      const elFromPoint = document.elementFromPoint(x, y);
      console.log('--- START DIAGNOSTIC ---');
      console.log('INPUT NOMBRE FROM POINT:', elFromPoint ? elFromPoint.tagName + '.' + elFromPoint.className : 'null');
      console.log('ES INPUT REAL?', elFromPoint === inputEl);
      
      let inertAncestor = null;
      let curr = inputEl;
      while(curr) {
        if (curr.hasAttribute && curr.hasAttribute('inert')) {
          inertAncestor = curr;
          break;
        }
        curr = curr.parentElement;
      }
      console.log('INERT ANCESTOR?', inertAncestor ? inertAncestor.tagName + '.' + inertAncestor.className : 'none');
      
      const compStyle = getComputedStyle(inputEl);
      console.log('POINTER-EVENTS:', compStyle.pointerEvents);
      
      console.log('ISSAVING?', component.isLoading);
      
      const backdrops = document.querySelectorAll('.modal-backdrop');
      console.log('NUM BACKDROPS:', backdrops.length);
      
      console.log('--- END DIAGNOSTIC ---');
      done();
    }, 500);
  });
});
