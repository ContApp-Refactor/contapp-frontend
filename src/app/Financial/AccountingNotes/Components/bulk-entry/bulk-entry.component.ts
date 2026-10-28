import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import * as XLSX from 'xlsx';
import { LocalStorageMethods } from '../../../../Shared/Methods/local-storage.method';
import { AccountingCatalogFacade } from '../../Services/accounting-catalog.facade';
import { AccountingNoteService } from '../../Services/accounting-note.service';
import { ManualEntryEventsService } from '../../Services/manual-entry-events.service';
import { accountingErrorMessage } from '../../Services/accounting-error-message';
import {
  AccountOption,
  AccountingNoteDetailRequest,
  CostCenterOption,
  DocumentTypeOption,
  ThirdPartyOption,
} from '../../Models/accounting-note.models';

type BulkLine = AccountingNoteDetailRequest;

@Component({
  selector: 'app-accounting-note-bulk-entry',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TableModule, ButtonModule, InputNumberModule, InputTextModule, SelectModule, ToastModule],
  templateUrl: './bulk-entry.component.html',
})
export class BulkEntryComponent implements OnInit {
  readonly maxLines = 999;
  date = this.localDate();
  concept = '';
  documentTypeCode = '';
  lines: BulkLine[] = [this.emptyLine(), this.emptyLine()];
  accounts: AccountOption[] = [];
  thirds: ThirdPartyOption[] = [];
  costCenters: CostCenterOption[] = [];
  documentTypes: DocumentTypeOption[] = [];
  loading = true;
  saving = false;
  fileName = '';

  constructor(
    private readonly catalogFacade: AccountingCatalogFacade,
    private readonly noteService: AccountingNoteService,
    private readonly localStorage: LocalStorageMethods,
    private readonly events: ManualEntryEventsService,
    private readonly messages: MessageService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    const enterpriseId = this.localStorage.getIdEnterprise();
    if (!enterpriseId) {
      this.loading = false;
      this.messages.add({ severity: 'warn', summary: 'Empresa no seleccionada', detail: 'Selecciona una empresa antes de registrar una nota.' });
      return;
    }
    this.catalogFacade.load(enterpriseId).subscribe({
      next: catalogs => {
        this.accounts = catalogs.accounts;
        this.thirds = catalogs.thirdParties;
        this.costCenters = catalogs.costCenters;
        this.documentTypes = catalogs.documentTypes;
        this.documentTypeCode = this.documentTypes[0]?.value ?? '';
        this.loading = false;
      },
      error: error => {
        this.loading = false;
        this.messages.add({
          severity: 'error',
          summary: 'No se pudieron cargar los catálogos',
          detail: accountingErrorMessage(error, 'Verifica la empresa activa y vuelve a intentarlo.'),
        });
      },
    });
  }

  get totalDebit(): number { return this.lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0); }
  get totalCredit(): number { return this.lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0); }
  get isBalanced(): boolean { return this.lines.length >= 2 && this.totalDebit > 0 && Math.abs(this.totalDebit - this.totalCredit) < 0.01; }

  addLine(): void {
    if (this.lines.length < this.maxLines) this.lines = [...this.lines, this.emptyLine()];
  }

  removeLine(index: number): void {
    if (this.lines.length > 2) this.lines = this.lines.filter((_, row) => row !== index);
  }

  async readFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const workbook = file.name.toLowerCase().endsWith('.csv')
        ? XLSX.read(await file.text(), { type: 'string' })
        : XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
      if (rows.length < 3) throw new Error('El archivo debe tener encabezados y al menos dos líneas.');
      const headers = (rows[0] as unknown[]).map(value => String(value).trim().toLowerCase());
      const aliases: Record<string, string[]> = {
        accountCode: ['accountcode', 'cuenta', 'codigocuenta', 'código cuenta'],
        thirdPartyDocument: ['thirdpartydocument', 'tercero', 'documentotercero', 'documento tercero'],
        costCenterCode: ['costcentercode', 'centrodecosto', 'centro de costo'],
        debit: ['debit', 'debito', 'débito'],
        credit: ['credit', 'credito', 'crédito'],
        description: ['description', 'descripcion', 'descripción'],
      };
      const positions = Object.fromEntries(Object.entries(aliases).map(([key, names]) =>
        [key, headers.findIndex(header => names.includes(header))]));
      if (positions['accountCode'] < 0 || positions['debit'] < 0 || positions['credit'] < 0) {
        throw new Error('Faltan columnas obligatorias: accountCode, debit o credit.');
      }
      const parsed = rows.slice(1).filter(row => (row as unknown[]).some(value => String(value).trim() !== ''))
        .map(row => {
          const cells = row as unknown[];
          return {
            accountCode: String(cells[positions['accountCode']] ?? '').trim(),
            thirdPartyDocument: this.optionalCell(cells, positions['thirdPartyDocument']),
            costCenterCode: this.optionalCell(cells, positions['costCenterCode']),
            debit: this.numberCell(cells[positions['debit']]),
            credit: this.numberCell(cells[positions['credit']]),
            description: this.optionalCell(cells, positions['description']),
          } satisfies BulkLine;
        });
      if (parsed.length < 2) throw new Error('El archivo debe tener al menos dos líneas contables.');
      if (parsed.length > this.maxLines) throw new Error(`El máximo permitido es ${this.maxLines} líneas por nota.`);
      this.lines = parsed;
      this.fileName = file.name;
      this.messages.add({ severity: 'success', summary: 'Archivo cargado', detail: parsed.length + ' líneas listas para revisar.' });
    } catch (error) {
      this.messages.add({ severity: 'error', summary: 'No se pudo leer el archivo', detail: error instanceof Error ? error.message : 'Verifica el formato y las columnas.' });
    }
    input.value = '';
  }

  downloadTemplate(): void {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['accountCode', 'thirdPartyDocument', 'costCenterCode', 'debit', 'credit', 'description'],
      ['11050501', '', '', 10000, 0, 'Ejemplo débito'],
      ['41700501', '', '', 0, 10000, 'Ejemplo crédito'],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Lineas');
    XLSX.writeFile(workbook, 'plantilla-nota-contable.xlsx');
  }

  save(): void {
    const enterpriseId = this.localStorage.getIdEnterprise();
    if (!enterpriseId || !this.concept.trim() || !this.date || !this.documentTypeCode) {
      this.messages.add({ severity: 'warn', summary: 'Completa los datos del encabezado', detail: 'Fecha, tipo de documento y concepto son obligatorios.' });
      return;
    }
    if (this.lines.length < 2 || this.lines.length > this.maxLines || this.lines.some(line => !line.accountCode || line.debit < 0 || line.credit < 0 || ((line.debit > 0) === (line.credit > 0)))) {
      this.messages.add({ severity: 'warn', summary: 'Revisa las líneas', detail: 'Cada línea debe tener cuenta y exactamente un valor positivo en débito o crédito.' });
      return;
    }
    const missingRequiredCatalog = this.lines.some(line => {
      const account = this.accounts.find(item => item.code === line.accountCode);
      return !account
        || (account.requiresCostCenter && !line.costCenterCode)
        || (account.requiresThirdParty && !line.thirdPartyDocument);
    });
    if (missingRequiredCatalog) {
      this.messages.add({ severity: 'warn', summary: 'Completa los datos de las cuentas', detail: 'Verifica que cada cuenta exista y que incluya tercero o centro de costo cuando su configuración lo exige.' });
      return;
    }
    if (!this.isBalanced) {
      this.messages.add({ severity: 'warn', summary: 'Nota descuadrada', detail: 'La suma de débitos debe ser igual a la de créditos.' });
      return;
    }
    this.saving = true;
    this.noteService.create({
      documentTypeCode: this.documentTypeCode,
      concept: this.concept.trim(),
      date: this.date,
      enterpriseId,
      originModule: 'contapp-frontend',
      originId: crypto.randomUUID(),
      details: this.lines,
    }).subscribe({
      next: note => {
        this.saving = false;
        this.events.refresh();
        this.messages.add({ severity: 'success', summary: 'Nota creada', detail: 'Se creó el borrador ' + note.number + '.' });
        void this.router.navigate(['/financial/accounting-notes/list']);
      },
      error: error => {
        this.saving = false;
        this.messages.add({
          severity: 'error',
          summary: 'No se pudo crear la nota',
          detail: accountingErrorMessage(error, 'Revisa el encabezado, las líneas y los catálogos e inténtalo de nuevo.'),
        });
      },
    });
  }

  private emptyLine(): BulkLine {
    return { accountCode: '', thirdPartyDocument: null, costCenterCode: null, description: null, debit: 0, credit: 0 };
  }

  private localDate(): string {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 10);
  }

  private optionalCell(cells: unknown[], index: number): string | null {
    return index < 0 || cells[index] == null || String(cells[index]).trim() === '' ? null : String(cells[index]).trim();
  }

  private numberCell(value: unknown): number {
    if (typeof value === 'number') return value;
    const parsed = Number(String(value ?? '').replace(/[$,\s]/g, ''));
    if (!Number.isFinite(parsed)) throw new Error('Valor monetario inválido: ' + String(value) + '.');
    return parsed;
  }
}
