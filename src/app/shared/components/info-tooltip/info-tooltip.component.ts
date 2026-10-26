import { Component, Input, HostListener, ChangeDetectionStrategy } from '@angular/core';

import { OverlayModule, ConnectionPositionPair } from '@angular/cdk/overlay';

@Component({
  selector: 'app-info-tooltip',
  standalone: true,
  imports: [OverlayModule],
  template: `
    <span #triggerOrigin
          class="inline-flex items-center justify-center text-gray-400 hover:text-[#6D1331] transition-colors cursor-help outline-none focus-visible:ring-2 focus-visible:ring-[#6D1331] rounded-full"
          cdkOverlayOrigin
          #origin="cdkOverlayOrigin"
          tabindex="0"
          role="button"
          [attr.aria-label]="ariaLabel"
          (mouseenter)="onMouseEnter()"
          (mouseleave)="onMouseLeave()"
          (focus)="onMouseEnter()"
          (blur)="onMouseLeave()"
          (click)="toggle($event)">
      <span class="material-symbols-outlined text-[17px]">info</span>
    </span>

    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="isOpen"
      [cdkConnectedOverlayPositions]="positions"
      (overlayOutsideClick)="close()">
      <div role="tooltip"
           class="bg-[#1F2937] text-white p-3 rounded-[9px] shadow-md w-[280px] sm:w-[320px] z-[99999]"
           (mouseenter)="onMouseEnter()"
           (mouseleave)="onMouseLeave()">
        <h4 class="font-semibold text-white mb-1.5 text-sm leading-tight">{{ tooltipTitle }}</h4>
        <div class="text-gray-300 text-xs leading-relaxed flex flex-col gap-2">
          <ng-content></ng-content>
        </div>
      </div>
    </ng-template>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      margin-left: 6px;
    }

  `]
})
export class InfoTooltipComponent {
  @Input() tooltipTitle: string = '';
  @Input() ariaLabel: string = 'Información';

  isOpen = false;
  private timeoutId: any;

  // Posiciones para evitar cortes, intentando primero abajo, luego arriba, luego izquierda/derecha
  positions = [
    new ConnectionPositionPair(
      { originX: 'center', originY: 'bottom' },
      { overlayX: 'center', overlayY: 'top' },
      0, 6
    ),
    new ConnectionPositionPair(
      { originX: 'center', originY: 'top' },
      { overlayX: 'center', overlayY: 'bottom' },
      0, -6
    ),
    new ConnectionPositionPair(
      { originX: 'end', originY: 'center' },
      { overlayX: 'start', overlayY: 'center' },
      6, 0
    ),
    new ConnectionPositionPair(
      { originX: 'start', originY: 'center' },
      { overlayX: 'end', overlayY: 'center' },
      -6, 0
    )
  ];

  @HostListener('document:keydown.escape')
  onEscape() {
    this.close();
  }

  onMouseEnter() {
    clearTimeout(this.timeoutId);
    this.isOpen = true;
  }

  onMouseLeave() {
    this.timeoutId = setTimeout(() => {
      this.isOpen = false;
    }, 120);
  }

  toggle(event: Event) {
    event.stopPropagation();
    this.isOpen = !this.isOpen;
  }

  close() {
    this.isOpen = false;
  }
}
