import { AsyncPipe, CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Observable, of } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { AccountingNoteResponse } from '../../Models/accounting-note.models';
import { LocalStorageMethods } from '../../../../Shared/Methods/local-storage.method';
import { AccountingNoteService } from '../../Services/accounting-note.service';
import { ManualEntryEventsService } from '../../Services/manual-entry-events.service';

@Component({
  selector: 'app-manual-entry-list',
  standalone: true,
  imports: [CommonModule, AsyncPipe, DatePipe, TableModule, ButtonModule, TagModule, RouterLink, ToastModule],
  templateUrl: './manual-entry-list.component.html',
  styleUrls: ['./manual-entry-list.component.css'],
})
export class ManualEntryListComponent implements OnInit {
  notes$!: Observable<AccountingNoteResponse[]>;

  constructor(
    private readonly noteService: AccountingNoteService,
    private readonly events: ManualEntryEventsService,
    private readonly router: Router,
    private readonly localStorage: LocalStorageMethods,
    private readonly messages: MessageService,
  ) {}

  ngOnInit(): void {
    this.load();
    this.events.refresh$.subscribe(() => this.load());
  }

  load(): void {
    const enterpriseId = this.localStorage.getIdEnterprise();
    this.notes$ = enterpriseId ? this.noteService.getAll(enterpriseId) : of([]);
  }

  edit(noteId: number): void { void this.router.navigate(['/financial/accounting-notes/edit', noteId]); }

  post(noteId: number): void {
    const enterpriseId = this.localStorage.getIdEnterprise();
    if (!enterpriseId) {
      this.messages.add({ severity: 'warn', summary: 'Empresa no seleccionada', detail: 'Selecciona una empresa para contabilizar la nota.' });
      return;
    }
    this.noteService.postDraft(noteId, enterpriseId).subscribe({
      next: () => {
        this.events.refresh();
        this.messages.add({ severity: 'success', summary: 'Nota contabilizada', detail: 'El borrador ahora forma parte de los movimientos contables.' });
      },
      error: (error) => this.messages.add({ severity: 'error', summary: 'No fue posible contabilizar', detail: error.error?.error ?? 'Verifica el estado y la empresa de la nota.' }),
    });
  }

  annulDraft(note: AccountingNoteResponse): void {
    const enterpriseId = this.localStorage.getIdEnterprise();
    if (!enterpriseId || note.status !== 'DRAFT' || note.originModule !== 'contapp-frontend') return;
    const reason = window.prompt('Motivo para descartar el borrador:');
    if (!reason?.trim()) return;
    this.noteService.annul(note.id, enterpriseId, note.originModule, reason.trim()).subscribe({
      next: () => {
        this.events.refresh();
        this.messages.add({ severity: 'success', summary: 'Borrador anulado', detail: 'Se conservó el registro en el historial.' });
      },
      error: (error) => this.messages.add({
        severity: 'error',
        summary: 'No fue posible anular',
        detail: error.error?.error ?? 'Verifica el estado y la empresa de la nota.',
      }),
    });
  }

  severity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'POSTED': return 'success';
      case 'ANNULLED': return 'danger';
      case 'DRAFT': return 'warn';
      default: return 'info';
    }
  }
}
