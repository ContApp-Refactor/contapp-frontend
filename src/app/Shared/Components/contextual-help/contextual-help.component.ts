import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges } from '@angular/core';
import { PopoverModule } from 'primeng/popover';
import { HelpCenterService } from '../../services/help-center.service';

/**
 * Icono ? con resumen contextual y enlace al Centro de Ayuda (misma arquitectura que Catálogo PUC).
 * El contenido extendido lo administra el administrador en /gen-masters/help-center.
 */
@Component({
  selector: 'app-contextual-help',
  standalone: true,
  imports: [CommonModule, PopoverModule],
  template: `
    <span
      class="text-primary cursor-pointer inline-flex items-center"
      role="button"
      tabindex="0"
      [attr.aria-label]="'Ayuda: ' + title"
      (click)="popover.toggle($event)"
      (keydown.enter)="popover.toggle($event); $event.preventDefault()"
      (keydown.space)="popover.toggle($event); $event.preventDefault()">
      <i class="pi pi-question-circle" [ngClass]="iconClass" aria-hidden="true"></i>
    </span>
    <p-popover #popover>
      <div class="p-4" style="max-width: 420px">
        <h3 class="font-bold text-lg mb-3 text-primary">{{ title }}</h3>
        <p class="text-sm mb-3 text-primary whitespace-pre-line">{{ summary }}</p>
        <a
          [href]="helpCenterUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-sm text-blue-600 hover:text-blue-800 underline flex items-center gap-1">
          Abrir centro de ayuda para más información.
          <i class="pi pi-external-link text-xs"></i>
        </a>
      </div>
    </p-popover>
  `,
})
export class ContextualHelpComponent implements OnChanges {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) summary!: string;
  @Input({ required: true }) helpCenterSlug!: string;
  @Input() iconClass = 'text-xl';

  helpCenterUrl = '';

  constructor(private readonly helpCenterService: HelpCenterService) {}

  ngOnChanges(): void {
    this.helpCenterUrl = this.helpCenterService.getHelpCenterUrl(this.helpCenterSlug || '');
  }
}
