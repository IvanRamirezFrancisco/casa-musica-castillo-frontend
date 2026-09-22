import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-information-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="info-page-container">
      <div class="info-header">
        <h1>{{ title }}</h1>
      </div>
      <div class="info-content">
        <div class="pending-notice">
          <span class="material-icons">pending_actions</span>
          <h3>Contenido Pendiente de Definición</h3>
          <p>
            Esta página forma parte de la estructura técnica comercial. 
            El contenido real de las políticas será definido y redactado por el propietario 
            de Casa de Música Castillo en una fase posterior para evitar generar textos legales o comerciales ficticios.
          </p>
        </div>
        
        <!-- Bloques predefinidos según el tipo de página (Estructura Técnica) -->
        <div *ngIf="pageType === 'envios'" class="structure-block">
          <h2>Secciones a definir:</h2>
          <ul>
            <li>Políticas de Entrega a Domicilio</li>
            <li>Recolección en Tienda (Pickup)</li>
            <li>Costos y Plazos de Envío</li>
            <li>Seguimiento de Pedidos</li>
          </ul>
        </div>

        <div *ngIf="pageType === 'cancelaciones'" class="structure-block">
          <h2>Secciones a definir:</h2>
          <ul>
            <li>Condiciones para Cancelación por Cliente</li>
            <li>Tiempos máximos de cancelación antes del envío</li>
            <li>Proceso de Reembolso</li>
            <li><em>Nota: El sistema actual soporta cancelaciones, pero no procesamientos automáticos de devolución.</em></li>
          </ul>
        </div>

        <div *ngIf="pageType === 'pagos'" class="structure-block">
          <h2>Secciones a definir:</h2>
          <ul>
            <li>Transferencia Bancaria (instrucciones y validación)</li>
            <li>Mercado Pago (tarjetas y medios admitidos por la pasarela)</li>
            <li>Facturación</li>
          </ul>
        </div>

        <div *ngIf="pageType === 'terminos'" class="structure-block">
          <h2>Secciones a definir:</h2>
          <ul>
            <li>Condiciones de uso de la plataforma</li>
            <li>Derechos y Obligaciones</li>
            <li>Políticas de precios y disponibilidad</li>
            <li>Jurisdicción aplicable</li>
          </ul>
        </div>

        <div *ngIf="pageType === 'privacidad'" class="structure-block">
          <h2>Secciones a definir:</h2>
          <ul>
            <li>Identidad del responsable (Casa de Música Castillo)</li>
            <li>Datos tratados y Finalidades</li>
            <li>Uso de tecnologías de seguimiento (Cookies) si aplican</li>
            <li>Ejercicio de Derechos ARCO</li>
          </ul>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .info-page-container {
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      font-family: 'Inter', sans-serif;
      min-height: 60vh;
    }
    .info-header h1 {
      color: #722F37;
      font-size: 2rem;
      border-bottom: 2px solid rgba(197, 160, 89, 0.3);
      padding-bottom: 10px;
      margin-bottom: 30px;
    }
    .pending-notice {
      background: #FCFAF7;
      border-left: 4px solid #C5A059;
      padding: 20px;
      border-radius: 4px;
      margin-bottom: 30px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .pending-notice .material-icons {
      color: #C5A059;
      font-size: 32px;
    }
    .pending-notice h3 {
      margin: 0;
      color: #5A252C;
    }
    .pending-notice p {
      margin: 0;
      color: #444;
      line-height: 1.5;
    }
    .structure-block h2 {
      color: #292524;
      font-size: 1.25rem;
      margin-bottom: 15px;
    }
    .structure-block ul {
      list-style-type: disc;
      padding-left: 25px;
      color: #444;
      line-height: 1.8;
    }
  `]
})
export class InformationPageComponent implements OnInit {
  pageType: string = '';
  title: string = '';

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      this.pageType = data['type'] || 'general';
      this.title = data['title'] || 'Información';
    });
  }
}
