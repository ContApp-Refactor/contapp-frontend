import { DatePipe } from '@angular/common';
import { Component, computed, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { LocalStorageMethods } from '../../../Shared/Methods/local-storage.method';
import { SaleInvoiceLine } from '../../models/billing-sale-invoice.model';
import { SaleReturn } from '../../models/billing-sale-return.model';
import { DOCUMENT_KIND_CONFIG } from '../../models/document-kind';
import { CopCentsPipe } from '../../pipes/cop-cents.pipe';
import { buildInvoicePdf, invoicePdfFileName } from '../../utils/invoice-pdf';
import { resolveLogoUrl } from '../../utils/logo-url';
import { lineTaxCentsOf, taxSheetRows, taxSummaryRows } from '../../utils/money';
import { totalInWords } from '../../utils/number-to-words';
import { returnLineSubtotalOf, returnTotals } from '../../utils/sale-return';
import { BillingStatusBadgeComponent } from '../billing-status-badge/billing-status-badge.component';
import { BillingTaxSummaryComponent } from '../billing-tax-summary/billing-tax-summary.component';

// Texto presente: no nulo, no vacío y no el guion de "sin dato"
const present = (value: string | null | undefined): string => {
  const text = (value ?? '').toString().trim();
  return text === '—' ? '' : text;
};

const rateFormatter = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

// Vista previa de la devolución (nota crédito / débito) con el mismo formato formal de la factura. Solo lectura.
@Component({
  selector: 'app-sale-return-preview',
  imports: [DatePipe, ButtonModule, CopCentsPipe, BillingStatusBadgeComponent, BillingTaxSummaryComponent],
  template: `
    <!-- Acciones arriba a la derecha, fuera de la hoja (#sheet): no entran en el PDF -->
    <div class="mx-auto mb-12 flex justify-end" style="max-width: 800px">
      <p-button
        label="Imprimir"
        icon="pi pi-print"
        [loading]="printing()"
        [disabled]="printing()"
        (onClick)="print()"
      ></p-button>
    </div>
    <div
      #sheet
      class="relative mx-auto w-full overflow-hidden bg-white text-gray-800 font-family-sans border border-gray-300 rounded-md shadow-md p-24"
      style="max-width: 800px; font-size: 10px; line-height: 1.4"
    >
      @if (watermark(); as mark) {
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span
            class="font-bold uppercase"
            [style]="
              'font-size: 120px; letter-spacing: 8px; transform: rotate(-30deg); opacity: 0.08; color: ' +
              (saleReturn().status === 'ANULADA' ? '#b91c1c' : '#374151')
            "
            >{{ mark }}</span
          >
        </div>
      }

      <div class="relative">
        <!-- Encabezado: logo + datos de la empresa | título y número -->
        <div class="flex justify-between items-start gap-16">
          <div class="flex items-start gap-16 min-w-0">
            @if (logoUrl(); as logo) {
              <img
                [src]="logo"
                alt="Logo de la empresa"
                crossorigin="anonymous"
                data-testid="sheet-logo"
                style="max-height: 72px; max-width: 110px; object-fit: contain"
                (error)="logoFailedUrl.set(logo)"
              />
            }
            <div class="min-w-0">
              <p class="font-bold" style="font-size: 12px">{{ companyName() }}</p>
              @if (companyNit()) {
                <p class="font-bold">NIT: {{ companyNit() }}</p>
              }
              @if (issuerAddress()) {
                <p>{{ issuerAddress() }}</p>
              }
              @if (issuerPhone()) {
                <p>TEL: {{ issuerPhone() }}</p>
              }
              @if (issuerActivity()) {
                <p>ACTIVIDAD ECONOMICA {{ issuerActivity() }}</p>
              }
              @if (issuerEmail()) {
                <p>CORREO ELECT: {{ issuerEmail() }}</p>
              }
            </div>
          </div>

          <div class="shrink-0 flex flex-col items-end gap-8" style="width: 200px">
            <div class="w-full border border-gray-300 rounded-md overflow-hidden text-center">
              <div class="bg-primary text-white font-bold px-8 py-4">{{ cfg().returnPreviewTitle }}</div>
              <div class="px-8 py-6 font-bold text-gray-600" style="font-size: 12px">
                @if (saleReturn().number) {
                  {{ saleReturn().number }}
                } @else {
                  <span class="font-normal text-gray-500" style="font-size: 9px">se asigna al emitir</span>
                }
              </div>
            </div>
            @if (ordinal(); as n) {
              <p class="text-gray-600">Devolución N.º {{ n }}</p>
            }
            <app-billing-status-badge [status]="saleReturn().status" />
          </div>
        </div>

        <!-- Cuadro de datos: contraparte | factura original, fechas y moneda -->
        <div class="mt-12 flex border border-gray-300 rounded-md overflow-hidden">
          <div class="w-1/2 p-8 flex flex-col gap-2" data-testid="sheet-counterparty">
            <p>
              <span class="font-bold inline-block" style="width: 62px">{{ cfg().counterparty }}:</span
              >{{ saleReturn().clientName || '—' }}
            </p>
            @if (saleReturn().clientDocument) {
              <p><span class="font-bold inline-block" style="width: 62px">NIT:</span>{{ saleReturn().clientDocument }}</p>
            }
          </div>
          <div class="w-1/2 p-8 border-l border-gray-300 flex flex-col gap-2">
            <p>
              <span class="font-bold inline-block" style="width: 96px">{{ cfg().originalInvoiceLabel }}:</span
              >{{ saleReturn().originalNumber ?? '—' }}
            </p>
            @if (saleReturn().kind === 'PURCHASE') {
              <p>
                <span class="font-bold inline-block" style="width: 96px">N.º factura proveedor:</span
                >{{ saleReturn().supplierInvoiceNumber || '—' }}
              </p>
            }
            <p>
              <span class="font-bold inline-block" style="width: 96px">Fecha factura:</span
              >{{ saleReturn().originalDate | date: 'dd/MM/yyyy' }}
            </p>
            <p><span class="font-bold inline-block" style="width: 96px">Fecha:</span>{{ saleReturn().date | date: 'dd/MM/yyyy' }}</p>
            <p><span class="font-bold inline-block" style="width: 96px">Moneda:</span>PESOS (COP)</p>
          </div>
        </div>

        <!-- Motivo -->
        <div class="mt-12 border border-gray-300 rounded-md p-8">
          <p><span class="font-bold">Motivo: </span>{{ saleReturn().reason || '—' }}</p>
        </div>

        <!-- Líneas -->
        <div class="mt-12 border border-gray-300 rounded-md overflow-hidden">
          <table class="w-full border-collapse">
            <thead>
              <tr class="bg-primary text-white uppercase">
                <th class="text-center p-6" style="width: 40px">#</th>
                <th class="text-left p-6 border-l border-white">Descripción</th>
                <th class="text-right p-6 border-l border-white whitespace-nowrap">Cant. devuelta</th>
                <th class="text-right p-6 border-l border-white whitespace-nowrap">Precio unit.</th>
                <th class="text-right p-6 border-l border-white">IVA</th>
                <th class="text-right p-6 border-l border-white whitespace-nowrap">Valor total</th>
              </tr>
            </thead>
            <tbody>
              @for (row of lineRows(); track $index) {
                <tr class="border-b border-gray-200" data-testid="sheet-line">
                  <td class="p-6 text-center">{{ $index + 1 }}</td>
                  <td class="p-6 border-l border-gray-200">{{ row.description }}</td>
                  <td class="p-6 text-right border-l border-gray-200">{{ row.qty }}</td>
                  <td class="p-6 text-right border-l border-gray-200">{{ row.unitCents | copCents }}</td>
                  <td class="p-6 text-right border-l border-gray-200">{{ row.taxCents | copCents }}</td>
                  <td class="p-6 text-right font-semibold border-l border-gray-200">{{ row.totalCents | copCents }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="text-center text-gray-500 p-24">Esta devolución no tiene ítems.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Impuestos -->
        <div class="mt-12 border border-gray-300 rounded-md overflow-hidden" data-testid="sheet-taxes">
          <table class="w-full border-collapse">
            <thead>
              <tr class="bg-primary text-white uppercase">
                <th class="text-left p-6">Impuestos</th>
                <th class="text-right p-6">Base</th>
                <th class="text-right p-6">Tasa</th>
                <th class="text-right p-6">Total</th>
              </tr>
            </thead>
            <tbody>
              @for (row of taxSheet(); track $index) {
                <tr data-testid="sheet-tax-row">
                  <td class="p-6">{{ row.name }}</td>
                  <td class="p-6 text-right">{{ row.baseCents | copCents }}</td>
                  <td class="p-6 text-right whitespace-nowrap">{{ rateText(row.rate) }}</td>
                  <td class="p-6 text-right font-semibold">{{ row.taxCents | copCents }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4" class="p-6 text-center text-gray-500">—</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Valor en letras | totales -->
        <div class="mt-12 flex border border-gray-300 rounded-md overflow-hidden">
          <div class="flex-1 p-8 font-bold" data-testid="sheet-words">Valor letras: {{ totalWords() }}</div>
          <div class="p-8 border-l border-gray-300" style="width: 260px">
            <app-billing-tax-summary
              variant="print"
              part="totals"
              [rows]="taxRows()"
              [subtotalCents]="totals().subtotalCents"
              [taxCents]="totals().ivaCents"
              [totalCents]="totals().totalCents"
            ></app-billing-tax-summary>
          </div>
        </div>

        <p class="mt-24 pt-12 border-t border-gray-200 text-center text-gray-500">
          @switch (saleReturn().status) {
            @case ('BORRADOR') {
              Documento de vista previa — no tiene validez como {{ cfg().noteShort }}.
            }
            @case ('ANULADA') {
              Devolución anulada.
            }
            @default {
              {{ noteShortCapitalized() }} generada por devolución de mercancía.
            }
          }
        </p>
      </div>
    </div>
  `,
})
export class SaleReturnPreviewComponent {
  saleReturn = input.required<SaleReturn>();
  /** Ordinal dentro de la factura (null en borradores) */
  ordinal = input<number | null>(null);

  readonly rateText = (rate: number): string => `${rateFormatter.format(rate)} %`;

  // El emisor del documento emitido es el congelado por el back (`issuer`); los datos de la empresa en
  // localStorage quedan solo como respaldo (borradores y documentos sin emisor)
  private readonly storage = inject(LocalStorageMethods);
  private readonly enterprise = this.storage.loadEnterpriseData();
  readonly companyName = computed(() => this.saleReturn().issuer?.name || this.enterprise?.name || 'Empresa');
  readonly companyNit = computed(() => {
    const issuer = this.saleReturn().issuer;
    if (!issuer) return this.enterprise?.nit || '';
    return issuer.nit ? (issuer.dv ? `${issuer.nit}-${issuer.dv}` : issuer.nit) : '';
  });
  // "Dirección - Ciudad - Departamento" con solo lo que exista
  readonly issuerAddress = computed(() => {
    const i = this.saleReturn().issuer;
    return [i?.address, i?.city, i?.department].map(present).filter(Boolean).join(' - ');
  });
  readonly issuerPhone = computed(() => present(this.saleReturn().issuer?.phone));
  readonly issuerActivity = computed(() => present(this.saleReturn().issuer?.economicActivity));
  readonly issuerEmail = computed(() => present(this.saleReturn().issuer?.email));

  // Logo: URL relativa del back resuelta contra el host de la API. Si falla al cargar (o es null) se omite sin romper el layout
  readonly logoFailedUrl = signal<string | null>(null);
  readonly logoUrl = computed(() => {
    const url = resolveLogoUrl(this.saleReturn().issuer?.logo);
    return url && url !== this.logoFailedUrl() ? url : null;
  });

  private readonly messages = inject(MessageService, { optional: true });
  private readonly sheet = viewChild.required<ElementRef<HTMLElement>>('sheet');
  readonly printing = signal(false);
  // Constructor del PDF; se expone para poder sustituirlo en pruebas
  pdfBuilder = buildInvoicePdf;

  // Genera y descarga el PDF de la hoja tal como se ve (incluida la marca de agua). No toca el estado de la devolución.
  async print(): Promise<void> {
    if (this.printing()) return;
    this.printing.set(true);
    try {
      const pdf = await this.pdfBuilder(this.sheet().nativeElement);
      pdf.save(invoicePdfFileName(this.cfg().returnPreviewTitle, this.saleReturn().number));
    } catch (error) {
      console.error('No se pudo generar el PDF de la devolución', error);
      this.messages?.add({ severity: 'error', summary: 'Imprimir', detail: 'No se pudo generar el PDF. Inténtalo de nuevo.' });
    } finally {
      this.printing.set(false);
    }
  }

  cfg = computed(() => DOCUMENT_KIND_CONFIG[this.saleReturn().kind]);
  noteShortCapitalized = computed(() => {
    const note = this.cfg().noteShort;
    return note.charAt(0).toUpperCase() + note.slice(1);
  });
  totals = computed(() => returnTotals(this.saleReturn())); // en no-borrador mandan los totales del back
  totalWords = computed(() => totalInWords(this.totals().totalCents));
  watermark = computed(() => {
    const s = this.saleReturn().status;
    return s === 'BORRADOR' ? 'Borrador' : s === 'ANULADA' ? 'Anulada' : null;
  });

  private readonly editable = computed(() => this.saleReturn().status === 'BORRADOR');

  // Las líneas de la devolución se adaptan a la forma de una línea de factura para reutilizar el cálculo de impuestos
  private readonly asInvoiceLines = computed(() =>
    this.saleReturn().lines.map(
      (l) =>
        ({
          productId: l.productId,
          productName: l.productName,
          cantidad: l.cantidadDevuelta,
          precioUnitarioCents: l.precioUnitarioCents,
          ivaPct: l.ivaPct,
          taxes: l.taxes,
          subtotalCents: this.editable() ? undefined : l.subtotalCents,
        }) as SaleInvoiceLine,
    ),
  );
  taxSheet = computed(() => taxSheetRows(this.asInvoiceLines(), this.editable()));
  taxRows = computed(() => taxSummaryRows(this.asInvoiceLines(), this.editable()));

  // Valor total de cada línea = subtotal + sus impuestos
  lineRows = computed(() =>
    this.saleReturn().lines.map((line, i) => {
      const subtotal = returnLineSubtotalOf(line, this.editable());
      const taxCents = lineTaxCentsOf(this.asInvoiceLines()[i], this.editable());
      return {
        description: line.productName,
        qty: line.cantidadDevuelta,
        unitCents: line.precioUnitarioCents,
        taxCents,
        totalCents: subtotal + taxCents,
      };
    }),
  );
}
