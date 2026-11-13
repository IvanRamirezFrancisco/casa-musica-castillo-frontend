import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';

export interface InfoSection {
  id: string;
  number: string;
  icon: string;
  title: string;
  summary: string;
  points: string[];
  note?: string;
}

@Component({
  selector: 'app-information-page',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="min-h-screen bg-[#FCFAF7] pb-20 font-sans text-[#292524]">
      <!-- Hero Editorial Header -->
      <header class="relative overflow-hidden bg-gradient-to-br from-[#722F37] via-[#5A252C] to-[#3d171c] text-white py-14 sm:py-18 px-4 sm:px-6 lg:px-8">
        <div class="absolute inset-0 pointer-events-none opacity-20"
        style="background: radial-gradient(circle at 85% 20%, #C5A059 0%, transparent 55%), radial-gradient(circle at 15% 85%, #C5A059 0%, transparent 50%);"></div>

        <div class="max-w-6xl mx-auto relative z-10">
          <!-- Breadcrumb (Visible solo en móvil; oculto en escritorio donde ya existe la barra de navegación principal) -->
          <nav aria-label="Breadcrumb" class="cmc-mobile-breadcrumb flex md:hidden items-center gap-1.5 text-xs text-[#FFFDFC]/90 mb-5 max-w-full overflow-hidden flex-nowrap px-3.5 py-1 rounded-full bg-black/25 border border-white/20 w-fit">
            <a routerLink="/home" class="cmc-breadcrumb-home !text-[#FFFDFC] hover:!text-[#E2B84F] transition-colors inline-flex items-center gap-1 shrink-0 min-h-[32px] py-1 px-1 rounded focus:outline-none focus:ring-2 focus:ring-[#E2B84F]">
              <span class="material-icons text-sm !text-inherit" aria-hidden="true">home</span>
              <span class="!text-inherit font-medium">Inicio</span>
            </a>
            <span class="cmc-breadcrumb-sep material-icons text-xs !text-[#FFFDFC]/65 shrink-0" aria-hidden="true">chevron_right</span>
            <span class="cmc-breadcrumb-mid !text-[#FFFDFC]/90 shrink-0 truncate max-w-[110px]">{{ categoryBadge }}</span>
            <span class="cmc-breadcrumb-sep material-icons text-xs !text-[#FFFDFC]/65 shrink-0" aria-hidden="true">chevron_right</span>
            <span class="cmc-breadcrumb-current !text-[#E2B84F] font-semibold truncate min-w-0" aria-current="page">{{ title }}</span>
          </nav>

          <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#C5A059]/20 border border-[#C5A059]/40 text-[#E2B84F] text-xs font-bold uppercase tracking-widest mb-4">
            <span class="material-icons text-sm" aria-hidden="true">{{ heroIcon }}</span>
            {{ categoryBadge }}
          </div>

          <h1 class="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight mb-4">
            {{ title }}
          </h1>
          <p class="text-base sm:text-lg text-white/85 max-w-2xl leading-relaxed">
            {{ subtitle }}
          </p>
        </div>
      </header>

      <!-- Main Layout -->
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-20">
        <!-- Honest Provisional / Commercial Validation Notice -->
        <div class="bg-white border border-[#C5A059]/40 rounded-2xl p-5 sm:p-6 shadow-sm mb-8 flex flex-col sm:flex-row items-start gap-4">
          <div class="w-11 h-11 rounded-xl bg-[#FAF6F0] border border-[#C5A059]/30 flex items-center justify-center text-[#722F37] shrink-0">
            <span class="material-icons text-2xl" aria-hidden="true">verified_user</span>
          </div>
          <div class="flex-1">
            <div class="flex flex-wrap items-center gap-2 mb-1">
              <h2 class="text-sm sm:text-base font-bold text-[#5A252C]">
                Documento informativo estructurado · En validación comercial final
              </h2>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900">
                Disponible sin conexión
              </span>
            </div>
            <p class="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Esta guía refleja el funcionamiento real de la plataforma digital de <strong>Casa de Música Castillo</strong>.
              Las cláusulas definitivas se encuentran sujetas a validación administrativa del titular comercial para garantizar transparencia y evitar disposiciones ficticias.
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <!-- Sidebar Index (Sticky on Desktop) -->
          <aside class="lg:col-span-4 lg:sticky lg:top-24 bg-white rounded-2xl border border-[#E5E0D8] p-5 shadow-sm">
            <h2 class="text-xs font-bold uppercase tracking-widest text-[#722F37] mb-3 flex items-center gap-2">
              <span class="material-icons text-base" aria-hidden="true">toc</span>
              Índice de secciones ({{ sections.length }})
            </h2>
            <nav aria-label="Índice del documento" class="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
              @for (sec of sections; track sec) {
                <a
                  [href]="'#' + sec.id"
                  (click)="scrollToSection($event, sec.id)"
                  class="group flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all"
                 [ngClass]="activeSectionId === sec.id
                   ? 'bg-[#722F37] text-white shadow-sm'
                   : 'text-slate-600 hover:bg-[#FAF6F0] hover:text-[#722F37]'">
                  <span class="font-mono text-[11px] px-1.5 py-0.5 rounded"
                    [ngClass]="activeSectionId === sec.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500 group-hover:text-[#722F37]'">
                    {{ sec.number }}
                  </span>
                  <span class="truncate">{{ sec.title }}</span>
                </a>
              }
            </nav>

            <!-- Related Pages Quick Links -->
            <div class="mt-6 pt-5 border-t border-slate-100">
              <p class="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Documentos relacionados</p>
              <div class="flex flex-col gap-2 text-xs font-semibold">
                @if (pageType !== 'terminos') {
                  <a routerLink="/terminos"
                    class="flex items-center justify-between px-3 py-2 rounded-xl bg-[#FCFAF7] hover:bg-[#FAF6F0] text-slate-700 hover:text-[#722F37] border border-slate-200/70 transition-colors">
                    <span>Términos y Condiciones</span>
                    <span class="material-icons text-sm" aria-hidden="true">arrow_forward</span>
                  </a>
                }
                @if (pageType !== 'privacidad') {
                  <a routerLink="/privacidad"
                    class="flex items-center justify-between px-3 py-2 rounded-xl bg-[#FCFAF7] hover:bg-[#FAF6F0] text-slate-700 hover:text-[#722F37] border border-slate-200/70 transition-colors">
                    <span>Aviso de Privacidad</span>
                    <span class="material-icons text-sm" aria-hidden="true">arrow_forward</span>
                  </a>
                }
                <a routerLink="/informacion/envios"
                  class="flex items-center justify-between px-3 py-2 rounded-xl bg-[#FCFAF7] hover:bg-[#FAF6F0] text-slate-700 hover:text-[#722F37] border border-slate-200/70 transition-colors">
                  <span>Envíos y Entregas</span>
                  <span class="material-icons text-sm" aria-hidden="true">arrow_forward</span>
                </a>
                <a routerLink="/informacion/pagos"
                  class="flex items-center justify-between px-3 py-2 rounded-xl bg-[#FCFAF7] hover:bg-[#FAF6F0] text-slate-700 hover:text-[#722F37] border border-slate-200/70 transition-colors">
                  <span>Formas de Pago</span>
                  <span class="material-icons text-sm" aria-hidden="true">arrow_forward</span>
                </a>
                @if (pageType !== 'cancelaciones') {
                  <a routerLink="/informacion/cancelaciones"
                    class="flex items-center justify-between px-3 py-2 rounded-xl bg-[#FCFAF7] hover:bg-[#FAF6F0] text-slate-700 hover:text-[#722F37] border border-slate-200/70 transition-colors">
                    <span>Política de Cancelaciones</span>
                    <span class="material-icons text-sm" aria-hidden="true">arrow_forward</span>
                  </a>
                }
                <a routerLink="/ayuda"
                  class="flex items-center justify-between px-3 py-2 rounded-xl bg-[#FCFAF7] hover:bg-[#FAF6F0] text-slate-700 hover:text-[#722F37] border border-slate-200/70 transition-colors">
                  <span>Centro de Ayuda (FAQ)</span>
                  <span class="material-icons text-sm" aria-hidden="true">arrow_forward</span>
                </a>
              </div>
            </div>
          </aside>

          <!-- Main Content Sections -->
          <main class="lg:col-span-8 space-y-5">
            @for (sec of sections; track sec) {
              <article
                [id]="sec.id"
                class="bg-white rounded-2xl border border-[#E5E0D8] p-6 sm:p-8 shadow-sm hover:border-[#C5A059]/50 transition-colors scroll-mt-28">
                <div class="flex items-start gap-4 mb-4">
                  <div class="w-11 h-11 rounded-xl bg-[#722F37]/10 text-[#722F37] flex items-center justify-center shrink-0 font-bold">
                    <span class="material-icons text-xl" aria-hidden="true">{{ sec.icon }}</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <span class="text-xs font-bold uppercase tracking-widest text-[#C5A059] block mb-0.5">
                      Sección {{ sec.number }}
                    </span>
                    <h3 class="text-lg sm:text-xl font-bold text-[#292524] leading-snug">
                      {{ sec.title }}
                    </h3>
                  </div>
                </div>
                <p class="text-sm sm:text-base text-slate-600 leading-relaxed mb-4">
                  {{ sec.summary }}
                </p>
                <ul class="space-y-2.5">
                  @for (point of sec.points; track point) {
                    <li class="flex items-start gap-3 text-sm text-slate-700 leading-relaxed">
                      <span class="material-icons text-[#C5A059] text-lg mt-0.5 shrink-0" aria-hidden="true">check_circle</span>
                      <span>{{ point }}</span>
                    </li>
                  }
                </ul>
                @if (sec.note) {
                  <div
                    class="mt-5 p-4 rounded-xl bg-[#FAF6F0] border-l-4 border-[#C5A059] text-xs sm:text-sm text-slate-700 leading-relaxed">
                    <strong class="text-[#5A252C]">Nota operativa:</strong> {{ sec.note }}
                  </div>
                }
              </article>
            }

            <!-- Official Contact Card -->
            <section class="bg-gradient-to-br from-[#722F37] to-[#5A252C] rounded-2xl p-6 sm:p-8 text-white shadow-md">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                  <span class="text-xs font-bold uppercase tracking-widest text-[#E2B84F] block mb-1">Atención Oficial</span>
                  <h3 class="text-xl font-bold text-white mb-2">Casa de Música Castillo</h3>
                  <p class="text-sm text-white/85 leading-relaxed max-w-xl">
                    C. Morelos 18, Col. Centro, C.P. 43000, Huejutla de Reyes, Hidalgo, México.
                    Para dudas sobre tus pedidos, pagos o ejercicio de derechos de privacidad, consulta nuestro Centro de Ayuda.
                  </p>
                </div>
                <div class="flex flex-wrap sm:flex-col gap-3 shrink-0">
                  <a routerLink="/ayuda"
                    class="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#C5A059] hover:bg-[#d1b171] text-slate-950 font-bold text-sm transition-colors">
                    <span class="material-icons text-base" aria-hidden="true">help_outline</span>
                    Ir al Centro de Ayuda
                  </a>
                  <a routerLink="/catalogo"
                    class="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm border border-white/20 transition-colors">
                    Explorar Catálogo
                  </a>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
    `
})
export class InformationPageComponent implements OnInit {
  pageType = 'terminos';
  title = 'Información Legal y Comercial';
  subtitle = '';
  categoryBadge = 'Información Legal';
  heroIcon = 'gavel';
  activeSectionId = '';
  sections: InfoSection[] = [];

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      this.pageType = data['type'] || 'terminos';
      this.title = data['title'] || 'Información';
      this.configurePage(this.pageType);
    });
  }

  scrollToSection(event: Event, sectionId: string): void {
    event.preventDefault();
    this.activeSectionId = sectionId;
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  private configurePage(type: string): void {
    if (type === 'privacidad') {
      this.categoryBadge = 'Privacidad y Datos';
      this.heroIcon = 'shield';
      this.subtitle = 'Conoce cómo protegemos y tratamos tu información personal dentro de la plataforma digital de Casa de Música Castillo.';
      this.sections = [
        {
          id: 'responsable',
          number: '01',
          icon: 'storefront',
          title: 'Responsable del tratamiento',
          summary: 'Identificación de la entidad comercial encargada del resguardo y tratamiento de los datos personales recabados en esta aplicación web.',
          points: [
            'Denominación comercial: Casa de Música Castillo.',
            'Ubicación física de referencia: C. Morelos 18, Col. Centro, C.P. 43000, Huejutla de Reyes, Hidalgo.',
            'Ámbito de aplicación: plataforma web y Aplicación Web Progresiva (PWA) oficial.'
          ]
        },
        {
          id: 'datos-recopilados',
          number: '02',
          icon: 'badge',
          title: 'Datos personales recopilados',
          summary: 'Recabamos únicamente los datos estrictamente necesarios para gestionar tu cuenta, procesar compras y coordinar entregas.',
          points: [
            'Datos de identificación y contacto: nombre completo, correo electrónico y número telefónico.',
            'Datos de entrega: dirección de envío, código postal y referencias de domicilio cuando solicitas entrega a domicilio.',
            'Evidencias de pago: imágenes o comprobantes de transferencia/depósito bancario subidos por el usuario en su panel de pedidos.',
            'No almacenamos números completos de tarjetas bancarias, CVV ni NIP; los pagos con tarjeta se procesan directamente en la pasarela externa de Mercado Pago.'
          ]
        },
        {
          id: 'finalidades',
          number: '03',
          icon: 'task_alt',
          title: 'Finalidades del tratamiento',
          summary: 'La información proporcionada se utiliza para operar los servicios esenciales de comercio electrónico de la tienda.',
          points: [
            'Creación, verificación y administración de tu cuenta de usuario.',
            'Procesamiento de pedidos, cálculo de envío o generación de código seguro para recolección en tienda.',
            'Validación manual de comprobantes de transferencia bancaria y seguimiento del estado del pedido.',
            'Atención de dudas, aclaraciones, garantías y soporte posventa.'
          ]
        },
        {
          id: 'conservacion',
          number: '04',
          icon: 'inventory_2',
          title: 'Condiciones de tratamiento y conservación',
          summary: 'Los datos se conservan bajo criterios de confidencialidad y únicamente durante el periodo necesario para cumplir con las finalidades operativas.',
          points: [
            'Acceso restringido exclusivamente al personal autorizado de administración para validar pedidos y entregas.',
            'Conservación del historial de pedidos para fines de seguimiento, comprobación de compra y atención al cliente.'
          ]
        },
        {
          id: 'transferencias',
          number: '05',
          icon: 'sync_alt',
          title: 'Transferencias y servicios de terceros',
          summary: 'Casa de Música Castillo no comercializa ni vende datos personales a terceros.',
          points: [
            'Pasarela de pago: cuando eliges pagar con Mercado Pago, la transacción se realiza bajo los controles y políticas de seguridad de dicha plataforma.',
            'Servicios de mensajería o logística: únicamente los datos de contacto y domicilio indispensables para concretar la entrega de tu instrumento.'
          ]
        },
        {
          id: 'derechos-arco',
          number: '06',
          icon: 'manage_accounts',
          title: 'Derechos ARCO (Acceso, Rectificación, Cancelación y Oposición)',
          summary: 'Como titular de tus datos personales, cuentas con mecanismos para consultar y actualizar tu información.',
          points: [
            'Acceso y Rectificación: puedes consultar y actualizar tus datos de perfil y seguridad directamente desde tu panel de cuenta.',
            'Cancelación y Oposición: puedes solicitar orientación o gestionar solicitudes relativas a tu cuenta a través de los canales oficiales de contacto de la tienda.'
          ],
          note: 'El procedimiento formal y los plazos legales específicos de respuesta ARCO se actualizarán conforme a la validación jurídica final del titular.'
        },
        {
          id: 'cookies-pwa',
          number: '07',
          icon: 'devices',
          title: 'Uso de cookies y almacenamiento local (PWA)',
          summary: 'La aplicación utiliza almacenamiento del navegador para mantener tu sesión segura y ofrecer consulta rápida sin conexión.',
          points: [
            'Autenticación: almacenamiento local de sesión (JWT) para mantener tu acceso activo mientras utilizas la plataforma.',
            'Cache Storage de la PWA: guarda exclusivamente recursos estáticos (App Shell) y datos públicos del catálogo, categorías y preguntas frecuentes para consulta offline.',
            'Privacidad en caché: los endpoints privados de perfil, carrito, pedidos, pagos y administración jamás se almacenan en la caché pública del Service Worker.'
          ]
        },
        {
          id: 'seguridad',
          number: '08',
          icon: 'enhanced_encryption',
          title: 'Medidas de seguridad',
          summary: 'Implementamos controles técnicos en el frontend y backend para proteger tu información.',
          points: [
            'Comunicación cifrada mediante protocolo HTTPS en todos los entornos de producción.',
            'Verificación de cuenta por correo electrónico, recuperación segura de contraseña y controles de sesión.'
          ]
        },
        {
          id: 'cambios-aviso',
          number: '09',
          icon: 'update',
          title: 'Cambios al aviso de privacidad',
          summary: 'Cualquier actualización a este aviso será publicada directamente en esta ruta (/privacidad) dentro de la aplicación.',
          points: [
            'Te recomendamos consultar periódicamente esta sección para conocer mejoras en nuestras prácticas de privacidad.'
          ]
        },
        {
          id: 'contacto-privacidad',
          number: '10',
          icon: 'contact_support',
          title: 'Contacto de privacidad',
          summary: 'Canales de atención para dudas relacionadas con el tratamiento de datos personales.',
          points: [
            'Atención presencial en sucursal: C. Morelos 18, Centro, Huejutla de Reyes, Hgo.',
            'Orientación en línea a través de la sección Centro de Ayuda (/ayuda).'
          ]
        }
      ];
    } else if (type === 'cancelaciones') {
      this.categoryBadge = 'Atención al Cliente';
      this.heroIcon = 'event_busy';
      this.subtitle = 'Consulta las condiciones operativas para solicitar la cancelación de un pedido antes de su envío o entrega.';
      this.sections = [
        {
          id: 'condiciones-cancelacion',
          number: '01',
          icon: 'rule',
          title: 'Condiciones para cancelación por el cliente',
          summary: 'Puedes solicitar la cancelación de un pedido desde tu cuenta siempre que no haya sido despachado o entregado.',
          points: [
            'Las solicitudes proceden cuando el pedido aún se encuentra en etapa de revisión de pago o preparación inicial.',
            'Si el pedido ya fue entregado a paquetería o recolectado en sucursal, no podrá cancelarse mediante el flujo automático.'
          ]
        },
        {
          id: 'tiempos-estados',
          number: '02',
          icon: 'schedule',
          title: 'Estados del pedido elegibles antes del envío',
          summary: 'Dentro de la sección "Mis Pedidos" podrás verificar en tiempo real el estado actual de tu compra.',
          points: [
            'Pendiente de pago / En validación de comprobante: elegible para cancelación.',
            'En preparación (antes de despacho): sujeto a confirmación de que el instrumento aún no ha salido de almacén.',
            'Enviado o Entregado: requiere contacto directo con soporte de la tienda para revisión del caso.'
          ]
        },
        {
          id: 'proceso-reembolso',
          number: '03',
          icon: 'currency_exchange',
          title: 'Proceso de revisión y reembolso',
          summary: 'Transparencia sobre el tratamiento de pagos cuando una cancelación es autorizada.',
          points: [
            'Si aún no habías realizado el pago o subido comprobante, el pedido se cancela sin cargos.',
            'Si ya habías realizado transferencia bancaria o pago en Mercado Pago, el equipo administrativo verificará la operación para coordinar la devolución correspondiente.'
          ],
          note: 'El sistema actual registra y gestiona la solicitud de cancelación, pero no ejecuta reembolsos bancarios automáticos sin supervisión administrativa.'
        },
        {
          id: 'soporte-cancelaciones',
          number: '04',
          icon: 'support_agent',
          title: 'Asistencia personalizada',
          summary: 'Nuestro equipo en Huejutla de Reyes está disponible para apoyarte en cualquier aclaración sobre tu pedido.',
          points: [
            'Revisa el historial y estado de tu compra en la sección "Mis Pedidos".',
            'Consulta las preguntas frecuentes en nuestro Centro de Ayuda (/ayuda).'
          ]
        }
      ];
    } else {
      // Default: 'terminos' (Términos y Condiciones)
      this.categoryBadge = 'Marco Comercial y Uso';
      this.heroIcon = 'gavel';
      this.subtitle = 'Lineamientos de uso de la plataforma digital, proceso de compra, pagos y entregas de Casa de Música Castillo.';
      this.sections = [
        {
          id: 'uso-plataforma',
          number: '01',
          icon: 'language',
          title: 'Uso de la plataforma',
          summary: 'La aplicación web de Casa de Música Castillo permite explorar el catálogo de instrumentos, accesorios y equipo de audio, así como gestionar pedidos en línea.',
          points: [
            'La consulta del catálogo público, categorías, detalle de productos y páginas informativas está disponible para todos los visitantes, incluso en modo de lectura sin conexión (PWA).',
            'El usuario se compromete a hacer un uso lícito y respetuoso de la plataforma, evitando acciones que afecten la disponibilidad del servicio.'
          ]
        },
        {
          id: 'cuenta-usuario',
          number: '02',
          icon: 'person_outline',
          title: 'Cuenta de usuario y seguridad',
          summary: 'Para realizar compras, guardar favoritos o dar seguimiento a pedidos es necesario contar con una cuenta registrada y verificada.',
          points: [
            'El usuario es responsable de proporcionar información verídica y mantener la confidencialidad de su contraseña.',
            'Las acciones de inicio de sesión, registro, recuperación de contraseña y cambios de seguridad requieren conexión activa a Internet.'
          ]
        },
        {
          id: 'disponibilidad-productos',
          number: '03',
          icon: 'inventory',
          title: 'Disponibilidad de productos',
          summary: 'El inventario mostrado en el catálogo corresponde a las existencias registradas en el sistema de Casa de Música Castillo.',
          points: [
            'Cada ficha de producto indica si el artículo se encuentra disponible o agotado.',
            'Cuando se navega sin conexión mostrando información guardada en caché, la disponibilidad mostrada es referencial y se valida en tiempo real al reconectarse y proceder al checkout.'
          ]
        },
        {
          id: 'precios-promociones',
          number: '04',
          icon: 'sell',
          title: 'Precios y promociones',
          summary: 'Todos los precios publicados en la plataforma se expresan en Pesos Mexicanos (MXN).',
          points: [
            'Los descuentos o precios promocionales activos se muestran explícitamente junto al precio regular del instrumento.',
            'El importe final del pedido incluye el costo de los productos seleccionados más el costo de envío aplicable según la modalidad elegida.'
          ]
        },
        {
          id: 'proceso-compra',
          number: '05',
          icon: 'shopping_cart_checkout',
          title: 'Proceso de compra',
          summary: 'Flujo transparente desde la selección del instrumento hasta la confirmación del pedido.',
          points: [
            'Selección de productos disponibles en el carrito de compras (requiere sesión activa y conexión a Internet).',
            'Elección del método de entrega (envío a domicilio, recolección en tienda o cotización foránea) y confirmación del método de pago.'
          ]
        },
        {
          id: 'formas-pago',
          number: '06',
          icon: 'payments',
          title: 'Formas de pago autorizadas',
          summary: 'Casa de Música Castillo opera exclusivamente con los métodos de pago habilitados en el flujo de Checkout.',
          points: [
            'Mercado Pago: procesamiento en línea mediante redirección segura a la pasarela de Mercado Pago con validación automática al aprobarse.',
            'Transferencia o depósito bancario: pago a las cuentas autorizadas indicadas en el checkout, requiriendo subir el comprobante en la sección "Mis Pedidos" para validación manual.'
          ]
        },
        {
          id: 'envios-recoleccion',
          number: '07',
          icon: 'local_shipping',
          title: 'Envíos y recolección en tienda',
          summary: 'Opciones de entrega adaptadas a tu ubicación y al tipo de instrumento musical.',
          points: [
            'Envío a domicilio con cálculo automático en zonas de cobertura.',
            'Recolección en tienda sin costo en nuestra sucursal de Huejutla de Reyes mediante notificación y código seguro.',
            'Cotización personalizada asistida por WhatsApp para envíos fuera de zona o instrumentos de gran volumen.'
          ]
        },
        {
          id: 'cancelaciones',
          number: '08',
          icon: 'cancel_presentation',
          title: 'Cancelaciones',
          summary: 'Reglas operativas para la cancelación de pedidos antes de su despacho.',
          points: [
            'El cliente puede solicitar la cancelación desde su cuenta mientras el pedido no haya sido enviado o entregado.',
            'Consulta el detalle completo en nuestra Política de Cancelaciones (/informacion/cancelaciones).'
          ]
        },
        {
          id: 'propiedad-intelectual',
          number: '09',
          icon: 'copyright',
          title: 'Propiedad intelectual',
          summary: 'Respeto a los signos distintivos, fotografías, logotipos y contenidos de la plataforma.',
          points: [
            'La identidad visual, nombre comercial y diseño de Casa de Música Castillo están protegidos.',
            'Las marcas y modelos de los instrumentos exhibidos pertenecen a sus respectivos fabricantes y se muestran con fines identificativos y comerciales.'
          ]
        },
        {
          id: 'limitacion-responsabilidad',
          number: '10',
          icon: 'policy',
          title: 'Limitación de responsabilidades y servicio técnico',
          summary: 'Continuidad operativa de la plataforma digital y servidores.',
          points: [
            'Aunque la aplicación cuenta con tecnología PWA para consulta offline del catálogo e información pública, las operaciones transaccionales dependen de la disponibilidad de red del usuario y del servidor.',
            'En caso de intermitencia temporal del servidor, la interfaz notificará el estado de forma transparente sin comprometer la integridad de tus pedidos.'
          ]
        },
        {
          id: 'modificaciones-terminos',
          number: '11',
          icon: 'edit_note',
          title: 'Modificaciones de los términos',
          summary: 'Actualización continua de las políticas operativas y comerciales.',
          points: [
            'Casa de Música Castillo podrá actualizar estos lineamientos para reflejar mejoras en el servicio o ajustes normativos, publicando siempre la versión vigente en esta ruta (/terminos).'
          ]
        },
        {
          id: 'contacto-oficial',
          number: '12',
          icon: 'store',
          title: 'Contacto oficial',
          summary: 'Datos de ubicación y canales de atención de Casa de Música Castillo.',
          points: [
            'Domicilio de sucursal: C. Morelos 18, Col. Centro, C.P. 43000, Huejutla de Reyes, Hidalgo.',
            'Soporte y preguntas frecuentes disponibles en /ayuda.'
          ]
        }
      ];
    }

    this.activeSectionId = this.sections[0]?.id || '';
  }
}

