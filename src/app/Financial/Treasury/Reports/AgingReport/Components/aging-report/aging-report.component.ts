import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { CardModule } from 'primeng/card';
import { ToastModule } from 'primeng/toast';
import { InputSwitchModule } from 'primeng/inputswitch';
import { MessageService } from 'primeng/api';

import { AgingReportService } from '../../Services/aging-report.service';
import {
  AgingReportFilter,
  AgingReportResponse,
  SupplierOption,
} from '../../Models/AgingReport';
import { LocalStorageMethods } from '../../../../../../Shared/Methods/local-storage.method';
import { TreasuryExportService } from '../../../../Shared/treasury-export.service';
import {
  exportErrorDetail,
  exportSuccessDetail,
  reportEmptyFiltersMessage,
} from '../../../../Shared/treasury-status-labels';
import { ContextualHelpComponent } from '../../../../../../Shared/Components/contextual-help/contextual-help.component';
import { TREASURY_HELP } from '../../../../Shared/treasury-help-content';
import { resolveSupplierFilterId } from '../../../../Shared/treasury-third-party.integration';

@Component({
  selector: 'app-aging-report',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TableModule,
    ButtonModule,
    CalendarModule,
    DropdownModule,
    CardModule,
    ToastModule,
    InputSwitchModule,
    ContextualHelpComponent,
  ],
  templateUrl: './aging-report.component.html',
  styleUrls: ['./aging-report.component.css'],
  providers: [MessageService],
})
export class AgingReportComponent implements OnInit {
  localStorageMethods = new LocalStorageMethods();

  filterForm!: FormGroup;
  reportData: AgingReportResponse | null = null;
  supplierOptions: SupplierOption[] = [];
  loading = false;
  exportingPdf = false;
  exportingCsv = false;
  readonly emptyFiltersMessage = reportEmptyFiltersMessage();
  readonly help = TREASURY_HELP.agingReport;

  constructor(
    private fb: FormBuilder,
    private agingReportService: AgingReportService,
    private messageService: MessageService,
    private exportService: TreasuryExportService,
  ) {}

  ngOnInit(): void {
    this.initializeFilterForm();
    this.loadFilterOptions();
  }

  initializeFilterForm(): void {
    this.filterForm = this.fb.group({
      supplierId: [null],
      cutoffDate: [new Date(), Validators.required],
      includeDocuments: [true],
    });
  }

  loadFilterOptions(): void {
    const enterpriseId = this.localStorageMethods.getIdEnterprise();
    if (!enterpriseId) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Empresa requerida',
        detail: 'Seleccione una empresa activa para generar el reporte.',
      });
      return;
    }

    this.agingReportService.getFilterOptions(enterpriseId).subscribe({
      next: (options) => {
        this.supplierOptions = options.suppliers;
        this.onGenerateReport();
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los filtros del reporte.',
        });
      },
    });
  }

  onGenerateReport(): void {
    const enterpriseId = this.localStorageMethods.getIdEnterprise();
    if (!enterpriseId) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Empresa requerida',
        detail: 'Seleccione una empresa activa.',
      });
      return;
    }

    if (this.filterForm.invalid) {
      this.filterForm.markAllAsTouched();
      this.messageService.add({
        severity: 'warn',
        summary: 'Filtros incompletos',
        detail: 'La fecha de corte es obligatoria.',
      });
      return;
    }

    this.loading = true;
    const supplierId = resolveSupplierFilterId(this.filterForm.value.supplierId);
    const supplier = this.supplierOptions.find((s) => s.value === supplierId);

    const filters: AgingReportFilter = {
      supplierId,
      supplierName: supplier?.name,
      cutoffDate: this.filterForm.value.cutoffDate,
      includeDocuments: this.filterForm.value.includeDocuments,
    };

    this.agingReportService.getAgingReport(enterpriseId, filters).subscribe({
      next: (report) => {
        this.reportData = report;
        this.loading = false;
        this.messageService.add({
          severity: report.lines.length ? 'success' : 'info',
          summary: report.lines.length ? 'Reporte generado' : 'Sin resultados',
          detail: report.lines.length
            ? `Se encontraron ${report.lines.length} obligación(es) pendientes.`
            : this.emptyFiltersMessage,
        });
      },
      error: (error) => {
        console.error('Error al generar reporte:', error);
        this.loading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error?.error?.message || 'No se pudo generar el reporte.',
        });
      },
    });
  }

  clearFilters(): void {
    this.filterForm.reset({
      supplierId: null,
      cutoffDate: new Date(),
      includeDocuments: true,
    });
    this.onGenerateReport();
  }

  exportToCsv(): void {
    this.runExport('csv');
  }

  exportToPdf(): void {
    this.runExport('pdf');
  }

  private runExport(format: 'csv' | 'pdf'): void {
    if (!this.reportData?.lines?.length) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Genere un reporte',
        detail: 'Primero genere el reporte antes de exportarlo.',
      });
      return;
    }

    const headers = [
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
    ];
    const rows = this.reportData.lines.map((line) => [
      line.reference,
      this.supplierName(line.supplierId),
      line.accountDescription,
      this.formatDate(line.dueDate),
      line.daysOverdue,
      line.totalDue,
      line.current,
      line.days1to30,
      line.days31to60,
      line.days61to90,
      line.days91Plus,
    ]);
    const subtitle = `Corte: ${this.formatDate(this.reportData.reportDate)} · ${this.reportData.supplierName}`;
    const filename = this.exportService.datedFilename('vencimiento-edades', format);
    const options = {
      title: 'Vencimiento por edades',
      subtitle,
      filename,
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
        detail: exportSuccessDetail('antigüedad de saldos', format),
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

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  }

  formatDate(date: Date | string): string {
    return new Intl.DateTimeFormat('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(date));
  }

  supplierName(supplierId: number): string {
    return this.supplierOptions.find((s) => s.value === Number(supplierId))?.name
      || `Proveedor ${supplierId}`;
  }
}
