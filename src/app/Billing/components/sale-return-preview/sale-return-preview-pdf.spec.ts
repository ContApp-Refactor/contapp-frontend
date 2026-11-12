import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MessageService } from 'primeng/api';
import { SaleReturn } from '../../models/billing-sale-return.model';
import { buildInvoicePdf } from '../../utils/invoice-pdf';
import { SaleReturnPreviewComponent } from './sale-return-preview.component';

const devolucion = (over: Partial<SaleReturn> = {}): SaleReturn => ({
  id: 'r1',
  number: 'NC-000001',
  status: 'EMITIDA',
  kind: 'SALE',
  invoiceId: 'i1',
  originalNumber: 'FV-000001',
  originalDate: '2026-10-01',
  clientId: 'c1',
  clientName: 'Cliente de prueba',
  date: '2026-10-02',
  reason: 'Producto defectuoso',
  lines: [
    {
      productId: 'p1',
      productName: 'Producto uno',
      cantidadDevuelta: 2,
      precioUnitarioCents: 120000,
      ivaPct: 25,
      taxes: [
        { name: 'Iva', rate: 19 },
        { name: 'Ica', rate: 6 },
      ],
    },
  ],
  createdAt: '2026-10-02T10:00:00Z',
  updatedAt: '2026-10-02T10:00:00Z',
  ...over,
});

const montar = (saleReturn: SaleReturn) => {
  const fixture = TestBed.createComponent(SaleReturnPreviewComponent);
  fixture.componentRef.setInput('saleReturn', saleReturn);
  fixture.detectChanges();
  return fixture;
};

describe('PDF de la devolución (vista previa)', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideNoopAnimations(), MessageService] }));

  it('la devolución (venta o compra) no muestra método de pago', () => {
    for (const kind of ['SALE', 'PURCHASE'] as const) {
      const el = montar(devolucion({ kind })).nativeElement as HTMLElement;
      expect(el.textContent).not.toContain('Método de pago');
    }
  });

  it('genera un PDF real de la hoja de la devolución, con al menos una página y con peso', async () => {
    const fixture = montar(devolucion());
    const hoja = fixture.nativeElement.querySelector('div.relative') as HTMLElement;
    const pdf = await buildInvoicePdf(hoja);
    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(pdf.output('blob').size).toBeGreaterThan(0);
  }, 30000);

  it('el botón Imprimir existe y queda fuera de la hoja', () => {
    const el = montar(devolucion()).nativeElement as HTMLElement;
    const boton = el.querySelector('p-button button') as HTMLButtonElement;
    expect(boton).not.toBeNull();
    expect(boton.textContent).toContain('Imprimir');
    expect(el.querySelector('div.relative')!.contains(boton)).toBeFalse();
  });

  it('al pulsar: se deshabilita mientras genera y descarga con el nombre de la devolución de venta', async () => {
    const fixture = montar(devolucion());
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
    expect(save).toHaveBeenCalledOnceWith('devolucion-nc-000001.pdf');
    expect(cmp.printing()).toBeFalse();
    expect(boton().disabled).toBeFalse();
  });

  it('devolución de compra descarga con su propio nombre y borrador sin número "...-borrador.pdf"', async () => {
    const compra = montar(devolucion({ kind: 'PURCHASE', number: 'DC-000004' }));
    const saveCompra = jasmine.createSpy('save');
    compra.componentInstance.pdfBuilder = async () => ({ save: saveCompra }) as never;
    await compra.componentInstance.print();
    expect(saveCompra).toHaveBeenCalledOnceWith('devolucion-de-compra-dc-000004.pdf');

    const borrador = montar(devolucion({ status: 'BORRADOR', number: null }));
    const saveBorrador = jasmine.createSpy('save');
    borrador.componentInstance.pdfBuilder = async () => ({ save: saveBorrador }) as never;
    await borrador.componentInstance.print();
    expect(saveBorrador).toHaveBeenCalledOnceWith('devolucion-borrador.pdf');
  });

  it('si falla: muestra un toast de error y rehabilita el botón', async () => {
    const fixture = montar(devolucion());
    const add = spyOn(TestBed.inject(MessageService), 'add');
    spyOn(console, 'error');
    fixture.componentInstance.pdfBuilder = () => Promise.reject(new Error('boom'));
    await fixture.componentInstance.print();
    expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error' }));
    expect(fixture.componentInstance.printing()).toBeFalse();
  });
});
