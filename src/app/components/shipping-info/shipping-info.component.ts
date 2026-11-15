import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-shipping-info',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './shipping-info.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './shipping-info.component.css'
})
export class ShippingInfoComponent {
  processSteps = [
    {
      step: '01',
      icon: 'verified',
      title: 'Confirmación de pago',
      desc: 'Una vez validado tu pago (automático por Mercado Pago o manual tras revisar tu comprobante de transferencia), tu pedido pasa a preparación.'
    },
    {
      step: '02',
      icon: 'inventory_2',
      title: 'Inspección y embalaje',
      desc: 'Revisamos cuidadosamente tu instrumento o equipo de audio y lo protegemos adecuadamente según su fragilidad y dimensiones.'
    },
    {
      step: '03',
      icon: 'notifications_active',
      title: 'Despacho o aviso de recolección',
      desc: 'Actualizamos el estado en "Mis Pedidos" indicando si tu compra fue enviada a domicilio o si ya está lista para recoger en tienda.'
    },
    {
      step: '04',
      icon: 'handshake',
      title: 'Entrega segura',
      desc: 'Recibes tu pedido en la dirección registrada o lo recoges sin costo en nuestra sucursal presentando tu código seguro.'
    }
  ];

  receptionTips = [
    {
      icon: 'box_add',
      title: 'Verifica el estado del empaque',
      text: 'Al recibir tu paquete, comprueba que la caja o estuche se encuentre sellado y sin daños externos visibles antes de firmar de recibido.'
    },
    {
      icon: 'pin',
      title: 'Ten listo tu código de recolección',
      text: 'Si elegiste Recolección en tienda, consulta el código seguro en la sección "Mis Pedidos" cuando el estado cambie a Listo para Recolección.'
    },
    {
      icon: 'location_on',
      title: 'Sucursal física en Huejutla',
      text: 'Para recolecciones en tienda te esperamos en C. Morelos 18, Col. Centro, C.P. 43000, Huejutla de Reyes, Hidalgo.'
    }
  ];

  shippingFaqs = [
    {
      question: '¿Cómo se calcula el costo de envío a domicilio?',
      answer: 'El costo y la disponibilidad de envío se calculan automáticamente durante el proceso de compra (Checkout) en función de tu código postal y del volumen de los productos seleccionados.',
      isOpen: true
    },
    {
      question: '¿Qué sucede si mi código postal está fuera de la zona de cobertura automática?',
      answer: 'Si el sistema detecta que tu dirección requiere logística foránea o llevas instrumentos pesados/voluminosos, podrás solicitar una cotización personalizada con asistencia directa por WhatsApp.',
      isOpen: false
    },
    {
      question: '¿Tiene algún costo recoger mi pedido en la tienda?',
      answer: 'No. La modalidad de Recolección en tienda es completamente gratuita. Te notificaremos en tu cuenta en cuanto tu pedido esté listo para entregarse en sucursal.',
      isOpen: false
    },
    {
      question: '¿Dónde puedo consultar el seguimiento de mi entrega?',
      answer: 'Puedes revisar el estado actual, el historial de avances y los detalles de entrega o recolección ingresando a la sección "Mis Pedidos" dentro de tu cuenta.',
      isOpen: false
    }
  ];

  toggleFaq(index: number): void {
    this.shippingFaqs[index].isOpen = !this.shippingFaqs[index].isOpen;
  }
}

