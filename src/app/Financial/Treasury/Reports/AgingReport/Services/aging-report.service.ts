import { Injectable } from '@angular/core';
import { Observable, forkJoin, map, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TreasuryApiService } from '../../../Shared/treasury-api.service';
import { ChartAccountService } from '../../../../../GeneralMasters/AccountCatalogue/services/chart-account.service';
import { ThirdService } from '../../../../../GeneralMasters/ThirdParties/Services/third.service';
import { resolveSupplierFilterId } from '../../../Shared/treasury-third-party.integration';
import {
  AgingReportFilter,
  AgingReportResponse,
  AccountTypeOption,
  SupplierOption,
  DocumentOption,
  AgingFilterOptions,
} from '../Models/AgingReport';

@Injectable({ providedIn: 'root' })
export class AgingReportService {
  constructor(
    private readonly api: TreasuryApiService,
    private readonly accounts: ChartAccountService,
    private readonly thirds: ThirdService,
  ) {}

  getAgingReport(enterpriseId: string, filters: AgingReportFilter): Observable<AgingReportResponse> {
    const cutoff = this.toLocalDateString(filters.cutoffDate ?? new Date());
    const supplierId = resolveSupplierFilterId(filters.supplierId);
    const accountCode = filters.accountCode || undefined;
    const document = filters.document?.trim() || undefined;

    return forkJoin({
      items: this.api.aging(enterpriseId, cutoff, supplierId, accountCode, document),
      accounts: this.accounts.getListAuxiliaryAccounts(enterpriseId).pipe(catchError(() => of([]))),
      thirds: this.thirds.getThirdParties(enterpriseId, 0, 1000).pipe(catchError(() => of({ content: [] } as any))),
    }).pipe(
      map(({ items, accounts, thirds }) => {
        const accountMap = new Map<string, string>(
          (accounts || []).map((a: any) => [String(a.code), `${a.code} - ${a.description}`] as [string, string]),
        );
        const thirdMap = new Map<number, string>(
          (thirds?.content || []).map((t: any) => {
            const name =
              (t.socialReason as string) ||
              [t.names, t.lastNames].filter(Boolean).join(' ') ||
              `Proveedor ${t.thId}`;
            return [Number(t.thId), String(name)] as [number, string];
          }),
        );

        const lines = (items || [])
          .map((item) => {
          const totalDue =
            Number(item.current || 0) +
            Number(item.days1to30 || 0) +
            Number(item.days31to60 || 0) +
            Number(item.days61to90 || 0) +
            Number(item.days91Plus || 0);

          const accountLabel =
            accountMap.get(String(item.accountCode)) ||
            `Cuenta ${item.accountCode}`;

          return {
            id: item.invoiceId,
            supplierId: Number(item.supplierId),
            reference: item.reference,
            accountCode: String(item.accountCode),
            accountDescription: accountLabel,
            dueDate: item.dueDate,
            daysOverdue: Number(item.daysOverdue || 0),
            totalDue,
            current: Number(item.current || 0),
            days1to30: Number(item.days1to30 || 0),
            days31to60: Number(item.days31to60 || 0),
            days61to90: Number(item.days61to90 || 0),
            days91Plus: Number(item.days91Plus || 0),
          };
        })
          .filter((line) => supplierId == null || line.supplierId === supplierId);

        const totals = lines.reduce(
          (sum, line) => ({
            totalDue: sum.totalDue + line.totalDue,
            current: sum.current + line.current,
            days1to30: sum.days1to30 + line.days1to30,
            days31to60: sum.days31to60 + line.days31to60,
            days61to90: sum.days61to90 + line.days61to90,
            days91Plus: sum.days91Plus + line.days91Plus,
          }),
          { totalDue: 0, current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days91Plus: 0 },
        );

        let supplierName = 'Todos los proveedores';
        if (supplierId != null) {
          supplierName =
            thirdMap.get(supplierId) ??
            filters.supplierName ??
            `Proveedor ${supplierId}`;
        }

        return {
          reportDate: new Date(cutoff + 'T12:00:00'),
          supplierName,
          lines,
          totals,
        };
      }),
    );
  }

  /** Opciones de filtro solo desde obligaciones pendientes reales. */
  getFilterOptions(enterpriseId: string): Observable<AgingFilterOptions> {
    return forkJoin({
      payables: this.api.pending(enterpriseId),
      accounts: this.accounts.getListAuxiliaryAccounts(enterpriseId).pipe(catchError(() => of([]))),
      thirds: this.thirds.getThirdParties(enterpriseId, 0, 1000).pipe(catchError(() => of({ content: [] } as any))),
    }).pipe(
      map(({ payables, accounts, thirds }) => {
        const thirdNames = new Map<number, string>(
          (thirds?.content || []).map((t: any) => {
            const name =
              (t.socialReason as string) ||
              [t.names, t.lastNames].filter(Boolean).join(' ') ||
              `Proveedor ${t.thId}`;
            return [Number(t.thId), String(name)] as [number, string];
          }),
        );
        const accountLabels = new Map<string, string>(
          (accounts || []).map((a: any) => [String(a.code), `${a.code} - ${a.description}`] as [string, string]),
        );

        const pending = payables || [];

        const suppliers: SupplierOption[] = [...new Set(pending.map((p) => Number(p.supplierId)))]
          .map((id) => {
            const name = thirdNames.get(id) || `Proveedor ${id}`;
            return { id, value: id, name, label: `${id} — ${name}` };
          })
          .sort((a, b) => a.label.localeCompare(b.label));

        const documents: DocumentOption[] = pending
          .map((p) => {
            const supplierName = thirdNames.get(Number(p.supplierId)) || `Proveedor ${p.supplierId}`;
            return {
              label: `${p.reference} · ${supplierName}`,
              value: String(p.reference),
              supplierId: Number(p.supplierId),
              accountCode: String(p.payableAccountCode),
            };
          })
          .sort((a, b) => a.label.localeCompare(b.label));

        const accountCodes = [...new Set(pending.map((p) => String(p.payableAccountCode)))];
        const accountsOptions: AccountTypeOption[] = accountCodes
          .map((code) => ({
            value: code,
            label: accountLabels.get(code) || `Cuenta ${code}`,
          }))
          .sort((a, b) => a.label.localeCompare(b.label));

        return { suppliers, documents, accounts: accountsOptions };
      }),
    );
  }

  getAccountTypes(enterpriseId: string): Observable<AccountTypeOption[]> {
    return this.getFilterOptions(enterpriseId).pipe(map((o) => o.accounts));
  }

  getSuppliers(enterpriseId: string): Observable<SupplierOption[]> {
    return this.getFilterOptions(enterpriseId).pipe(map((o) => o.suppliers));
  }

  exportAgingReport(enterpriseId: string, filters: AgingReportFilter): Observable<Blob> {
    return this.getAgingReport(enterpriseId, filters).pipe(
      map((report) => {
        const header = [
          'Factura',
          'Proveedor',
          'Cuenta',
          'Vence',
          'Días vencidos',
          'Total',
          'Corriente',
          '1-30',
          '31-60',
          '61-90',
          '91+',
        ].join(',');
        const rows = report.lines.map((line) =>
          [
            line.reference,
            line.supplierId,
            `"${line.accountDescription}"`,
            line.dueDate,
            line.daysOverdue,
            line.totalDue,
            line.current,
            line.days1to30,
            line.days31to60,
            line.days61to90,
            line.days91Plus,
          ].join(','),
        );
        return new Blob([[header, ...rows].join('\n')], {
          type: 'text/csv;charset=utf-8;',
        });
      }),
    );
  }

  private toLocalDateString(date: Date): string {
    const d = date instanceof Date ? date : new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
