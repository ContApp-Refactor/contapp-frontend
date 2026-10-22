import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TagModule } from 'primeng/tag';
import { PaymentSchedule } from './treasury-api.models';
import { TreasuryScheduleDetailView } from './treasury-schedule-display';

@Component({
  selector: 'app-treasury-schedule-detail-panel',
  standalone: true,
  imports: [CommonModule, TagModule],
  template: `
    <div class="flex flex-col gap-3 text-sm" *ngIf="item && view">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <span class="text-gray-500">Programación</span>
          <p class="font-mono font-semibold m-0">#{{ item.id }}</p>
        </div>
        <div>
          <span class="text-gray-500">Fecha de creación</span>
          <p class="font-semibold m-0">{{ view.createdAt }}</p>
        </div>
        <div>
          <span class="text-gray-500">Fecha de ejecución</span>
          <p class="font-semibold m-0">{{ view.executionDate }}</p>
        </div>
        <div>
          <span class="text-gray-500">Tipo</span>
          <p class="font-semibold m-0">{{ view.type }}</p>
        </div>
        <div>
          <span class="text-gray-500">Proveedor</span>
          <p class="font-semibold m-0">{{ view.supplier }}</p>
        </div>
        <div>
          <span class="text-gray-500">Método</span>
          <p class="font-semibold m-0">{{ view.method }}</p>
        </div>
        <div>
          <span class="text-gray-500">Cuenta origen</span>
          <p class="font-semibold m-0">{{ view.bank }}</p>
        </div>
        <div>
          <span class="text-gray-500">Total</span>
          <p class="font-semibold m-0">{{ view.total }}</p>
        </div>
        <div>
          <span class="text-gray-500">Estado</span>
          <p class="m-0">
            <p-tag [value]="view.statusLabel" [severity]="view.statusSeverity"></p-tag>
          </p>
        </div>
        <div>
          <span class="text-gray-500">Reintentos</span>
          <p class="font-semibold m-0">{{ item.retryCount }}</p>
        </div>
        <div>
          <span class="text-gray-500">Último intento</span>
          <p class="font-semibold m-0">{{ view.lastAttempt }}</p>
        </div>
        <div *ngIf="view.showVoucher">
          <span class="text-gray-500">Comprobante</span>
          <p class="font-mono font-semibold text-blue-600 m-0">{{ view.voucher }}</p>
        </div>
      </div>
      <div>
        <span class="text-gray-500">Factura(s)</span>
        <p class="font-mono text-sm m-0 mt-1">{{ view.invoices }}</p>
      </div>
      <div *ngIf="view.observations">
        <span class="text-gray-500">Observaciones</span>
        <p class="m-0 mt-1">{{ view.observations }}</p>
      </div>
      <div *ngIf="view.failureReason">
        <span class="text-gray-500">Motivo del error</span>
        <p class="m-0 mt-1 text-red-700">{{ view.failureReason }}</p>
      </div>
    </div>
  `,
})
export class TreasuryScheduleDetailPanelComponent {
  @Input({ required: true }) item!: PaymentSchedule | null;
  @Input({ required: true }) view!: TreasuryScheduleDetailView | null;
}
