import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { EnterpriseService } from '../../services/enterprise.service';
import { CopyProcess } from '../../models/CopyProcess';

@Component({
  selector: 'app-copy-process-detail',
  standalone: true,
  imports: [CommonModule, ButtonModule, ProgressBarModule, ToastModule],
  providers: [MessageService],
  templateUrl: './copy-process-detail.component.html',
})
export class CopyProcessDetailComponent implements OnInit, OnDestroy {

  process: CopyProcess | null = null;
  loading = true;
  private pollInterval: any;

  readonly FASES = [
    { numero: 1, nombre: 'BASE', descripcion: 'Empresa, Catálogo y Productos' },
    { numero: 2, nombre: 'INTERNAS', descripcion: 'Productos y Terceros' },
    { numero: 3, nombre: 'EXTERNAS', descripcion: 'Tesorería, Stock, Kardex, Facturas, Libro auxiliar' },
    { numero: 4, nombre: 'CIERRE', descripcion: 'Validación de integridad' },
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private enterpriseService: EnterpriseService,
    private messageService: MessageService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/enterprise/copy-processes']);
      return;
    }
    this.loadProcess(id);
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  loadProcess(id: string): void {
    this.loading = true;
    this.enterpriseService.getCopyProcessStatus(id).subscribe({
      next: (data) => {
        this.process = data;
        this.loading = false;
        if (data.estado === 'EN_PROCESO') {
          this.startPolling(id);
        }
      },
      error: () => {
        this.loading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo cargar el proceso.',
        });
      },
    });
  }

  private startPolling(id: string): void {
    this.stopPolling();
    this.pollInterval = setInterval(() => {
      this.enterpriseService.getCopyProcessStatus(id).subscribe({
        next: (data) => {
          this.process = data;
          if (data.estado !== 'EN_PROCESO') {
            this.stopPolling();
          }
        },
      });
    }, 3000);
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  get progreso(): number {
    if (!this.process) return 0;
    if (this.process.estado === 'COMPLETADO') return 100;
    if (this.process.estado === 'EN_PROCESO' && this.process.faseActual) {
      return Math.round((this.process.faseActual / this.FASES.length) * 100);
    }
    return 0;
  }

  get estadoColor(): string {
    switch (this.process?.estado) {
      case 'COMPLETADO': return 'text-green-600';
      case 'EN_PROCESO': return 'text-blue-600';
      case 'ERROR':
      case 'FALLIDO': return 'text-red-600';
      case 'CANCELADO': return 'text-gray-500';
      default: return 'text-gray-700';
    }
  }

  get estadoIcono(): string {
    switch (this.process?.estado) {
      case 'COMPLETADO': return 'pi pi-check-circle';
      case 'EN_PROCESO': return 'pi pi-spin pi-spinner';
      case 'ERROR':
      case 'FALLIDO': return 'pi pi-times-circle';
      case 'CANCELADO': return 'pi pi-ban';
      default: return 'pi pi-circle';
    }
  }

  downloadBackup(): void {
    if (!this.process?.idProceso) return;
    this.enterpriseService.downloadCopyProcessBackup(this.process.idProceso).subscribe({
      next: (response) => {
        const blob = response.body as Blob;
        const cd = response.headers.get('Content-Disposition');
        let filename = `backup_${this.process!.idProceso}.zip`;
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
          detail: 'No se pudo descargar el backup.',
        });
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/enterprise/copy-processes']);
  }
}
