import { of } from 'rxjs';
import { PurchaseInvoiceCreationComponent } from './purchase-invoice-creation.component';

describe('PurchaseInvoiceCreationComponent issue date', () => {
  it('sends the selected issue date and recalculates the due date', () => {
    const component = Object.create(PurchaseInvoiceCreationComponent.prototype) as any;
    const createPurchaseInvoice = jasmine.createSpy('createPurchaseInvoice').and.returnValue(of({}));
    component.supplier = { thId: 7 };
    component.lstProducts = [{
      id: 10,
      name: 'Producto',
      amount: 1,
      description: 'Producto de prueba',
      cost: 100000,
      IVA: 0,
      descuentos: [0, 0],
      maxQuantity: 10,
    }];
    component.currentDate = new Date(2026, 6, 15);
    component.paymentTermDays = 30;
    component.initialPayment = 0;
    component.total = 100000;
    component.pendingTotal = 100000;
    component.impuestoCheck = true;
    component.saving = false;
    component.messageService = { add: jasmine.createSpy('add') };
    component.purchaseInvoiceService = { createPurchaseInvoice };
    component.localStorageMethods = {
      loadEnterpriseData: () => ({ id: 'enterprise-a' }),
      getInventoryConfigType: () => 'WEIGHTED_AVERAGE',
    };

    component.onIssueDateChange(component.currentDate);
    component.saveInvoice();

    expect(createPurchaseInvoice).toHaveBeenCalledWith(jasmine.objectContaining({
      issueDate: '2026-07-15',
      expirationDate: '2026-08-14',
    }));
  });
});
