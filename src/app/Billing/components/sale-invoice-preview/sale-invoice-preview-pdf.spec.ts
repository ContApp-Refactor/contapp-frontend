import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MessageService } from 'primeng/api';
import { SaleInvoiceLine } from '../../models/billing-sale-invoice.model';
import { buildInvoicePdf, flattenModernColors, invoicePdfFileName, replaceModernColors, toRgb } from '../../utils/invoice-pdf';
import { SaleInvoicePreviewComponent } from './sale-invoice-preview.component';

const line = (n: number, taxes: SaleInvoiceLine['taxes'] = [{ name: 'Iva', rate: 19 }, { name: 'Ica', rate: 6 }]): SaleInvoiceLine => ({
  productId: `p${n}`,
  productName: `Producto de prueba número ${n}`,
  cantidad: n,
  precioCatalogoCents: 120000,
  precioUnitarioCents: 120000,
  ivaCatalogoPct: 25,
  ivaPct: 25,
  taxes,
});

const lines = (count: number): SaleInvoiceLine[] => Array.from({ length: count }, (_, i) => line(i + 1));

const montar = (inputs: Record<string, unknown>) => {
  const fixture = TestBed.createComponent(SaleInvoicePreviewComponent);
  const base = { status: 'BORRADOR', date: '2026-10-01', lines: lines(3), ...inputs };
  for (const [k, v] of Object.entries(base)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  return fixture;
};

describe('invoicePdfFileName', () => {
  it('borrador: sin número => "borrador"', () => {
    expect(invoicePdfFileName('FACTURA DE COMPRA', null)).toBe('factura-de-compra-borrador.pdf');
  });
  it('emitida: usa el número, en minúsculas y sin caracteres raros', () => {
    expect(invoicePdfFileName('FACTURA DE VENTA', 'FV-000001')).toBe('factura-de-venta-fv-000001.pdf');
    expect(invoicePdfFileName('Factura Ñandú', ' A/B 1 ')).toBe('factura-nandu-a-b-1.pdf');
  });
});

describe('colores modernos (html2canvas no soporta oklch/color-mix)', () => {
  it('toRgb convierte oklch y color-mix a rgb', () => {
    expect(toRgb('oklch(0.7 0.1 30)')).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
    expect(toRgb('color-mix(in oklab, red 50%, blue)')).toMatch(/^rgb\(/);
  });
  it('replaceModernColors reemplaza dentro de valores compuestos (sombras)', () => {
    const out = replaceModernColors('0 1px 2px 0 oklch(0.2 0 0 / 0.5), 0 0 1px color-mix(in oklab, red, blue)');
    expect(out).not.toMatch(/oklch|color-mix/);
    expect(out).toContain('rgba(');
  });
  it('flattenModernColors deja inline un color que html2canvas entiende', () => {
    const div = document.createElement('div');
    div.style.color = 'oklch(0.5 0.2 250)';
    document.body.appendChild(div);
    flattenModernColors(div);
    expect(div.style.color).toMatch(/^rgb/);
    div.remove();
  });
});

describe('PDF de la factura (vista previa)', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideNoopAnimations(), MessageService] }));

  it('borrador con impuestos: genera un PDF real (sin lanzar por oklch) de al menos una página y con peso', async () => {
    const fixture = montar({ status: 'BORRADOR' });
    const hoja = fixture.nativeElement.querySelector('div.relative') as HTMLElement;
    const pdf = await buildInvoicePdf(hoja);
    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(pdf.output('blob').size).toBeGreaterThan(0);
  }, 30000);

  it('con colores oklch()/color-mix() (Tailwind 4) en la hoja: no lanza "unsupported color function"', async () => {
    const fixture = montar({ status: 'EMITIDA', number: 'FV-000003' });
    const hoja = fixture.nativeElement.querySelector('div.relative') as HTMLElement;
    hoja.style.color = 'oklch(0.278 0.033 256.848)';
    const extra = document.createElement('p');
    extra.textContent = 'Texto con colores modernos';
    extra.style.cssText =
      'color: oklch(0.55 0.2 30); background-color: color-mix(in oklab, red 40%, blue); border: 1px solid oklch(0.87 0.01 258);' +
      'box-shadow: 0 1px 3px oklch(0.2 0 0 / 0.3)';
    hoja.appendChild(extra);
    const pdf = await buildInvoicePdf(hoja);
    expect(pdf.getNumberOfPages()).toBe(1);
  }, 30000);

  it('emitida y anulada también generan PDF', async () => {
    for (const status of ['EMITIDA', 'ANULADA']) {
      const fixture = montar({ status, number: 'FV-000001' });
      const pdf = await buildInvoicePdf(fixture.nativeElement.querySelector('div.relative') as HTMLElement);
      expect(pdf.getNumberOfPages()).toBe(1);
    }
  }, 30000);

  it('una factura larga se parte en más de una página', async () => {
    const fixture = montar({ status: 'EMITIDA', number: 'FV-000002', lines: lines(60) });
    const pdf = await buildInvoicePdf(fixture.nativeElement.querySelector('div.relative') as HTMLElement);
    expect(pdf.getNumberOfPages()).toBeGreaterThan(1);
  }, 60000);

  it('el botón Imprimir existe, queda fuera de la hoja y no aparece dentro de ella', () => {
    const fixture = montar({});
    const el = fixture.nativeElement as HTMLElement;
    const boton = el.querySelector('p-button button') as HTMLButtonElement;
    expect(boton).not.toBeNull();
    expect(boton.textContent).toContain('Imprimir');
    expect(el.querySelector('div.relative')!.contains(boton)).toBeFalse();
  });

  it('al pulsar: se deshabilita mientras genera, llama a la lógica y descarga con el nombre esperado', async () => {
    const fixture = montar({ status: 'EMITIDA', number: 'FV-000001', kind: 'SALE' });
    const cmp = fixture.componentInstance;
    let liberar!: () => void;
    const espera = new Promise<void>((r) => (liberar = r));
    const save = jasmine.createSpy('save');
    const builder = jasmine.createSpy('builder').and.callFake(async () => {
      await espera;
      return { save } as never;
    });
    cmp.pdfBuilder = builder;

    const boton = () => fixture.nativeElement.querySelector('p-button button') as HTMLButtonElement;
    boton().click();
    fixture.detectChanges();
    expect(builder).toHaveBeenCalledTimes(1);
    expect(cmp.printing()).toBeTrue();
    expect(boton().disabled).toBeTrue();

    liberar();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(save).toHaveBeenCalledOnceWith('factura-de-venta-fv-000001.pdf');
    expect(cmp.printing()).toBeFalse();
    expect(boton().disabled).toBeFalse();
  });

  it('borrador sin número descarga "...-borrador.pdf"', async () => {
    const fixture = montar({ status: 'BORRADOR', kind: 'PURCHASE' });
    const save = jasmine.createSpy('save');
    fixture.componentInstance.pdfBuilder = async () => ({ save }) as never;
    await fixture.componentInstance.print();
    expect(save).toHaveBeenCalledOnceWith('factura-de-compra-borrador.pdf');
  });

  it('si falla: muestra un toast de error y rehabilita el botón', async () => {
    const fixture = montar({});
    const add = spyOn(TestBed.inject(MessageService), 'add');
    spyOn(console, 'error');
    fixture.componentInstance.pdfBuilder = () => Promise.reject(new Error('boom'));
    await fixture.componentInstance.print();
    expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error' }));
    expect(fixture.componentInstance.printing()).toBeFalse();
  });
});
