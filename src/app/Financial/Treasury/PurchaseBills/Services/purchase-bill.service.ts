import { Injectable } from '@angular/core';
import { Observable, forkJoin, map, of, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TreasuryApiService } from '../../Shared/treasury-api.service';
import { ChartAccountService } from '../../../../GeneralMasters/AccountCatalogue/services/chart-account.service';
import { ThirdService } from '../../../../GeneralMasters/ThirdParties/Services/third.service';
import { LocalStorageMethods } from '../../../../Shared/Methods/local-storage.method';
import { ExpenseAccount, PurchaseBill, PurchaseBillCreateRequest, PurchaseBillListView } from '../Models/PurchaseBill';

interface Supplier { id: number; name: string; accountsPayableAccount: { id: number; code: string; name: string } }

@Injectable({ providedIn: 'root' })
export class PurchaseBillService {
  constructor(
    private readonly api: TreasuryApiService,
    private readonly accounts: ChartAccountService,
    private readonly thirds: ThirdService,
    private readonly storage: LocalStorageMethods,
  ) {}

  private enterpriseId() {
    const id = this.storage.getIdEnterprise();
    if (!id) throw new Error('No hay una empresa activa');
    return id;
  }

  getSuppliers(query = ''): Observable<Supplier[]> {
    return forkJoin({
      payables: this.api.pending(this.enterpriseId()),
      thirds: this.thirds.getThirdParties(this.enterpriseId(), 0, 1000).pipe(
        catchError(() => of({ content: [] } as any)),
      ),
    }).pipe(
      map(({ payables, thirds }) => {
        const thirdNames = new Map<number, string>(
          (thirds?.content || []).map((t: any) => {
            const name =
              (t.socialReason as string) ||
              [t.names, t.lastNames].filter(Boolean).join(' ') ||
              `Proveedor ${t.thId}`;
            return [Number(t.thId), String(name)] as [number, string];
          }),
        );

        return [...new Set(payables.map((item) => item.supplierId))]
          .map((id) => {
            const payable = payables.find((item) => item.supplierId === id)!;
            return {
              id,
              name: thirdNames.get(id) || `Proveedor ${id}`,
              accountsPayableAccount: {
                id: payable.payableAccountId,
                code: payable.payableAccountCode,
                name: payable.payableAccountCode,
              },
            };
          })
          .filter((item) => item.name.toLowerCase().includes(query.toLowerCase()));
      }),
    );
  }

  getSupplierById(id: number) {
    return this.getSuppliers().pipe(map((items) => items.find((item) => item.id === id)));
  }

  getExpenseAccounts(): Observable<ExpenseAccount[]> {
    return this.accounts.getListAuxiliaryAccounts(this.enterpriseId()).pipe(
      map((items) =>
        items
          .filter((item) => item.status !== false)
          .map((item) => ({
            id: item.id!,
            code: item.code,
            name: item.description,
            fullName: `${item.code} - ${item.description}`,
          })),
      ),
    );
  }

  getNextBillId(): Observable<string> {
    return of('Asignado por Facturación');
  }

  getAllPurchaseBills(enterpriseId: string): Observable<PurchaseBillListView[]> {
    return forkJoin({
      payables: this.api.pending(enterpriseId),
      thirds: this.thirds.getThirdParties(enterpriseId, 0, 1000).pipe(
        catchError(() => of({ content: [] } as any)),
      ),
    }).pipe(
      map(({ payables, thirds }) => {
        const thirdNames = new Map<number, string>(
          (thirds?.content || []).map((t: any) => {
            const name =
              (t.socialReason as string) ||
              [t.names, t.lastNames].filter(Boolean).join(' ') ||
              `Proveedor ${t.thId}`;
            return [Number(t.thId), String(name)] as [number, string];
          }),
        );

        return (payables || []).map((item) => {
          const pending = Number(item.availableAmount ?? item.pendingAmount ?? 0);
          const paid = Number(item.paidAmount || 0);
          const status = pending <= 0 ? 'PAID' : paid > 0 ? 'PARTIALLY_PAID' : 'POSTED';
          const statusDisplay =
            status === 'PAID'
              ? 'Pagada'
              : status === 'PARTIALLY_PAID'
                ? 'Abono parcial'
                : 'Pendiente de pago';

          return {
            id: item.id,
            billId: item.reference,
            dateOpened: new Date(item.issueDate),
            supplierId: item.supplierId,
            supplierName: thirdNames.get(item.supplierId) || `Proveedor ${item.supplierId}`,
            total: item.originalAmount,
            paidAmount: item.paidAmount,
            pendingBalance: pending,
            status,
            statusDisplay,
          };
        });
      }),
    );
  }

  getPurchaseBillById(id: number): Observable<PurchaseBill | undefined> {
    return this.api.pending(this.enterpriseId()).pipe(
      map((items) => {
        const item = items.find((value) => value.id === id);
        return item
          ? {
              id: item.id,
              billId: item.reference,
              dateOpened: new Date(item.issueDate),
              supplierId: item.supplierId,
              subtotal: item.originalAmount,
              total: item.originalAmount,
              paidAmount: item.paidAmount,
              pendingBalance: item.availableAmount,
              status: 'POSTED' as const,
              lineItems: [],
              enterpriseId: item.enterpriseId,
            }
          : undefined;
      }),
    );
  }

  createPurchaseBill(billData: PurchaseBillCreateRequest): Observable<PurchaseBill> {
    return throwError(
      () =>
        new Error(
          'Las facturas de compra se crean en Facturación y se sincronizan automáticamente con Tesorería.',
        ),
    );
  }

  updatePurchaseBill(id: number, billData: Partial<PurchaseBillCreateRequest>): Observable<PurchaseBill> {
    return throwError(
      () =>
        new Error(
          'La obligación sincronizada no se edita desde Tesorería; solo puede modificarse su vencimiento operativo.',
        ),
    );
  }

  deletePurchaseBill(id: number): Observable<void> {
    return throwError(() => new Error('Las obligaciones sincronizadas no se eliminan desde Tesorería.'));
  }
}
