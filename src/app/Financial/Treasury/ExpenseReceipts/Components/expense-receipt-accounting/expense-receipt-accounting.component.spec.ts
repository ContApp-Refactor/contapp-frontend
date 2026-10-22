import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { ExpenseReceiptService } from '../../Service/expense-receipt.service';
import { ExpenseReceiptAccountingComponent } from './expense-receipt-accounting.component';

describe('ExpenseReceiptAccountingComponent route view', () => {
  let fixture: ComponentFixture<ExpenseReceiptAccountingComponent>;
  let service: {
    getExpenseReceiptById: jasmine.Spy;
    getAccountingEntryView: jasmine.Spy;
  };

  beforeAll(() => registerLocaleData(localeEsCo));

  beforeEach(async () => {
    service = {
      getExpenseReceiptById: jasmine.createSpy().and.returnValue(of({
        id: 21,
        receiptCode: 'CE-21',
        issueDate: new Date('2026-08-18'),
        supplierName: 'Proveedor Demo',
      })),
      getAccountingEntryView: jasmine.createSpy().and.returnValue(of({
        header: { entryCode: 'AE-PV-21', entryStatus: 'ACTIVE' },
        movements: [
          {
            accountId: 2205,
            accountCode: '2205',
            accountName: 'Cuentas por pagar',
            detail: 'Pago factura FC-123',
            debit: 123000,
            credit: 0,
          },
          {
            accountId: 1105,
            accountCode: '1105',
            accountName: 'Caja/Banco',
            detail: 'Pago factura FC-123',
            debit: 0,
            credit: 123000,
          },
        ],
      })),
    };

    await TestBed.configureTestingModule({
      imports: [ExpenseReceiptAccountingComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '21' } } } },
        { provide: Router, useValue: { navigate: jasmine.createSpy() } },
        { provide: ExpenseReceiptService, useValue: service },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExpenseReceiptAccountingComponent);
    fixture.detectChanges();
  });

  it('requests the route receipt and renders every accounting movement with numeric debit and credit', () => {
    expect(service.getExpenseReceiptById).toHaveBeenCalledWith(21);
    expect(service.getAccountingEntryView).toHaveBeenCalledWith(21, {
      voucherNumber: 'CE-21',
      supplierLabel: 'Proveedor Demo',
    });

    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    const firstRowText = rows[0].textContent.replace(/\s/g, '');
    const secondRowText = rows[1].textContent.replace(/\s/g, '');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('2205');
    expect(rows[0].textContent).toContain('Cuentas por pagar');
    expect(rows[0].textContent).toContain('Pago factura FC-123');
    expect(firstRowText).toContain('123.000');
    expect(firstRowText).toContain('COP0');
    expect(rows[1].textContent).toContain('1105');
    expect(rows[1].textContent).toContain('Caja/Banco');
    expect(secondRowText).toContain('COP0');
    expect(secondRowText).toContain('123.000');
    const amountCells = Array.from(rows).flatMap((row: any) => [row.cells[3], row.cells[4]]);
    expect(amountCells.some((cell: HTMLTableCellElement) => cell.textContent?.trim() === '-')).toBeFalse();
  });

  it('keeps the two movements balanced', () => {
    const component = fixture.componentInstance;
    expect(component.accountingMovements.length).toBe(2);
    expect(component.getTotalDebit()).toBe(123000);
    expect(component.getTotalCredit()).toBe(123000);
    expect(component.accountingIsBalanced).toBeTrue();
  });

  it('labels a voided entry as reversed historical trace while preserving balanced movements', () => {
    service.getAccountingEntryView.and.returnValue(of({
      header: { entryCode: 'AE-PV-21', entryStatus: 'VOIDED' },
      movements: [
        { accountCode: '2205', accountName: 'Cuentas por pagar', detail: 'Pago factura FC-123', debit: 123000, credit: 0 },
        { accountCode: '1105', accountName: 'Caja/Banco', detail: 'Pago factura FC-123', debit: 0, credit: 123000 },
      ],
    }));

    fixture.componentInstance.loadAccountingEntries(21);
    fixture.detectChanges();

    expect(fixture.componentInstance.accountingEntryIsVoided).toBeTrue();
    expect(fixture.componentInstance.accountingIsBalanced).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Movimientos históricos del asiento original');
    expect(fixture.nativeElement.textContent).toContain('su efecto contable fue revertido');
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(2);
  });
});
