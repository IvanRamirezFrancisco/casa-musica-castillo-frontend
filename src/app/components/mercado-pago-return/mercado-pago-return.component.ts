import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';


@Component({
  selector: 'app-mercado-pago-return',
  standalone: true,
  imports: [],
  template: `
    <div class="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-center">
      <div class="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center border border-gray-100">

        <!-- SUCCESS -->
        @if (status === 'success') {
          <div class="mb-6">
            <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i class="fa-solid fa-check text-2xl text-green-600"></i>
            </div>
            <h2 class="text-2xl font-bold text-gray-900 mb-2">¡Pago en proceso de confirmación!</h2>
            <p class="text-gray-600">
              Recibimos la respuesta de Mercado Pago. Estamos confirmando tu pago.
              El estado de tu orden se actualizará en breve.
            </p>
          </div>
        }

        <!-- PENDING -->
        @if (status === 'pending') {
          <div class="mb-6">
            <div class="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i class="fa-solid fa-clock text-2xl text-yellow-600"></i>
            </div>
            <h2 class="text-2xl font-bold text-gray-900 mb-2">Pago pendiente</h2>
            <p class="text-gray-600">
              Tu pago está pendiente de confirmación en Mercado Pago (ej. pago en efectivo).
              Te notificaremos cuando se acredite.
            </p>
          </div>
        }

        <!-- FAILURE -->
        @if (status === 'failure') {
          <div class="mb-6">
            <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i class="fa-solid fa-xmark text-2xl text-red-600"></i>
            </div>
            <h2 class="text-2xl font-bold text-gray-900 mb-2">Pago no completado</h2>
            <p class="text-gray-600">
              El pago no se completó o fue rechazado por Mercado Pago. Puedes intentar nuevamente.
            </p>
          </div>
        }

        <div class="mt-8 space-y-3">
          <button (click)="goToOrder()"
            class="w-full bg-[#16a34a] hover:bg-[#15803d] text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2">
            <i class="fa-solid fa-file-invoice"></i> Ver mi orden
          </button>

          <button (click)="goToHome()"
            class="w-full bg-white hover:bg-gray-50 text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors border border-gray-300 flex items-center justify-center gap-2">
            <i class="fa-solid fa-house"></i> Volver al inicio
          </button>
        </div>
      </div>
    </div>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: []
})
export class MercadoPagoReturnComponent implements OnInit {
  status: 'success' | 'pending' | 'failure' = 'pending';
  orderId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Detectamos la ruta actual
    const path = this.route.snapshot.url[this.route.snapshot.url.length - 1].path;
    if (path === 'success' || path === 'failure' || path === 'pending') {
      this.status = path;
    }
    
    // Extraemos el orderId de los query params
    this.route.queryParams.subscribe(params => {
      this.orderId = params['orderId'];
    });
  }

  goToOrder(): void {
    if (this.orderId) {
      this.router.navigate(['/orders/my', this.orderId]);
    } else {
      this.router.navigate(['/orders/my']);
    }
  }

  goToHome(): void {
    this.router.navigate(['/']);
  }
}
