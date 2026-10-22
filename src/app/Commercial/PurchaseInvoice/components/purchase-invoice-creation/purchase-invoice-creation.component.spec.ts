import { fakeAsync, tick } from '@angular/core/testing';
import { NEVER } from 'rxjs';
import { PurchaseInvoiceCreationComponent } from './purchase-invoice-creation.component';

describe('PurchaseInvoiceCreationComponent totals', () => {
  function component(): PurchaseInvoiceCreationComponent {
    return new PurchaseInvoiceCreationComponent(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  }

  it('calculates subtotal, taxes, total and pending balance', () => {
    const value = component();
    value.lstProducts = [
      {
        cost: 100_000,
        amount: 2,
        IVA: 19,
        IvaValor: 19_000,
        descuentos: [10, 0],
      } as any,
    ];
    value.initialPayment = 50_000;

    value.calculateTotals();

    expect(value.subTotal).toBe(180_000);
    expect(value.taxTotal).toBe(34_200);
    expect(value.total).toBe(214_200);
    expect(value.pendingTotal).toBe(164_200);
  });

  it('caps initial payment above total and enforces minimum partial payment', () => {
    const value = component();
    value.lstProducts = [
      {
        cost: 100,
        amount: 1,
        IVA: 0,
        descuentos: [0, 0],
      } as any,
    ];
    value.calculateTotals();

    value.initialPayment = 250;
    value.onInitialPaymentChange();
    expect(value.initialPayment).toBe(99);
    expect(value.pendingTotal).toBe(1);

    value.initialPayment = 10;
    value.onInitialPaymentChange();
    expect(value.initialPayment).toBe(50);
    expect(value.pendingTotal).toBe(50);
  });

  it('rejects full initial payment on save', () => {
    const value = component();
    value.supplier = { thId: 1 } as any;
    value.lstProducts = [{
      id: 1,
      name: 'Producto',
      amount: 1,
      cost: 100,
      IVA: 0,
      descuentos: [0, 0],
      maxQuantity: 10,
    } as any];
    value.calculateTotals();
    value.initialPayment = 100;

    const error = (value as any).validateInitialPayment();
    expect(error).toContain('Tesorería');
  });

  it('does not allow due dates on or before emission date', () => {
    const value = component();
    value.currentDate = new Date('2026-08-13T12:00:00');
    value.minDueDate = new Date('2026-08-14T00:00:00');
    value.dueDate = new Date('2026-08-13T12:00:00');

    value.onDueDateChange(value.dueDate);

    expect(value.dueDate?.toISOString().slice(0, 10)).toBe('2026-08-14');
    expect(value.paymentTermDays).toBe(1);
  });

  it('keeps payment term and due date in sync', () => {
    const value = component();
    value.currentDate = new Date('2026-08-13T12:00:00');
    value.minDueDate = new Date('2026-08-14T00:00:00');
    value.paymentTermDays = 30;
    value.onPaymentTermChange();

    expect(value.paymentTermDays).toBe(30);
    expect(value.dueDate?.toISOString().slice(0, 10)).toBe('2026-09-12');

    value.paymentTermDays = 10;
    value.onPaymentTermChange();
    expect(value.dueDate?.toISOString().slice(0, 10)).toBe('2026-08-23');

    value.onDueDateChange(new Date('2026-08-20T12:00:00'));
    expect(value.paymentTermDays).toBe(7);
  });

  it('recalculates line and invoice totals after editing a product', () => {
    const value = component();
    const product = {
      cost: 25_000,
      amount: 3,
      IVA: 19,
      IvaValor: 0,
      totalValue: 0,
      descuentos: [0, 0],
    } as any;
    value.lstProducts = [product];

    value.calculateLine(product);

    expect(product.totalValue).toBe(75_000);
    expect(value.subTotal).toBe(75_000);
    expect(value.total).toBe(89_250);
    expect(value.pendingTotal).toBe(89_250);
  });
});

describe('PurchaseInvoiceCreationComponent save state', () => {
  it('releases the loading button when the server does not respond', fakeAsync(() => {
    const component = Object.create(PurchaseInvoiceCreationComponent.prototype) as any;
    component.supplier = { thId: 1 };
    component.lstProducts = [{
      id: 10,
      amount: 1,
      description: 'Producto',
      cost: 100,
      IVA: 0,
      descuentos: [0, 0],
    }];
    component.initialPayment = 0;
    component.total = 100;
    component.pendingTotal = 100;
    component.currentDate = new Date('2026-08-13T12:00:00');
    component.paymentTermDays = 30;
    component.impuestoCheck = true;
    component.localStorageMethods = {
      loadEnterpriseData: () => ({ id: 'enterprise-a' }),
      getInventoryConfigType: () => 'WEIGHTED_AVERAGE',
    };
    component.purchaseInvoiceService = {
      createPurchaseInvoice: () => NEVER,
    };
    component.messageService = { add: jasmine.createSpy() };

    component.saveInvoice();
    expect(component.saving).toBeTrue();

    tick(20_001);

    expect(component.saving).toBeFalse();
    expect(component.messageService.add).toHaveBeenCalledWith(jasmine.objectContaining({
      severity: 'warn',
      summary: 'Respuesta demorada',
    }));
  }));

  it('shows API message when purchase save fails', () => {
    const component = Object.create(PurchaseInvoiceCreationComponent.prototype) as any;
    expect(component.purchaseSaveErrorDetail({
      error: { message: 'La empresa aún no tiene un catálogo de cuentas válido.' },
    })).toBe('La empresa aún no tiene un catálogo de cuentas válido.');
    expect(component.purchaseSaveErrorDetail({})).toBe('No se pudo crear la factura de compra');
  });
});
