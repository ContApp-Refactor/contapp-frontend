import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DropdownModule } from 'primeng/dropdown';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Router } from '@angular/router';
import { EnterpriseService } from '../services/enterprise.service';
import { CopyProcess } from '../models/CopyProcess';
import { EnterpriseList } from '../models/EnterpriseList';
import { isV2Process, parseCopyError } from '../utils/copy-process.utils';

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
    DropdownModule,
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
  nitDestinoInput = '';
  skipUnknownModules = false;
  /** Mensaje del back si el NIT destino ya existe (409). */
  restoreNitConflict = '';
  /** Mensaje del back si el ZIP trae módulos no soportados (422). */
  unsupportedModuleMessage = '';

  // --- Restaurar sobre una empresa existente (inplace) ---
  enterprises: EnterpriseList[] = [];
  enterpriseForInplace: EnterpriseList | null = null;
  /** Confirmación explícita (checkbox) del borrado de datos. */
  inplaceConfirmed = false;
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
    this.nitDestinoInput = '';
    this.skipUnknownModules = false;
    this.restoreNitConflict = '';
    this.unsupportedModuleMessage = '';
    this.restoreMode = null;
    this.enterpriseForInplace = null;
    this.inplaceConfirmed = false;
    this.inplaceWarningVisible = false;
    this.restoreDialogVisible = true;
  }

  selectRestoreMode(mode: 'nueva' | 'inplace'): void {
    this.restoreMode = mode;
    if (mode === 'inplace') {
      this.loadEnterprises();
    }
  }

  /** Empresas activas del usuario: posibles destinos de "Restaurar sobre una empresa existente". */
  private loadEnterprises(): void {
    if (this.enterprises.length > 0) {
      this.preselectInplaceTarget();
      return;
    }
    this.enterpriseService.getEnterprisesActive('Profesor').subscribe({
      next: (data) => {
        this.enterprises = data ?? [];
        this.preselectInplaceTarget();
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar las empresas',
        });
      },
    });
  }

  /** Si la empresa de origen del backup sigue existiendo, se propone como destino. */
  private preselectInplaceTarget(): void {
    if (this.enterpriseForInplace) return;
    const origen = this.selectedProcess?.empresaOrigen;
    this.enterpriseForInplace =
      this.enterprises.find((e) => String(e.id) === String(origen)) ?? null;
  }

  /** Muestra la advertencia de borrado antes de restaurar sobre una empresa existente. */
  startInplaceRestore(): void {
    if (!this.enterpriseForInplace) return;
    this.inplaceConfirmed = false;
    // El diálogo principal queda abierto debajo (su onHide limpia la selección).
    this.inplaceWarningVisible = true;
  }

  cancelInplaceWarning(): void {
    this.inplaceWarningVisible = false;
    this.inplaceConfirmed = false;
  }

  confirmInplaceRestore(): void {
    // Sin la confirmación explícita no se borra nada.
    if (!this.inplaceConfirmed) return;
    if (!this.selectedProcess?.backupRef || !this.enterpriseForInplace?.id) return;

    const backupRef = this.selectedProcess.backupRef;
    const empresaDestino = String(this.enterpriseForInplace.id);
    this.inplaceWarningVisible = false;
    this.restoreInProgress = true;

    this.enterpriseService
      .restoreFromBackup(backupRef, empresaDestino, true, { skipUnknownModules: this.skipUnknownModules })
      .subscribe({
        next: () => {
          this.restoreInProgress = false;
          this.restoreDialogVisible = false;
          this.messageService.add({
            severity: 'success',
            summary: 'Restauración iniciada',
            detail:
              'La empresa existente está siendo restaurada con los datos de la copia. Revisá los procesos para ver el estado.',
          });
          this.loadProcesses();
        },
        error: (err) => {
          this.restoreInProgress = false;
          const status = err?.status;
          let fallback = 'No se pudo iniciar la restauración';
          if (status === 409) fallback = 'No se pudo restaurar sobre la empresa. Intentá de nuevo.';
          if (status === 422) fallback = 'El backup no se puede restaurar sobre una empresa existente';
          if (status === 404) fallback = 'Backup o empresa no encontrados';
          // El mensaje del back (p. ej. 422 de módulo sin soporte de purga) se muestra tal cual.
          const detail = parseCopyError(err, fallback).message;
          this.messageService.add({ severity: 'error', summary: 'Error', detail, life: 8000 });
        },
      });
  }

  /** Botón "Restaurar" del diálogo principal según el modo elegido. */
  restoreSelected(): void {
    if (this.restoreMode === 'inplace') {
      this.startInplaceRestore();
    } else {
      this.confirmRestore();
    }
  }

  canRestore(): boolean {
    if (this.restoreMode === 'nueva') return !!this.empresaDestinoInput.trim();
    if (this.restoreMode === 'inplace') return !!this.enterpriseForInplace;
    return false;
  }

  confirmRestore(): void {
    if (!this.selectedProcess || !this.empresaDestinoInput.trim()) return;

    this.restoreNitConflict = '';
    this.unsupportedModuleMessage = '';
    const nombre = this.empresaDestinoInput.trim();

    this.enterpriseService
      .restoreFromBackup(this.selectedProcess.backupRef!, nombre, false, {
        nombreDestino: nombre,
        nitDestino: this.nitDestinoInput.trim() || undefined,
        skipUnknownModules: this.skipUnknownModules,
      })
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
          let fallback = 'No se pudo iniciar la restauración';
          if (status === 404) fallback = 'Backup no encontrado';
          if (status === 422) fallback = 'El backup está corrupto o es inválido';
          if (status === 400) fallback = 'Datos de restauración inválidos';
          const e = parseCopyError(err, fallback);
          if (e.kind === 'NIT_EXISTS') {
            // Se deja el diálogo abierto para que el usuario cambie NIT/nombre
            this.restoreNitConflict = e.message;
            return;
          }
          if (e.kind === 'UNSUPPORTED_MODULE') {
            // Requiere confirmación explícita (checkbox) antes de reintentar con skipUnknownModules
            this.unsupportedModuleMessage = e.message;
            this.skipUnknownModules = false;
            return;
          }
          this.messageService.add({ severity: 'error', summary: 'Error', detail: e.message, life: 8000 });
        },
      });
  }

  cancelRestore(): void {
    this.restoreDialogVisible = false;
    this.selectedProcess = null;
    this.empresaDestinoInput = '';
    this.nitDestinoInput = '';
    this.skipUnknownModules = false;
    this.restoreNitConflict = '';
    this.unsupportedModuleMessage = '';
    this.restoreMode = null;
    this.enterpriseForInplace = null;
    this.inplaceConfirmed = false;
  }

  /** Informativo: ver {@link isV2Process}. Ya no restringe la restauración sobre empresa existente. */
  isV2(process: CopyProcess | null): boolean {
    return isV2Process(process);
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
