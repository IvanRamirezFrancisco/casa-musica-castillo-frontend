import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-payments-info',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './payments-info.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './payments-info.component.css'
})
export class PaymentsInfoComponent {
  transferSteps = [
    {
      step: '01',
      title: 'Selecciona Transferencia en Checkout',
      desc: 'Al confirmar tu pedido, el sistema te mostrará la cuenta autorizada y CLABE interbancaria de Casa de Música Castillo.'
    },
    {
      step: '02',
      title: 'Realiza tu transferencia o depósito',
      desc: 'Efectúa el pago por el importe exacto de tu pedido desde tu banca móvil o en ventanilla bancaria y conserva tu comprobante.'
    },
    {
      step: '03',
      title: 'Sube tu comprobante en "Mis Pedidos"',
      desc: 'Ingresa a tu cuenta, localiza tu pedido y adjunta una imagen o captura legible donde se aprecie la referencia y el monto.'
    },
    {
      step: '04',
      title: 'Validación administrativa',
      desc: 'Nuestro equipo verificará el comprobante y actualizará el estado de tu pedido para iniciar su preparación o recolección.'
    }
  ];

  paymentFaqs = [
    {
      question: '¿Cuáles son los únicos métodos de pago aceptados en la tienda en línea?',
      answer: 'Actualmente operamos exclusivamente mediante dos modalidades oficiales en el Checkout: pago en línea a través de la pasarela segura de Mercado Pago y Transferencia o Depósito Bancario directo a nuestra cuenta autorizada.',
      isOpen: true
    },
    {
      question: '¿Qué diferencia hay en el tiempo de validación entre Mercado Pago y Transferencia?',
      answer: 'Los pagos procesados y aprobados en Mercado Pago actualizan tu pedido de forma automática. En cambio, las transferencias o depósitos requieren que subas tu comprobante en la sección "Mis Pedidos" para que sea validado manualmente por administración.',
      isOpen: false
    },
    {
      question: '¿Dónde subo mi comprobante de transferencia bancaria?',
      answer: 'Una vez generado tu pedido, dirígete a la sección "Mis Pedidos" en tu perfil de usuario. Ahí encontrarás la opción para adjuntar la fotografía o captura de pantalla de tu comprobante.',
      isOpen: false
    },
    {
      question: '¿Es seguro pagar en línea en Casa de Música Castillo?',
      answer: 'Sí. Nunca almacenamos datos confidenciales de tarjetas como CVV o NIP. Además, jamás te solicitaremos contraseñas bancarias ni enlaces de pago externos por correo o mensajería.',
      isOpen: false
    }
  ];

  toggleFaq(index: number): void {
    this.paymentFaqs[index].isOpen = !this.paymentFaqs[index].isOpen;
  }
}

