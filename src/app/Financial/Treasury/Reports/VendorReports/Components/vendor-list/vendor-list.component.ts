import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { CardModule } from 'primeng/card';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { MessageService } from 'primeng/api';

import { VendorReportService, VendorSupplierOption } from '../../Services/vendor-report.service';
import { VendorReportSummary, VendorListFilter } from '../../Models/VendorReport';
import { TreasuryExportService } from '../../../../Shared/treasury-export.service';
import { exportErrorDetail, exportSuccessDetail, reportEmptyFiltersMessage } from '../../../../Shared/treasury-status-labels';
import { ContextualHelpComponent } from '../../../../../../Shared/Components/contextual-help/contextual-help.component';
import { TREASURY_HELP } from '../../../../Shared/treasury-help-content';

@Component({
  selector: 'app-vendor-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TableModule,
    ButtonModule,
    CalendarModule,
    CardModule,
    ToastModule,
    TagModule,
    TooltipModule,
    AutoCompleteModule,
    ContextualHelpComponent,
  ],
  templateUrl: './vendor-list.component.html',
  styleUrls: ['./vendor-list.component.css'],
  providers: [MessageService],
})
export class VendorListComponent implements OnInit, OnDestroy {
  private static readonly SUPPLIER_SEARCH_DEBOUNCE_MS = 300;
  private readonly destroy$ = new Subject<void>();
  private supplierSearchTimer?: ReturnType<typeof setTimeout>;

  vendors: VendorReportSummary[] = [];
  filteredVendors: VendorReportSummary[] = [];
  loading = false;
  filterForm!: FormGroup;
  exportingPdf = false;
  exportingCsv = false;
  vendorTableFirst = 0;

  allSuppliers: VendorSupplierOption[] = [];
  filteredSuppliers: VendorSupplierOption[] = [];
  supplierSelection: VendorSupplierOption | null = null;

  readonly help = TREASURY_HELP.vendorReports;

  constructor(
    private readonly fb: FormBuilder,
    private readonly vendorReportService: VendorReportService,
    private readonly messageService: MessageService,
    private readonly router: Router,
    private readonly exportService: TreasuryExportService,
  ) {}

  ngOnInit(): void {
    this.initializeFilterForm();
    this.setupReactiveFilters();
    this.loadSupplierOptions();
    this.loadVendors();
  }

  ngOnDestroy(): void {
    if (this.supplierSearchTimer) {
      clearTimeout(this.supplierSearchTimer);
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  initializeFilterForm(): void {
    this.filterForm = this.fb.group({
      dateFrom: [null],
      dateTo: [null],
    });
  }

  setupReactiveFilters(): void {
    this.filterForm.get('dateFrom')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.onDateFilterChange());
    this.filterForm.get('dateTo')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.onDateFilterChange());
  }

  loadSupplierOptions(): void {
    this.vendorReportService.getProveedores().subscribe({
      next: (suppliers) => {
        this.allSuppliers = suppliers;
        this.filteredSuppliers = suppliers.slice(0, 50);
      },
      error: (error) => {
        console.error('Error al cargar proveedores:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los proveedores de la empresa',
        });
      },
    });
  }

  searchSupplier(event: { query?: string }): void {
    const query = String(event.query ?? '').trim().toLowerCase();
    if (this.supplierSearchTimer) {
      clearTimeout(this.supplierSearchTimer);
    }
    this.supplierSearchTimer = setTimeout(() => {
      this.filteredSuppliers = !query
        ? this.allSuppliers.slice(0, 50)
        : this.allSuppliers.filter((supplier) =>
            supplier.displayName.toLowerCase().startsWith(query),
          );
    }, VendorListComponent.SUPPLIER_SEARCH_DEBOUNCE_MS);
  }

  onSupplierFilterChange(): void {
    this.resetVendorTablePage();
    this.loadVendors();
  }

  onDateFilterChange(): void {
    const { dateFrom, dateTo } = this.filterForm.value;
    if (dateFrom && dateTo && this.stripTime(dateFrom) > this.stripTime(dateTo)) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Rango inválido',
        detail: 'La fecha Desde no puede ser posterior a la fecha Hasta.',
      });
      return;
    }
    this.resetVendorTablePage();
    this.loadVendors();
  }

  loadVendors(): void {
    const { dateFrom, dateTo } = this.filterForm.value;
    if (dateFrom && dateTo && this.stripTime(dateFrom) > this.stripTime(dateTo)) {
      return;
    }

    this.loading = true;
    const filter: VendorListFilter = {
      supplierId: this.supplierSelection ? Number(this.supplierSelection.thId) : undefined,
      dateFrom,
      dateTo,
    };

    this.vendorReportService.getVendorSummaries(filter).subscribe({
      next: (data) => {
        this.vendors = data;
        this.filteredVendors = data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar proveedores:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los reportes de proveedores',
        });
        this.loading = false;
      },
    });
  }

  clearFilters(): void {
    this.supplierSelection = null;
    this.filteredSuppliers = this.allSuppliers.slice(0, 50);
    this.filterForm.reset({
      dateFrom: null,
      dateTo: null,
    });
    this.resetVendorTablePage();
    this.loadVendors();
  }

  onVendorTablePage(event: { first?: number }): void {
    this.vendorTableFirst = event.first ?? 0;
  }

  private resetVendorTablePage(): void {
    this.vendorTableFirst = 0;
  }

  private stripTime(value: Date): Date {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  viewVendorReport(vendor: VendorReportSummary): void {
    this.router.navigate(['/financial/treasury/reports/vendor-report', vendor.id], {
      queryParams: {
        name: vendor.name,
      },
    });
  }

  getBalanceTagSeverity(balance: number): 'success' | 'warning' | 'danger' | 'info' {
    if (balance === 0) return 'info';
    if (balance > 0) return 'warning';
    return 'success';
  }

  getBalanceTagText(balance: number): string {
    if (balance === 0) return 'Sin saldo';
    if (balance > 0) return 'Pendiente';
    return 'A favor';
  }

  getTotalWithBalance(): number {
    return this.filteredVendors.filter((v) => v.currentBalance > 0).length;
  }

  getTotalWithoutBalance(): number {
    return this.filteredVendors.filter((v) => v.currentBalance === 0).length;
  }

  getTotalBalance(): number {
    return this.filteredVendors.reduce((sum, vendor) => sum + vendor.currentBalance, 0);
  }

  hasActiveFilters(): boolean {
    const filter = this.filterForm.value;
    return !!(
      this.supplierSelection
      || filter.dateFrom
      || filter.dateTo
    );
  }

  getEmptyTitle(): string {
    if (this.vendors.length === 0) {
      return 'No hay proveedores registrados';
    }
    if (this.hasActiveFilters()) {
      return 'No se encontraron proveedores que coincidan con la búsqueda';
    }
    return 'No hay proveedores registrados';
  }

  getEmptySubtitle(): string {
    return this.hasActiveFilters() ? 'Intente ajustar los filtros de búsqueda' : '';
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(date));
  }

  exportToCsv(): void {
    this.runExport('csv');
  }

  exportToPdf(): void {
    this.runExport('pdf');
  }

  private runExport(format: 'csv' | 'pdf'): void {
    if (!this.filteredVendors.length) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sin datos',
        detail: reportEmptyFiltersMessage(),
      });
      return;
    }

    const headers = [
      'Proveedor',
      'Transacciones',
      'Débitos',
      'Créditos',
      'Saldo',
      'Última transacción',
      'Estado',
    ];
    const rows = this.filteredVendors.map((vendor) => [
      vendor.name,
      vendor.transactionCount,
      vendor.totalDebits,
      vendor.totalCredits,
      vendor.currentBalance,
      this.formatDate(vendor.lastTransactionDate),
      this.getBalanceTagText(vendor.currentBalance),
    ]);
    const options = {
      title: 'Reportes de proveedores',
      subtitle: `${rows.length} proveedor(es) exportado(s)`,
      filename: this.exportService.datedFilename('reportes-proveedores', format),
      headers,
      rows,
      orientation: 'landscape' as const,
    };

    const loadingFlag = format === 'csv' ? 'exportingCsv' : 'exportingPdf';
    this[loadingFlag] = true;
    try {
      if (format === 'csv') {
        this.exportService.downloadCsv(options);
      } else {
        this.exportService.downloadPdf(options);
      }
      this.messageService.add({
        severity: 'success',
        summary: 'Exportado',
        detail: exportSuccessDetail('proveedores', format),
      });
    } catch (error) {
      console.error(`Error al exportar ${format}:`, error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: exportErrorDetail(format),
      });
    } finally {
      this[loadingFlag] = false;
    }
  }
}
