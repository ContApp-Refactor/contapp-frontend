import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Router } from '@angular/router';
import { EnterpriseService } from '../services/enterprise.service';
import { CopyProcess } from '../models/CopyProcess';

@Component({
  selector: 'app-copy-process-list',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    DialogModule,
    ToastModule,
    InputTextModule,
    ProgressSpinnerModule,
    FormsModule,
  ],
  providers: [MessageService],
  templateUrl: './copy-process-list.component.html',
  styleUrls: ['./copy-process-list.component.css'],
})
export class CopyProcessListComponent implements OnInit {

  processes: CopyProcess[] = [];
  loading = false;

  // --- Diálogo principal de restore ---
  restoreDialogVisible = false;
  selectedProcess: CopyProcess | null = null;
  empresaDestinoInput = '';
  restoreMode: 'nueva' | 'inplace' | null = null;

  // --- Diálogo de advertencia inplace ---
  inplaceWarningVisible = false;

  // --- Loading durante restore ---
  restoreInProgress = false;

  // --- Diálogo de eliminación ---
  showDeleteProcessModal = false;
  processToDelete: CopyProcess | null = null;

  readonly TERMINAL_STATES = ['COMPLETADO', 'ERROR', 'CANCELADO'];

  constructor(
    private enterpriseService: EnterpriseService,
    private messageService: MessageService,
    private router: Router,
  ) {}

  goBack(): void {
    this.router.navigate(['/enterprise/list']);
  }

  viewDetail(process: CopyProcess): void {
    this.router.navigate(['/enterprise/copy-processes', process.idProceso]);
  }

  ngOnInit(): void {
    this.loadProcesses();
  }

  loadProcesses(): void {
    this.loading = true;
    this.enterpriseService.getCopyProcesses().subscribe({
      next: (data) => {
        this.processes = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los procesos de copia',
        });
      },
    });
  }

  downloadBackup(process: CopyProcess): void {
    this.enterpriseService.downloadCopyProcessBackup(process.idProceso).subscribe({
      next: (response) => {
        const blob = response.body as Blob;
        const cd = response.headers.get('Content-Disposition');
        let filename = `backup_${process.idProceso}.zip`;
        if (cd) {
          const match = cd.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
          if (match?.[1]) filename = match[1].replace(/['"]/g, '').trim();
        }
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo descargar el backup',
        });
      },
    });
  }

  openRestoreDialog(process: CopyProcess): void {
    this.selectedProcess = process;
    this.empresaDestinoInput = '';
    this.restoreMode = null;
    this.inplaceWarningVisible = false;
    this.restoreDialogVisible = true;
  }

  selectRestoreMode(mode: 'nueva' | 'inplace'): void {
    this.restoreMode = mode;
    if (mode === 'inplace') {
      // Mostrar advertencia antes de confirmar
      this.restoreDialogVisible = false;
      this.inplaceWarningVisible = true;
    }
  }

  cancelInplaceWarning(): void {
    this.inplaceWarningVisible = false;
    this.restoreDialogVisible = true;
    this.restoreMode = null;
  }

  confirmInplaceRestore(): void {
    if (!this.selectedProcess?.backupRef || !this.selectedProcess.empresaOrigen) return;

    this.inplaceWarningVisible = false;
    this.restoreInProgress = true;

    this.enterpriseService
      .restoreFromBackup(
        this.selectedProcess.backupRef,
        this.selectedProcess.empresaOrigen,
        true,
      )
      .subscribe({
        next: () => {
          this.restoreInProgress = false;
          this.messageService.add({
            severity: 'success',
            summary: 'Restauración inplace iniciada',
            detail: 'La empresa está siendo restaurada sobre sí misma. Revisá los procesos para ver el estado.',
          });
          this.loadProcesses();
        },
        error: (err) => {
          this.restoreInProgress = false;
          const status = err?.status;
          let detail = 'No se pudo iniciar la restauración';
          if (status === 409) detail = 'No se pudo eliminar la empresa actual. Intentá de nuevo.';
          if (status === 422) detail = 'El backup no contiene datos de empresa válidos';
          if (status === 404) detail = 'Backup no encontrado';
          this.messageService.add({ severity: 'error', summary: 'Error', detail });
        },
      });
  }

  confirmRestore(): void {
    if (!this.selectedProcess || !this.empresaDestinoInput.trim()) return;

    this.enterpriseService
      .restoreFromBackup(this.selectedProcess.backupRef!, this.empresaDestinoInput.trim(), false)
      .subscribe({
        next: () => {
          this.restoreDialogVisible = false;
          this.messageService.add({
            severity: 'success',
            summary: 'Restauración iniciada',
            detail: 'El proceso de restauración fue iniciado correctamente',
          });
          this.loadProcesses();
        },
        error: (err) => {
          const status = err?.status;
          let detail = 'No se pudo iniciar la restauración';
          if (status === 404) detail = 'Backup no encontrado';
          if (status === 422) detail = 'El backup está corrupto o es inválido';
          if (status === 400) detail = 'Datos de restauración inválidos';
          this.messageService.add({ severity: 'error', summary: 'Error', detail });
        },
      });
  }

  cancelRestore(): void {
    this.restoreDialogVisible = false;
    this.selectedProcess = null;
    this.empresaDestinoInput = '';
    this.restoreMode = null;
  }

  /* ==================== ELIMINAR PROCESO ==================== */
  openDeleteProcessDialog(process: CopyProcess): void {
    this.processToDelete = process;
    this.showDeleteProcessModal = true;
  }

  cancelDeleteProcess(): void {
    this.processToDelete = null;
    this.showDeleteProcessModal = false;
  }

  confirmDeleteProcess(): void {
    if (!this.processToDelete) return;

    this.enterpriseService.deleteCopyProcess(this.processToDelete.idProceso).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Eliminado',
          detail: `Proceso eliminado correctamente.`,
        });
        this.showDeleteProcessModal = false;
        this.processToDelete = null;
        this.loadProcesses();
      },
      error: (err) => {
        const detail = err?.status === 409
          ? 'No se puede eliminar un proceso que no está en estado terminal'
          : 'No se pudo eliminar el proceso';
        this.messageService.add({ severity: 'error', summary: 'Error', detail });
      },
    });
  }
}
