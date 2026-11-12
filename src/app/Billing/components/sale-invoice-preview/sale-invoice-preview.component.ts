import { Component, computed, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { LocalStorageMethods } from '../../../Shared/Methods/local-storage.method';
import {
  BillingClient,
  BillingIssuer,
  BillingPayment,
  InvoiceStatus,
  InvoiceTotals,
  SaleInvoiceLine,
} from '../../models/billing-sale-invoice.model';
import { DOCUMENT_KIND_CONFIG, DocumentKind } from '../../models/document-kind';
import { CopCentsPipe } from '../../pipes/cop-cents.pipe';
import { buildInvoicePdf, invoicePdfFileName } from '../../utils/invoice-pdf';
import { resolveLogoUrl } from '../../utils/logo-url';
import {
  WithholdingRow,
  calcTotals,
  lineSubtotalOf,
  lineTaxCentsOf,
  taxSheetRows,
  taxSummaryRows,
  withTotalsNet,
  withholdingRowName,
} from '../../utils/money';
import { totalInWords } from '../../utils/number-to-words';
import { paymentSummary } from '../../utils/payment';
import { BillingQrComponent } from '../billing-qr/billing-qr.component';
import { BillingStatusBadgeComponent } from '../billing-status-badge/billing-status-badge.component';
import { BillingTaxSummaryComponent } from '../billing-tax-summary/billing-tax-summary.component';

// Texto presente: no nulo, no vacío y no el guion de "sin dato"
const present = (value: string | null | undefined): string => {
  const text = (value ?? '').toString().trim();
  return text === '—' ? '' : text;
};

const rateFormatter = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

// Vista previa de la factura tal como se vería impresa. Solo lectura: recibe el estado
// actual del formulario por inputs y no emite nada.
@Component({
  selector: 'app-sale-invoice-preview',
  imports: [ButtonModule, CopCentsPipe, BillingStatusBadgeComponent, BillingTaxSummaryComponent, BillingQrComponent],
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
        <!-- Encabezado: logo + datos de la empresa | QR + título y número -->
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
            <!-- QR de verificación (emitida/anulada con código) o recuadro del borrador -->
            @if (qrCode(); as code) {
              <div class="flex flex-col items-end gap-4" data-testid="verification-qr">
                <app-billing-qr [value]="code" [size]="84" />
                <span class="text-gray-500 break-all text-right" style="font-size: 7px; max-width: 200px">{{ code }}</span>
              </div>
            } @else if (status() === 'BORRADOR') {
              <div
                class="flex items-center justify-center text-center text-gray-500 border border-dashed border-gray-300 bg-gray-50"
                style="width: 84px; height: 84px; font-size: 9px"
                data-testid="verification-qr-placeholder"
              >
                El QR se genera al emitir
              </div>
            }
            <div class="w-full border border-gray-300 rounded-md overflow-hidden text-center">
              <div class="bg-primary text-white font-bold px-8 py-4">{{ cfg().sheetTitle }}</div>
              <div class="px-8 py-6 font-bold text-gray-600" style="font-size: 12px">
                @if (number()) {
                  {{ number() }}
                } @else {
                  <span class="font-normal text-gray-500" style="font-size: 9px">se asigna al emitir</span>
                }
              </div>
            </div>
            <app-billing-status-badge [status]="status()" />
          </div>
        </div>

        <!-- Cuadro de datos: contraparte | pago, fecha y moneda -->
        <div class="mt-12 flex border border-gray-300 rounded-md overflow-hidden">
          <div class="w-1/2 p-8 flex flex-col gap-2" data-testid="sheet-counterparty">
            @if (client(); as c) {
              <p><span class="font-bold inline-block" style="width: 62px">{{ cfg().counterparty }}:</span>{{ c.name }}</p>
              @if (clientDocument()) {
                <p><span class="font-bold inline-block" style="width: 62px">NIT:</span>{{ clientDocument() }}</p>
              }
              @if (present(c.address)) {
                <p><span class="font-bold inline-block" style="width: 62px">Dirección:</span>{{ present(c.address) }}</p>
              }
              @if (present(c.city)) {
                <p><span class="font-bold inline-block" style="width: 62px">Ciudad:</span>{{ present(c.city) }}</p>
              }
              @if (present(c.phone)) {
                <p><span class="font-bold inline-block" style="width: 62px">Teléfono:</span>{{ present(c.phone) }}</p>
              }
              @if (present(c.email)) {
                <p><span class="font-bold inline-block" style="width: 62px">Correo:</span>{{ present(c.email) }}</p>
              }
            } @else {
              <p class="text-gray-500">Sin {{ cfg().counterpartyLower }} seleccionado</p>
            }
          </div>
          <div class="w-1/2 p-8 border-l border-gray-300 flex flex-col gap-2">
            <!-- Método de pago: dentro de la hoja, así sale también en el PDF -->
            <p data-testid="preview-payment">
              <span class="font-bold inline-block" style="width: 84px">Medio de Pago:</span>{{ paymentText() }}
            </p>
            <p><span class="font-bold inline-block" style="width: 84px">Fecha:</span>{{ date() }}</p>
            <p><span class="font-bold inline-block" style="width: 84px">Moneda:</span>PESOS (COP)</p>
            @if (kind() === 'PURCHASE') {
              <p>
                <span class="font-bold inline-block" style="width: 84px">N.º factura proveedor:</span
                >{{ supplierInvoiceNumber() || '—' }}
              </p>
            }
          </div>
        </div>

        <!-- Líneas -->
        <div class="mt-12 border border-gray-300 rounded-md overflow-hidden">
          <table class="w-full border-collapse">
            <thead>
              <tr class="bg-primary text-white uppercase">
                <th class="text-center p-6" style="width: 64px">{{ hasReference() ? 'Referencia' : '#' }}</th>
                <th class="text-left p-6 border-l border-white">Descripción</th>
                <th class="text-right p-6 border-l border-white">Cant.</th>
                <th class="text-right p-6 border-l border-white whitespace-nowrap">Precio unit.</th>
                <th class="text-right p-6 border-l border-white">IVA</th>
                <th class="text-right p-6 border-l border-white whitespace-nowrap">Valor total</th>
              </tr>
            </thead>
            <tbody>
              @for (row of lineRows(); track $index) {
                <tr class="border-b border-gray-200" data-testid="sheet-line">
                  <td class="p-6 text-center">{{ row.ref }}</td>
                  <td class="p-6 border-l border-gray-200">{{ row.description }}</td>
                  <td class="p-6 text-right border-l border-gray-200">{{ row.qty }}</td>
                  <td class="p-6 text-right border-l border-gray-200">{{ row.unitCents | copCents }}</td>
                  <td class="p-6 text-right border-l border-gray-200">{{ row.taxCents | copCents }}</td>
                  <td class="p-6 text-right font-semibold border-l border-gray-200">{{ row.totalCents | copCents }}</td>
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
        </div>

        <!-- Impuestos | Retención -->
        <div class="mt-12 grid grid-cols-2 gap-8">
          <div class="border border-gray-300 rounded-md overflow-hidden" data-testid="sheet-taxes">
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
                    <td colspan="4" class="p-6 text-center text-gray-500" data-testid="tax-summary-empty">—</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="border border-gray-300 rounded-md overflow-hidden" data-testid="sheet-withholdings">
            <table class="w-full border-collapse">
              <thead>
                <tr class="bg-primary text-white uppercase">
                  <th class="text-left p-6">Retención</th>
                  <th class="text-right p-6">Base</th>
                  <th class="text-right p-6">Tasa</th>
                  <th class="text-right p-6">Total</th>
                </tr>
              </thead>
              <tbody>
                @for (w of withholdings(); track w.code) {
                  <tr data-testid="sheet-withholding-row">
                    <td class="p-6">{{ nameOf(w) }}</td>
                    <td class="p-6 text-right">{{ shownTotals().subtotalCents | copCents }}</td>
                    <td class="p-6 text-right whitespace-nowrap">{{ rateText(w.ratePct) }}</td>
                    <td class="p-6 text-right font-semibold">{{ w.amountCents | copCents }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="4" class="p-6 text-center text-gray-500">—</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Valor en letras | totales -->
        <div class="mt-12 flex border border-gray-300 rounded-md overflow-hidden">
          <div class="flex-1 p-8 font-bold" data-testid="sheet-words">Valor letras: {{ totalWords() }}</div>
          <div class="p-8 border-l border-gray-300" style="width: 260px">
            <app-billing-tax-summary
              variant="print"
              part="totals"
              [rows]="taxRows()"
              [subtotalCents]="shownTotals().subtotalCents"
              [taxCents]="shownTotals().ivaCents"
              [totalCents]="shownTotals().totalCents"
              [withholdings]="withholdings()"
            ></app-billing-tax-summary>
          </div>
        </div>

        <!-- Pie -->
        <p class="mt-24 pt-12 border-t border-gray-200 text-center text-gray-500">
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
  client = input<BillingClient | null>(null); // contraparte: cliente o proveedor (con su contacto si existe)
  supplierInvoiceNumber = input<string | null>(null); // solo compras
  lines = input.required<SaleInvoiceLine[]>();
  totals = input<InvoiceTotals | null>(null); // los del back; solo mandan si el documento no es borrador
  issuer = input<BillingIssuer | null>(null); // emisor: congelado si está emitida; datos vivos en borrador
  payment = input<BillingPayment | null>(null); // forma de pago (venta y compra); null = sin dato => "—"
  withholdings = input<WithholdingRow[]>([]); // retenciones a mostrar (con signo menos); vacío = sin retenciones

  verificationCode = input<string | null>(null); // string opaco del back (emitidas/anuladas); null = sin QR (docs viejos)

  readonly present = present;
  readonly nameOf = withholdingRowName;
  readonly rateText = (rate: number): string => `${rateFormatter.format(rate)} %`;

  // El emisor viene en la respuesta de la factura; los datos de la empresa en localStorage quedan solo como respaldo
  // (documentos sin emisor)
  private readonly storage = inject(LocalStorageMethods);
  private readonly enterprise = this.storage.loadEnterpriseData();
  readonly companyName = computed(() => this.issuer()?.name || this.enterprise?.name || 'Empresa');
  readonly companyNit = computed(() => {
    const issuer = this.issuer();
    if (!issuer) return this.enterprise?.nit || '';
    return issuer.nit ? (issuer.dv ? `${issuer.nit}-${issuer.dv}` : issuer.nit) : '';
  });
  // "Dirección - Ciudad - Departamento" con solo lo que exista
  readonly issuerAddress = computed(() => {
    const i = this.issuer();
    return [i?.address, i?.city, i?.department].map(present).filter(Boolean).join(' - ');
  });
  readonly issuerPhone = computed(() => present(this.issuer()?.phone));
  readonly issuerActivity = computed(() => present(this.issuer()?.economicActivity));
  readonly issuerEmail = computed(() => present(this.issuer()?.email));

  // Logo: URL relativa del back resuelta contra el host de la API. Si falla al cargar (o es null) se omite sin romper el layout
  readonly logoFailedUrl = signal<string | null>(null);
  readonly logoUrl = computed(() => {
    const url = resolveLogoUrl(this.issuer()?.logo);
    return url && url !== this.logoFailedUrl() ? url : null;
  });

  readonly qrCode = computed(() => (this.status() === 'BORRADOR' ? null : this.verificationCode()));
  readonly clientDocument = computed(() => present(this.client()?.document));

  private readonly messages = inject(MessageService, { optional: true });
  private readonly sheet = viewChild.required<ElementRef<HTMLElement>>('sheet');
  readonly printing = signal(false);
  // Constructor del PDF; se expone para poder sustituirlo en pruebas
  pdfBuilder = buildInvoicePdf;

  // Genera y descarga el PDF de la hoja tal como se ve (incluida la marca de agua). No toca el estado de la factura.
  async print(): Promise<void> {
    if (this.printing()) return;
    this.printing.set(true);
    try {
      const pdf = await this.pdfBuilder(this.sheet().nativeElement);
      pdf.save(invoicePdfFileName(this.cfg().previewTitle, this.number()));
    } catch (error) {
      console.error('No se pudo generar el PDF de la factura', error);
      this.messages?.add({ severity: 'error', summary: 'Imprimir', detail: 'No se pudo generar el PDF. Inténtalo de nuevo.' });
    } finally {
      this.printing.set(false);
    }
  }

  cfg = computed(() => DOCUMENT_KIND_CONFIG[this.kind()]);
  paymentText = computed(() => paymentSummary(this.payment()));
  shownTotals = computed(() => {
    const server = this.totals();
    // Emitida/anulada: manda el back (totalCents ya neto). Borrador: se calcula y se restan las retenciones
    return this.status() !== 'BORRADOR' && server ? server : withTotalsNet(calcTotals(this.lines()), this.withholdings());
  });
  taxRows = computed(() => taxSummaryRows(this.lines(), this.status() === 'BORRADOR'));
  taxSheet = computed(() => taxSheetRows(this.lines(), this.status() === 'BORRADOR'));
  totalWords = computed(() => totalInWords(this.shownTotals().totalCents));
  watermark = computed(() => {
    const s = this.status();
    return s === 'BORRADOR' ? 'Borrador' : s === 'ANULADA' ? 'Anulada' : null;
  });

  // La columna "Referencia" solo existe si alguna línea trae código de producto; si no, se numera (#)
  hasReference = computed(() => this.lines().some((l) => !!present(l.productCode)));
  // Valor total de cada línea = subtotal + sus impuestos (la suma de todas = subtotal + impuestos del documento)
  lineRows = computed(() => {
    const editable = this.status() === 'BORRADOR';
    const withRef = this.hasReference();
    return this.lines().map((line, i) => {
      const subtotal = lineSubtotalOf(line, editable);
      const taxCents = lineTaxCentsOf(line, editable);
      return {
        ref: withRef ? present(line.productCode) : String(i + 1),
        description: line.productName,
        qty: line.cantidad,
        unitCents: line.precioUnitarioCents,
        taxCents,
        totalCents: subtotal + taxCents,
      };
    });
  });
}
