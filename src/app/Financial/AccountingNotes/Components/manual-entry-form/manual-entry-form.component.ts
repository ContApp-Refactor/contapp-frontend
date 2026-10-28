import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { LocalStorageMethods } from '../../../../Shared/Methods/local-storage.method';
import { AccountingNoteService } from '../../Services/accounting-note.service';
import { ManualEntryEventsService } from '../../Services/manual-entry-events.service';
import { AccountingCatalogFacade } from '../../Services/accounting-catalog.facade';
import { accountingErrorMessage } from '../../Services/accounting-error-message';
import {
  AccountOption,
  AccountingNoteRequest,
  CostCenterOption,
  DocumentTypeOption,
  ThirdPartyOption,
} from '../../Models/accounting-note.models';

@Component({
  selector: 'app-manual-entry-form',
  standalone: true,
  imports: [
    CommonModule, RouterLink, ReactiveFormsModule, DatePickerModule, InputNumberModule,
    InputTextModule, SelectModule, ButtonModule, ToastModule,
  ],
  templateUrl: './manual-entry-form.component.html',
  styleUrls: ['./manual-entry-form.component.css'],
})
export class ManualEntryFormComponent implements OnInit {
  readonly form: FormGroup;

  documentTypes: DocumentTypeOption[] = [];
  accounts: AccountOption[] = [];
  thirdParties: ThirdPartyOption[] = [];
  costCenters: CostCenterOption[] = [];

  saving = false;
  loadingCatalogs = false;
  editingNoteId: number | null = null;
  private originalNote: import('../../Models/accounting-note.models').AccountingNoteResponse | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly noteService: AccountingNoteService,
    private readonly events: ManualEntryEventsService,
    private readonly localStorage: LocalStorageMethods,
    private readonly catalogFacade: AccountingCatalogFacade,
    private readonly messages: MessageService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {
    this.form = this.fb.group({
      date: [new Date(), Validators.required],
      documentTypeCode: ['NC', Validators.required],
      concept: ['', [Validators.required, Validators.maxLength(255)]],
      details: this.fb.array([this.createDetail(), this.createDetail()]),
    });
  }

  ngOnInit(): void {
    const routeId = this.route.snapshot.paramMap.get('id');
    this.editingNoteId = routeId ? Number(routeId) : null;
    const enterpriseId = this.localStorage.getIdEnterprise();
    if (!enterpriseId) {
      this.messages.add({
        severity: 'warn',
        summary: 'Empresa no seleccionada',
        detail: 'Selecciona una empresa antes de registrar una nota.',
      });
      return;
    }

    this.loadingCatalogs = true;
    this.catalogFacade.load(enterpriseId).subscribe({
      next: ({ accounts, thirdParties, costCenters, documentTypes }) => {
        this.accounts = accounts;
        this.thirdParties = thirdParties;
        this.costCenters = costCenters;
        this.documentTypes = documentTypes;
        this.loadingCatalogs = false;

        const selectedDocumentType = this.form.value.documentTypeCode;
        if (this.documentTypes.length > 0
            && !this.documentTypes.some(type => type.value === selectedDocumentType)) {
          this.form.patchValue({ documentTypeCode: this.documentTypes[0].value });
        }
        if (this.editingNoteId !== null && Number.isFinite(this.editingNoteId)) {
          this.loadDraft(this.editingNoteId);
        }
      },
      error: (error) => {
        this.loadingCatalogs = false;
        this.messages.add({
          severity: 'error',
          summary: 'No se pudieron cargar los catálogos',
          detail: accountingErrorMessage(error, 'Verifica la empresa activa y vuelve a intentarlo.'),
        });
      },
    });
  }

  get details(): FormArray { return this.form.get('details') as FormArray; }

  get totalDebit(): number { return this.details.controls.reduce((t, c) => t + (Number(c.get('debit')?.value) || 0), 0); }
  get totalCredit(): number { return this.details.controls.reduce((t, c) => t + (Number(c.get('credit')?.value) || 0), 0); }
  get difference(): number { return Math.abs(this.totalDebit - this.totalCredit); }
  get balanced(): boolean { return this.totalDebit > 0 && this.difference < 0.01; }

  createDetail(): FormGroup {
    const detail = this.fb.group({
      account: [null, Validators.required],
      thirdParty: [null],
      costCenter: [null],
      debit: [0, [Validators.required, Validators.min(0)]],
      credit: [0, [Validators.required, Validators.min(0)]],
      description: ['', Validators.maxLength(255)],
    });
    detail.get('account')?.valueChanges.subscribe((account: AccountOption | null) => {
      const costCenter = detail.get('costCenter');
      const thirdParty = detail.get('thirdParty');
      if (account?.requiresCostCenter) costCenter?.setValidators(Validators.required);
      else costCenter?.clearValidators();
      if (account?.requiresThirdParty) thirdParty?.setValidators(Validators.required);
      else thirdParty?.clearValidators();
      costCenter?.updateValueAndValidity();
      thirdParty?.updateValueAndValidity();
    });
    return detail;
  }

  addDetail(): void { this.details.push(this.createDetail()); }

  removeDetail(index: number): void {
    if (this.details.length <= 2) {
      this.messages.add({ severity: 'info', summary: 'Registro contable', detail: 'Una nota requiere al menos dos líneas.' });
      return;
    }
    this.details.removeAt(index);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.messages.add({ severity: 'warn', summary: 'Datos incompletos', detail: 'Completa los campos obligatorios.' });
      return;
    }
    if (!this.balanced) {
      this.messages.add({ severity: 'error', summary: 'Partida doble descuadrada', detail: `Diferencia: ${this.difference.toLocaleString('es-CO')}` });
      return;
    }
    const invalidLine = this.details.controls.some((control) => {
      const debit = Number(control.get('debit')?.value || 0);
      const credit = Number(control.get('credit')?.value || 0);
      return (debit > 0 && credit > 0) || (debit === 0 && credit === 0);
    });
    if (invalidLine) {
      this.messages.add({ severity: 'error', summary: 'Línea inválida', detail: 'Cada línea debe tener débito o crédito, pero no ambos.' });
      return;
    }

    const request: AccountingNoteRequest = {
      documentTypeCode: this.form.value.documentTypeCode,
      concept: this.form.value.concept,
      date: this.formatDate(this.form.value.date),
      enterpriseId: this.localStorage.getIdEnterprise(),
      originModule: this.originalNote?.originModule ?? 'contapp-frontend',
      originId: this.originalNote?.originId ?? crypto.randomUUID(),
      details: this.details.controls.map((control) => ({
        accountCode: control.value.account.code,
        thirdPartyDocument: control.value.thirdParty?.identification ?? null,
        costCenterCode: control.value.costCenter?.code ?? null,
        description: control.value.description || null,
        debit: Number(control.value.debit || 0),
        credit: Number(control.value.credit || 0),
      })),
    };

    this.saving = true;
    const saveRequest = this.editingNoteId === null
      ? this.noteService.create(request)
      : this.noteService.updateDraft(this.editingNoteId, request);
    saveRequest.subscribe({
      next: (response) => {
        this.saving = false;
        this.messages.add({ severity: 'success', summary: this.editingNoteId === null ? 'Borrador creado' : 'Borrador actualizado', detail: `Número: ${response.number}` });
        this.events.refresh();
        void this.router.navigate(['/financial/accounting-notes/list']);
      },
      error: (error) => {
        this.saving = false;
        this.messages.add({
          severity: 'error',
          summary: this.editingNoteId === null ? 'No fue posible crear la nota' : 'No fue posible actualizar el borrador',
          detail: accountingErrorMessage(error, 'Revisa los datos de la nota e inténtalo de nuevo.'),
        });
      },
    });
  }

  private loadDraft(id: number): void {
    const enterpriseId = this.localStorage.getIdEnterprise();
    if (!enterpriseId) {
      this.messages.add({ severity: 'warn', summary: 'Empresa no seleccionada', detail: 'Selecciona una empresa antes de editar una nota.' });
      void this.router.navigate(['/financial/accounting-notes/list']);
      return;
    }
    this.noteService.getById(id, enterpriseId).subscribe({
      next: (note) => {
        if (note.status !== 'DRAFT' || note.originModule !== 'contapp-frontend') {
          this.messages.add({ severity: 'warn', summary: 'Nota no editable', detail: 'Solo puedes modificar borradores manuales.' });
          void this.router.navigate(['/financial/accounting-notes/list']);
          return;
        }
        if (note.enterpriseId !== this.localStorage.getIdEnterprise()) {
          this.messages.add({ severity: 'error', summary: 'Empresa diferente', detail: 'La nota no pertenece a la empresa activa.' });
          void this.router.navigate(['/financial/accounting-notes/list']);
          return;
        }
        this.originalNote = note;
        this.form.patchValue({
          date: this.parseLocalDate(note.date),
          documentTypeCode: note.documentTypeCode,
          concept: note.concept,
        });
        this.details.clear();
        note.details.forEach((line) => {
          const account = this.accounts.find((item) => item.code === line.accountCode) ?? null;
          const thirdParty = this.thirdParties.find((item) => item.identification === line.thirdPartyDocument) ?? null;
          const costCenter = this.costCenters.find((item) => item.code === line.costCenterCode) ?? null;
          const detail = this.createDetail();
          detail.patchValue({ account, thirdParty, costCenter, debit: Number(line.debit), credit: Number(line.credit), description: line.description ?? '' });
          this.details.push(detail);
        });
      },
      error: (error) => {
        this.messages.add({
          severity: 'error',
          summary: 'No se pudo cargar el borrador',
          detail: accountingErrorMessage(error, 'Verifica que el borrador pertenezca a la empresa activa.'),
        });
        void this.router.navigate(['/financial/accounting-notes/list']);
      },
    });
  }

  private parseLocalDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private reset(): void {
    this.form.reset({ date: new Date(), documentTypeCode: 'NC', concept: '' });
    this.details.clear();
    this.details.push(this.createDetail());
    this.details.push(this.createDetail());
  }

  private formatDate(value: Date | string): string {
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
