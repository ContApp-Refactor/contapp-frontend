import { Injectable } from '@angular/core';
import { Observable, forkJoin, map, of, throwError, timer } from 'rxjs';
import { catchError, last, switchMap, take, takeWhile } from 'rxjs/operators';
import { PaymentMethodsServiceService } from '../../../../GeneralMasters/PaymentMethods/services/payment-methods-service.service';
import { ChartAccountService } from '../../../../GeneralMasters/AccountCatalogue/services/chart-account.service';
import { BankAccountsService } from '../../../../GeneralMasters/BankAccounts/services/bank-accounts.service';
import { LocalStorageMethods } from '../../../../Shared/Methods/local-storage.method';
import { TreasuryApiService } from '../../Shared/treasury-api.service';
import { DropdownOption, ExpenseReceiptView, PurchaseInvoice, Supplier } from '../Model/Models';
import { ExpenseReceiptDetailsView } from '../Model/ExpenseReceiptView';
import { ExpenseReceiptResponse } from '../Model/ExpenseReceiptResponse';
import { ExpenseReceiptCreateRequest } from '../Model/ExpenseReceiptCreateRequest';
import { AccountingEntryLine } from '../Model/AccountingEntryLine';
import { ThirdService } from '../../../../GeneralMasters/ThirdParties/Services/third.service';
import { SteletonService } from '../../../../Commercial/InvoiceTemplate/services/steleton.service';
import { PurchaseInvoiceProductLine } from '../../../../Commercial/PurchaseInvoice/models/purchase-invoice-payload';
import {
  accountingEntryStatusLabel,
  educationalDescription,
  translatePaymentMethodName,
  voucherStatusLabel,
  accountingSourceDocumentTypeLabel,
} from '../../Shared/treasury-status-labels';
import {
  buildThirdPartyIdentificationMap,
  buildThirdPartyNameMap,
  resolveSupplierIdentification,
  resolveSupplierName,
} from '../../Shared/treasury-third-party.integration';
import {
  AccountingEntryView,
  AccountCatalogueNode,
  buildAccountCatalogueLookup,
  buildAccountingEntryView,
  flattenAccountCatalogueRefs,
  mapAccountingMovementsForView,
} from '../../Shared/treasury-accounting-display';
import { PaymentVoucher, Payable, VoucherDetail } from '../../Shared/treasury-api.models';
import {
  PaidInvoiceLineView,
  mapSkeletonProductsToLineViews,
} from '../../Shared/treasury-purchase-invoice-lines';

@Injectable({ providedIn: 'root' })
export class ExpenseReceiptService {
  constructor(
    private readonly api: TreasuryApiService,
    private readonly paymentMethods: PaymentMethodsServiceService,
    private readonly accounts: ChartAccountService,
    private readonly bankAccounts: BankAccountsService,
    private readonly thirds: ThirdService,
    private readonly storage: LocalStorageMethods,
    private readonly skeleton: SteletonService,
  ) {}

  private enterpriseId(): string {
    const id = this.storage.getIdEnterprise();
    if (!id) throw new Error('No hay una empresa activa');
    return id;
  }

  getReceiptTypes(): Observable<DropdownOption[]> {
    return this.paymentMethods.findAll(this.enterpriseId(), 0, 100).pipe(
      map(page => page.content.map(method => ({ label: method.name, value: method.id })))
    );
  }

  getAuxiliaryAccounts(): Observable<DropdownOption[]> {
    return this.accounts.getListAuxiliaryAccounts(this.enterpriseId()).pipe(
      map(items => items.filter(item => item.status !== false).map(item => ({
        label: `${item.code} - ${item.description}`, value: item.id
      })))
    );
  }

  getSuppliers(query = ''): Observable<Supplier[]> {
    const enterpriseId = this.enterpriseId();
    return forkJoin({
      payables: this.api.pending(enterpriseId),
      thirds: this.thirds.getThirdParties(enterpriseId, 0, 1000).pipe(
        catchError(() => of({ content: [] } as any)),
      ),
    }).pipe(
      map(({ payables, thirds }) => {
        const thirdNames = buildThirdPartyNameMap(thirds?.content || []);
        const ids = [...new Set(payables.map((item) => item.supplierId))];
        return ids
          .map((id) => {
            const payable = payables.find((item) => item.supplierId === id)!;
            return {
              id,
              name: resolveSupplierName(thirdNames, id),
              accountsPayableAccount: {
                id: payable.payableAccountId,
                code: payable.payableAccountCode,
                name: payable.payableAccountCode,
              },
            };
          })
          .filter((supplier) => supplier.name.toLowerCase().includes(query.toLowerCase()));
      }),
    );
  }

  getSupplierById(id: number): Observable<Supplier | undefined> {
    return this.getSuppliers().pipe(map(items => items.find(item => item.id === id)));
  }

  getInvoicesBySupplier(supplierId: number): Observable<PurchaseInvoice[]> {
    return this.api.pending(this.enterpriseId(), supplierId).pipe(map(items => items.map(item => ({
      id: item.id,
      factCode: item.reference,
      expirationDate: new Date(item.dueDate),
      pendingValue: item.availableAmount,
      amountToPay: item.availableAmount,
      payableAccountId: item.payableAccountId,
      payableAccountCode: item.payableAccountCode,
    }))));
  }

  getPayableAccounts(): Observable<{ id: number; code: string; name: string; fullName: string }[]> {
    return this.api.pending(this.enterpriseId()).pipe(
      map(items => {
        const accounts = new Map<number, { id: number; code: string; name: string; fullName: string }>();
        items.forEach(item => {
          if (!item.payableAccountId) {
            return;
          }
          const code = item.payableAccountCode || String(item.payableAccountId);
          accounts.set(item.payableAccountId, {
            id: item.payableAccountId,
            code,
            name: 'Cuenta por pagar',
            fullName: `${code} - Cuenta por pagar`,
          });
        });
        return [...accounts.values()].sort((left, right) => left.code.localeCompare(right.code));
      }),
    );
  }

  getAllExpenseReceipts(): Observable<ExpenseReceiptView[]> {
    const enterpriseId = this.enterpriseId();
    return forkJoin({
      vouchers: this.api.vouchers(enterpriseId),
      thirds: this.thirds.getThirdParties(enterpriseId, 0, 1000).pipe(
        catchError(() => of({ content: [] } as any)),
      ),
    }).pipe(
      map(({ vouchers, thirds }) => {
        const thirdNames = new Map<number, string>(
          (thirds?.content || []).map((t: any) => {
            const name =
              (t.socialReason as string) ||
              [t.names, t.lastNames].filter(Boolean).join(' ') ||
              `Proveedor ${t.thId}`;
            return [Number(t.thId), String(name)] as [number, string];
          }),
        );

        return (vouchers.content || []).map((voucher) => {
          const supplierIds = [...new Set((voucher.details || []).map((d) => d.supplierId))];
          const thirdPartyId = supplierIds[0] ?? 0;
          const supplierName =
            supplierIds.length > 1
              ? `${supplierIds.length} proveedores`
              : thirdNames.get(thirdPartyId) || `Proveedor ${thirdPartyId || ''}`;

          return {
            id: voucher.id,
            receiptCode: voucher.voucherNumber,
            issueDate: new Date(voucher.issueDate),
            thirdPartyId,
            supplierName,
            status: voucherStatusLabel(voucher.status),
            statusKey: voucher.status,
            totalAmount: Number(voucher.total ?? 0),
            accountingEntryId: voucher.accountingEntryId,
          };
        });
      }),
    );
  }

  getExpenseReceiptById(id: number): Observable<ExpenseReceiptDetailsView> {
    const enterpriseId = this.enterpriseId();
    return this.api.voucher(id, enterpriseId).pipe(
      switchMap((voucher) => {
        const supplierIds = [...new Set((voucher.details ?? []).map((detail) => detail.supplierId))];
        return forkJoin({
          voucher: of(voucher),
          thirds: this.loadThirdPartyMaps(enterpriseId, supplierIds),
          methods: this.paymentMethods.findAll(this.enterpriseId(), 0, 100).pipe(catchError(() => of({ content: [] } as any))),
          banks: this.bankAccounts.findAllActive(enterpriseId).pipe(catchError(() => of({ content: [] } as any))),
          schedules: this.api.schedules(enterpriseId).pipe(catchError(() => of([]))),
          payables: forkJoin(
            (voucher.details ?? []).map((detail) =>
              this.api.payable(detail.invoiceId, enterpriseId).pipe(catchError(() => of(null))),
            ),
          ),
          accounting: voucher.accountingEntryId
            ? this.api.accountingEntry(id).pipe(catchError(() => of(null)))
            : of(null),
        });
      }),
      map(({ voucher, thirds, methods, banks, schedules, payables, accounting }) => {
        const thirdNames = thirds.names;
        const thirdIdentifications = thirds.identifications;
        const supplierIds = [...new Set((voucher.details ?? []).map((detail) => detail.supplierId))];
        const supplierId = supplierIds[0] ?? 0;
        const supplierLabel = supplierIds.length > 1
          ? supplierIds.map((sid) => resolveSupplierName(thirdNames, sid)).join(', ')
          : resolveSupplierName(thirdNames, supplierId);
        const method = (methods.content || []).find((item: any) => item.id === voucher.paymentMethodId);
        const bank = (banks.content || []).find((item: any) => item.id === voucher.bankAccountId);
        const schedule = schedules.find((item) => item.voucherId === voucher.id);
        const payableList = payables as Array<Payable | null>;
        const amounts = this.computeVoucherAmounts(voucher, payableList);
        const executionRaw = voucher.updatedAt ?? voucher.createdAt;
        const entryData = (accounting as { data?: Record<string, unknown> } | null)?.data
          ?? (accounting as Record<string, unknown> | null);
        const accountingEntryCode = voucher.accountingEntryCode?.trim()
          || (typeof entryData?.['code'] === 'string' ? entryData['code'] : undefined)
          || (typeof entryData?.['entryCode'] === 'string' ? entryData['entryCode'] : undefined);
        return {
          id: voucher.id,
          receiptCode: voucher.voucherNumber,
          issueDate: new Date(voucher.issueDate),
          executionDateTime: executionRaw ? new Date(executionRaw) : undefined,
          thirdPartyId: supplierId,
          supplierName: supplierLabel,
          supplierIdentification: supplierIds.length === 1
            ? resolveSupplierIdentification(thirdIdentifications, supplierId)
            : supplierIds.map((sid) => resolveSupplierIdentification(thirdIdentifications, sid)).join(', '),
          paymentMethodName: translatePaymentMethodName(method?.name) || `Método ${voucher.paymentMethodId}`,
          paymentMethodRequiresBankAccount: Boolean(method?.requiresBankAccount),
          bankAccountId: voucher.bankAccountId,
          bankAccountLabel: bank
            ? `${bank.bank?.name || 'Banco'} - ${bank.accountNumber}`
            : undefined,
          status: voucherStatusLabel(voucher.status),
          statusKey: voucher.status,
          grossAmount: amounts.grossAmount,
          retentionsAmount: amounts.retentionsAmount,
          netAmount: amounts.netAmount,
          totalAmount: amounts.netAmount,
          observations: educationalDescription(voucher.observations, 'Pago a proveedor'),
          isDirectExpense: false,
          accountingEntryId: voucher.accountingEntryId,
          accountingEntryCode,
          accountingStatusLabel: this.accountingStatusForVoucher(voucher),
          scheduleId: schedule?.id,
          scheduleExecutionDate: schedule?.executionDate,
          details: (voucher.details ?? []).map((detail, index) =>
            this.mapVoucherDetail(detail, payableList[index]?.sourceInvoiceId, payableList[index]),
          ),
          accountingEntry: undefined,
        };
      }),
    );
  }

  private loadThirdPartyMaps(
    enterpriseId: string,
    supplierIds: number[],
  ): Observable<{ names: Map<number, string>; identifications: Map<number, string> }> {
    return this.thirds.getThirdParties(enterpriseId, 0, 1000).pipe(
      catchError(() => of({ content: [] } as any)),
      switchMap((thirdsPage) => {
        const names = buildThirdPartyNameMap(thirdsPage?.content || []);
        const identifications = buildThirdPartyIdentificationMap(thirdsPage?.content || []);
        const missing = supplierIds.filter((id) => id != null && !names.has(Number(id)));
        if (!missing.length) {
          return of({ names, identifications });
        }
        return forkJoin(
          missing.map((id) =>
            this.thirds.getThirdPartie(id, enterpriseId).pipe(catchError(() => of(null))),
          ),
        ).pipe(
          map((extraThirds) => {
            extraThirds.filter(Boolean).forEach((third) => {
              const id = Number(third!.thId);
              const label =
                (third!.socialReason as string) ||
                [third!.names, third!.lastNames].filter(Boolean).join(' ') ||
                `Proveedor ${id}`;
              names.set(id, String(label));
              const base = third!.idNumber != null ? String(third!.idNumber) : '';
              identifications.set(
                id,
                base
                  ? `${base}${third!.verificationNumber != null ? `-${third!.verificationNumber}` : ''}`
                  : '—',
              );
            });
            return { names, identifications };
          }),
        );
      }),
    );
  }

  private accountingStatusForVoucher(voucher: PaymentVoucher): string {
    if (!voucher.accountingEntryId) {
      return voucherStatusLabel(voucher.status);
    }
    if (voucher.status === 'VOIDED') {
      return accountingEntryStatusLabel('VOIDED');
    }
    return accountingEntryStatusLabel('ACTIVE') === 'Desconocido'
      ? 'Contabilizado'
      : accountingEntryStatusLabel('ACTIVE');
  }

  getPaidInvoiceProductLines(sourceInvoiceId: number): Observable<PaidInvoiceLineView[]> {
    return this.skeleton.getFactureById(sourceInvoiceId).pipe(
      map((facture) => mapSkeletonProductsToLineViews(this.normalizeSkeletonProducts(facture as {
        products?: PurchaseInvoiceProductLine[] | Iterable<PurchaseInvoiceProductLine>;
      }))),
    );
  }

  getPaidInvoiceProductLinesForObligation(
    obligationId: number,
  ): Observable<{ sourceInvoiceId: number; lines: PaidInvoiceLineView[] }> {
    return this.api.payable(obligationId, this.enterpriseId()).pipe(
      switchMap((payable) => {
        const sourceInvoiceId = Number(payable.sourceInvoiceId);
        if (!Number.isInteger(sourceInvoiceId) || sourceInvoiceId <= 0) {
          return throwError(() => new Error('La obligación no tiene una factura de origen válida.'));
        }
        return this.getPaidInvoiceProductLines(sourceInvoiceId).pipe(
          map((lines) => ({ sourceInvoiceId, lines })),
        );
      }),
    );
  }

  private computeVoucherAmounts(
    voucher: PaymentVoucher,
    payables: Array<Payable | null> = [],
  ): {
    grossAmount: number;
    retentionsAmount: number;
    netAmount: number;
  } {
    const details = voucher.details ?? [];
    let grossAmount = 0;
    let retentionsAmount = 0;
    let netAmount = 0;
    details.forEach((detail, index) => {
      const amountPaid = this.detailAmountPaid(detail);
      let previousBalance = Number(detail.previousBalance ?? 0);
      const remainingBalance = Number(detail.remainingBalance ?? 0);
      const payable = payables[index];
      if (previousBalance <= 0 && payable) {
        previousBalance = Number(
          payable.originalAmount ?? payable.pendingAmount ?? payable.availableAmount ?? amountPaid,
        );
      }
      const invoiceValue = previousBalance > 0 ? previousBalance : amountPaid;
      const retention = Math.max(0, invoiceValue - amountPaid - remainingBalance);
      grossAmount += invoiceValue;
      retentionsAmount += retention;
      netAmount += amountPaid;
    });
    if (!details.length) {
      netAmount = Number(voucher.total ?? 0);
      grossAmount = netAmount;
    } else if (netAmount <= 0 && voucher.total) {
      netAmount = Number(voucher.total);
      if (grossAmount <= 0) {
        grossAmount = netAmount;
      }
    }
    return { grossAmount, retentionsAmount, netAmount };
  }

  private detailAmountPaid(detail: VoucherDetail): number {
    return Number(detail.amountPaid ?? detail.amount ?? 0);
  }

  private mapVoucherDetail(
    detail: VoucherDetail,
    sourceInvoiceId?: number,
    payable?: Payable | null,
  ) {
    const amountPaid = this.detailAmountPaid(detail);
    let previousBalance = Number(detail.previousBalance ?? 0);
    const remainingBalance = Number(detail.remainingBalance ?? 0);
    if (previousBalance <= 0 && payable) {
      previousBalance = Number(
        payable.originalAmount ?? payable.pendingAmount ?? payable.availableAmount ?? amountPaid,
      );
    }
    const invoiceValue = previousBalance > 0 ? previousBalance : amountPaid;
    const retentionsApplied = Math.max(0, invoiceValue - amountPaid - remainingBalance);
    return {
      invoiceId: detail.invoiceId,
      sourceInvoiceId: sourceInvoiceId != null ? Number(sourceInvoiceId) : undefined,
      amountPaid,
      invoiceCode: detail.invoiceReference?.trim() || payable?.reference || String(detail.invoiceId),
      invoiceValue,
      retentionsApplied,
      payableAccountCode: detail.payableAccountCode?.trim() || payable?.payableAccountCode || '—',
      remainingBalance,
    };
  }

  private normalizeSkeletonProducts(facture: { products?: PurchaseInvoiceProductLine[] | Iterable<PurchaseInvoiceProductLine> }): PurchaseInvoiceProductLine[] {
    const products = facture?.products;
    if (!products) {
      return [];
    }
    if (Array.isArray(products)) {
      return products;
    }
    return Array.from(products);
  }

  createExpenseReceipt(request: ExpenseReceiptCreateRequest): Observable<ExpenseReceiptResponse> {
    return this.api.createVoucher({
      enterpriseId: request.enterpriseId,
      issueDate: new Date().toISOString().slice(0, 10),
      paymentMethodId: request.paymentMethodId,
      bankAccountId: request.bankAccountId ?? undefined,
      observations: request.observations,
      details: request.details.map(detail => ({ supplierId: request.thirdPartyId, invoiceId: detail.invoiceId, amount: detail.amountPaid })),
    }).pipe(map(voucher => ({
      id: voucher.id, receiptCode: voucher.voucherNumber,
      thirdPartyId: voucher.details[0]?.supplierId ?? request.thirdPartyId,
      paymentMethodId: voucher.paymentMethodId, status: voucher.status,
      issueDate: voucher.issueDate, totalAmount: voucher.total,
      observations: voucher.observations ?? '',
      details: voucher.details.map(detail => ({ invoiceId: detail.invoiceId, amountPaid: detail.amountPaid,
        invoiceCode: detail.invoiceReference, accountingAccount: detail.payableAccountId })),
    })));
  }

  voidExpenseReceipt(receiptId: number, reason: string): Observable<ExpenseReceiptResponse> {
    const enterpriseId = this.enterpriseId();
    return this.api.voidVoucher(receiptId, enterpriseId, reason).pipe(
      switchMap((voucher) => this.waitForVoucherVoidCompletion(receiptId, enterpriseId, voucher)),
      map((voucher) => this.mapVoidedVoucherResponse(voucher)),
    );
  }

  private waitForVoucherVoidCompletion(
    receiptId: number,
    enterpriseId: string,
    voucher: PaymentVoucher,
  ): Observable<PaymentVoucher> {
    if (voucher.status !== 'VOIDING') {
      return of(voucher);
    }
    return timer(0, 2000).pipe(
      take(15),
      switchMap(() => this.api.voucher(receiptId, enterpriseId)),
      takeWhile((item) => item.status === 'VOIDING', true),
      last(null),
      map((item) => item ?? voucher),
    );
  }

  private mapVoidedVoucherResponse(voucher: PaymentVoucher): ExpenseReceiptResponse {
    return {
      id: voucher.id,
      receiptCode: voucher.voucherNumber,
      thirdPartyId: voucher.details?.[0]?.supplierId ?? 0,
      paymentMethodId: voucher.paymentMethodId,
      status: voucher.status,
      issueDate: voucher.issueDate,
      totalAmount: Number(voucher.total ?? 0),
      observations: voucher.observations ?? '',
      details: (voucher.details ?? []).map((detail) => ({
        invoiceId: detail.invoiceId,
        amountPaid: Number(detail.amountPaid ?? 0),
        invoiceCode: detail.invoiceReference,
        accountingAccount: detail.payableAccountId,
      })),
    };
  }

  getAccountingEntry(receiptId: number): Observable<AccountingEntryLine[]> {
    return this.getAccountingEntryView(receiptId).pipe(
      map((view) => view.movements.map((movement) => ({
        accountCode: movement.accountCode,
        accountName: movement.accountName,
        thirdPartyId: movement.thirdPartyId ?? 0,
        debit: movement.debit,
        credit: movement.credit,
        description: movement.detail,
      }))),
    );
  }

  getAccountingEntryView(
    receiptId: number,
    headerContext: { voucherNumber?: string; supplierLabel?: string } = {},
  ): Observable<AccountingEntryView> {
    const enterpriseId = this.enterpriseId();
    return forkJoin({
      entry: this.api.accountingEntry(receiptId),
      accounts: this.accounts.getListAccounts(enterpriseId).pipe(catchError(() => of([]))),
      voucher: this.api.voucher(receiptId, enterpriseId),
      thirds: this.thirds.getThirdParties(enterpriseId, 0, 1000).pipe(
        catchError(() => of({ content: [] } as any)),
      ),
    }).pipe(
      map(({ entry, accounts, voucher, thirds }) => {
        const entryData = (entry as any)?.data ?? entry;
        const lookup = buildAccountCatalogueLookup(
          flattenAccountCatalogueRefs(accounts as AccountCatalogueNode[]).filter(
            (account) => account.status !== false,
          ),
        );
        const movements = mapAccountingMovementsForView(entryData?.movements ?? [], lookup);
        const thirdNames = buildThirdPartyNameMap(thirds?.content || []);
        const supplierIds = [...new Set((voucher.details || []).map((detail) => detail.supplierId))];
        const supplierLabel = headerContext.supplierLabel
          ?? (supplierIds.length > 1
            ? supplierIds.map((id) => resolveSupplierName(thirdNames, id)).join(', ')
            : resolveSupplierName(thirdNames, supplierIds[0] ?? 0));

        return buildAccountingEntryView(
          entryData as Record<string, unknown>,
          movements,
          {
            documentTypeLabel: accountingSourceDocumentTypeLabel('PAYMENT_VOUCHER'),
            voucherNumber: headerContext.voucherNumber ?? voucher.voucherNumber,
            supplierLabel,
            entryCode: voucher.accountingEntryCode,
          },
        );
      }),
    );
  }
}
