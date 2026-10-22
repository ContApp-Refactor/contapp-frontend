import { Component, computed, inject, input } from '@angular/core';
import { LocalStorageMethods } from '../../../Shared/Methods/local-storage.method';
import { BillingClient, InvoiceStatus, SaleInvoiceLine } from '../../models/billing-sale-invoice.model';
import { DOCUMENT_KIND_CONFIG, DocumentKind } from '../../models/document-kind';
import { CopCentsPipe } from '../../pipes/cop-cents.pipe';
import { calcTotals, lineSubtotalCents } from '../../utils/money';
import { BillingStatusBadgeComponent } from '../billing-status-badge/billing-status-badge.component';

// Vista previa de la factura tal como se vería impresa. Solo lectura: recibe el estado
// actual del formulario por inputs y no emite nada.
@Component({
  selector: 'app-sale-invoice-preview',
  imports: [CopCentsPipe, BillingStatusBadgeComponent],
  template: `
    <div
      class="relative mx-auto w-full overflow-hidden bg-white text-gray-800 font-family-sans text-sm border border-gray-300 rounded-md shadow-md p-32"
      style="max-width: 800px"
    >
      <!-- Marca de agua (solo borrador / anulada) -->
      @if (watermark(); as mark) {
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span
            class="font-bold uppercase"
            [style]="
              'font-size: 120px; letter-spacing: 8px; transform: rotate(-30deg); opacity: 0.08; color: ' +
              (status() === 'ANULADA' ? '#b91c1c' : '#374151')
            "
            >{{ mark }}</span
          >
        </div>
      }

      <div class="relative">
        <!-- Encabezado: empresa + datos del documento -->
        <div class="flex justify-between items-start gap-16 pb-16 border-b-2 border-gray-300">
          <div>
            <p class="font-bold text-xl text-primary">{{ companyName }}</p>
            @if (companyNit) {
              <p class="text-gray-600 mt-4">NIT: {{ companyNit }}</p>
            }
          </div>
          <div class="text-right">
            <p class="font-bold text-xl tracking-wide">{{ cfg().previewTitle }}</p>
            <p class="mt-4 font-semibold">
              @if (number()) {
                N.º {{ number() }}
              } @else {
                <span class="text-gray-500 font-normal text-xs">Sin número — se asigna al emitir</span>
              }
            </p>
            <p class="mt-4 text-gray-600">Fecha: {{ date() }}</p>
            <div class="mt-8"><app-billing-status-badge [status]="status()" /></div>
          </div>
        </div>

        <!-- Contraparte: cliente (venta) o proveedor (compra) -->
        <div class="mt-16 p-12 border border-gray-200 rounded-md">
          <p class="text-xs uppercase text-gray-500 mb-4">{{ cfg().counterparty }}</p>
          @if (client(); as c) {
            <p class="font-semibold">{{ c.name }}</p>
            <p class="text-gray-600">Documento: {{ c.document }}</p>
          } @else {
            <p class="text-gray-500">Sin {{ cfg().counterpartyLower }} seleccionado</p>
          }
          @if (kind() === 'PURCHASE') {
            <p class="text-gray-600">N.º factura del proveedor: {{ supplierInvoiceNumber() || '—' }}</p>
          }
        </div>

        <!-- Líneas -->
        <table class="w-full mt-16 border-collapse">
          <thead>
            <tr class="bg-gray-100 text-xs uppercase text-gray-600">
              <th class="text-left p-8" style="width: 40px">#</th>
              <th class="text-left p-8">Descripción</th>
              <th class="text-right p-8">Cant.</th>
              <th class="text-right p-8">Vr. unitario</th>
              <th class="text-right p-8">IVA %</th>
              <th class="text-right p-8">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            @for (line of lines(); track $index) {
              <tr class="border-b border-gray-200">
                <td class="p-8">{{ $index + 1 }}</td>
                <td class="p-8">{{ line.productName }}</td>
                <td class="p-8 text-right">{{ line.cantidad }}</td>
                <td class="p-8 text-right">{{ line.precioUnitarioCents | copCents }}</td>
                <td class="p-8 text-right">{{ line.ivaPct }}%</td>
                <td class="p-8 text-right font-semibold">{{ lineSubtotal(line) | copCents }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="text-center text-gray-500 p-24">
                  <i class="pi pi-shopping-cart text-primary text-xl"></i>
                  <p class="mt-8">Esta factura aún no tiene productos.</p>
                </td>
              </tr>
            }
          </tbody>
        </table>

        <!-- Totales -->
        <div class="flex justify-end mt-16">
          <div class="w-full flex flex-col gap-8" style="max-width: 280px">
            <div class="flex justify-between">
              <span class="text-gray-600">Subtotal:</span>
              <span class="font-semibold">{{ totals().subtotalCents | copCents }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">IVA:</span>
              <span class="font-semibold">{{ totals().ivaCents | copCents }}</span>
            </div>
            <div class="flex justify-between items-center p-8 rounded-md bg-gray-100 text-lg">
              <span class="font-bold text-primary">TOTAL:</span>
              <span class="font-extrabold text-primary">{{ totals().totalCents | copCents }}</span>
            </div>
          </div>
        </div>

        <!-- Pie -->
        <p class="mt-32 pt-12 border-t border-gray-200 text-center text-xs text-gray-500">
          @switch (status()) {
            @case ('BORRADOR') {
              Documento de vista previa — no tiene validez como factura.
            }
            @case ('ANULADA') {
              Factura anulada.
            }
            @default {
              {{ cfg().invoiceFooter }}
            }
          }
        </p>
      </div>
    </div>
  `,
})
export class SaleInvoicePreviewComponent {
  kind = input<DocumentKind>('SALE');
  number = input<string | null>(null);
  status = input.required<InvoiceStatus>();
  date = input.required<string>();
  client = input<BillingClient | null>(null); // contraparte: cliente o proveedor
  supplierInvoiceNumber = input<string | null>(null); // solo compras
  lines = input.required<SaleInvoiceLine[]>();

  private readonly storage = inject(LocalStorageMethods);
  private readonly enterprise = this.storage.loadEnterpriseData();
  readonly companyName = this.enterprise?.name || 'Empresa';
  readonly companyNit = this.enterprise?.nit || '';

  cfg = computed(() => DOCUMENT_KIND_CONFIG[this.kind()]);
  totals = computed(() => calcTotals(this.lines()));
  watermark = computed(() => {
    const s = this.status();
    return s === 'BORRADOR' ? 'Borrador' : s === 'ANULADA' ? 'Anulada' : null;
  });

  lineSubtotal = lineSubtotalCents;
}
