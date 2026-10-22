import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TagModule } from 'primeng/tag';
import { FormsModule } from '@angular/forms';
import { HelpCenterServiceService } from '../../services/help-center.service';
import { DocumentTypesServiceService } from '../../../DocumentTypes/services/document-types-service.service';
import { HelpCenter, HelpCenterList } from '../../models/HelpCenter';
import { HelpCenterPresentationService } from '../../services/help-center-presentation.service';
import { TableEmptyMessageComponent } from '../../../../Shared/Components/table-empty-message/table-empty-message.component';
import { AuthService } from '../../../../Core/auth/services/auth.service';

@Component({
  selector: 'app-help-center-list',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    ToastModule,
    TooltipModule,
    ConfirmDialogModule,
    ToggleSwitchModule,
    TagModule,
    FormsModule,
    TableEmptyMessageComponent,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './help-center-list.component.html',
  styleUrl: './help-center-list.component.css',
})
export class HelpCenterListComponent implements OnInit {
  list: HelpCenterList[] = [];
  moduleIdToName = new Map<number, string>();
  totalRecords: number = 0;
  currentPage: number = 0;
  currentSize: number = 10;
  loading: boolean = false;
  currentSortField: string = 'name';
  currentSortOrder: string = 'asc';
  searchTerm: string = '';
  canToggleState = false;
  canCreate = false;
  canEdit = false;
  canDelete = false;

  constructor(
    private readonly service: HelpCenterServiceService,
    private readonly modulesService: DocumentTypesServiceService,
    private readonly router: Router,
    private readonly messageService: MessageService,
    private readonly confirmationService: ConfirmationService,
    public readonly helpCenterPresentationService: HelpCenterPresentationService,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadModuleNames();
    const perms = this.authService.getCurrentUserPermissions();
    const isAdmin = this.authService.hasRole('Administrador');
    this.canCreate = isAdmin && perms.includes('HC#C');
    this.canEdit = isAdmin && perms.includes('HC#U');
    this.canToggleState = isAdmin && perms.includes('HC#CS');
    this.canDelete = isAdmin && perms.includes('HC#D');
  }

  private loadModuleNames(): void {
    this.loading = true;
    this.modulesService.getAllModules().subscribe({
      next: (modules) => {
        for (const m of modules) {
          this.moduleIdToName.set(m.id, m.name);
        }
        this.loadHelpCentersLazy({
          first: this.currentPage * this.currentSize,
          rows: this.currentSize,
          sortField: this.currentSortField,
          sortOrder: this.currentSortOrder === 'asc' ? 1 : -1,
        }); // Cargar centros de ayuda después de cargar las clases
      },
      error: (error: any) => {
        console.error('Error al cargar nombres de módulos:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los módulos. Inténtelo nuevamente.',
          life: 5000,
        });
      },
    });
  }

  loadHelpCentersLazy(event: any): void {
    this.currentPage = Math.floor(event.first / event.rows);
    this.currentSize = event.rows;

    if (event.sortField) {
      this.currentSortField = event.sortField;
      this.currentSortOrder = event.sortOrder === 1 ? 'asc' : 'desc';
    }

    this.service
      .findAll(
        this.currentPage,
        this.currentSize,
        this.currentSortField,
        this.currentSortOrder,
        this.searchTerm,
      )
      .subscribe({
        next: (page: any) => {
          const content: HelpCenter[] = page.content || [];
          this.list = content.map((hc) => ({
            ...hc,
            moduleName: hc.moduleName || this.getModuleName(hc.moduleId),
          }));
          this.totalRecords = page?.page?.totalElements || 0;
          this.loading = false;
        },
        error: (error: any) => {
          console.error('Error al cargar centros de ayuda:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail:
              'No se pudieron cargar los centros de ayuda. Inténtelo nuevamente.',
            life: 5000,
          });
          this.loading = false;
        },
      });
  }

  reloadCurrentPage(): void {
    this.loading = true;
    this.service
      .findAll(
        this.currentPage,
        this.currentSize,
        this.currentSortField,
        this.currentSortOrder,
        this.searchTerm,
      )
      .subscribe({
        next: (page: any) => {
          const content: HelpCenter[] = page.content || [];
          this.list = content.map((hc) => ({
            ...hc,
            moduleName: hc.moduleName || this.getModuleName(hc.moduleId),
          }));
          this.totalRecords = page?.page?.totalElements || 0;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error al recargar centros de ayuda:', error);
          this.loading = false;
        },
      });
  }

  onSearchChange(): void {
    this.currentPage = 0;
    this.loadHelpCentersLazy({
      first: 0,
      rows: this.currentSize,
      sortField: this.currentSortField,
      sortOrder: this.currentSortOrder === 'asc' ? 1 : -1,
    });
  }

  getModuleName(moduleId?: number): string {
    if (moduleId == null) return '';
    return this.moduleIdToName.get(moduleId) || '';
  }

  createHelpCenter() {
    if (!this.canCreate) return;
    this.router.navigate(['/gen-masters/help-center/create']);
  }

  editHelpCenter(row: HelpCenter) {
    if (!this.canEdit) return;
    if (!row?.id) return;
    this.router.navigate(['/gen-masters/help-center/edit', row.id]);
  }

  deleteHelpCenter(row: HelpCenter) {
    if (!row?.id) return;
    if (!this.canDelete || !this.authService.requireAnyPermission(['HC#D'])) return;
    this.confirmationService.confirm({
      header: 'Confirmar Eliminación',
      message: `¿Desea eliminar el centro de ayuda "${row.name}"? Esta acción no se puede deshacer.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      rejectButtonStyleClass: 'p-button-secondary',
      defaultFocus: 'reject',
      closeOnEscape: true,
      accept: () => this.confirmDeleteHelpCenter(row),
    });
  }

  changeHelpCenterState(helpCenter: HelpCenter) {
    if (!this.canToggleState) return;
    if (!helpCenter?.id) return;

    const newStatus = !helpCenter.status;

    this.service.changeState(helpCenter.id, newStatus).subscribe({
      next: () => {
        helpCenter.status = newStatus;
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: `Estado del centro de ayuda "${helpCenter.name}" cambiado correctamente`,
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo cambiar el estado del centro de ayuda.',
        });
      },
    });
  }

  private confirmDeleteHelpCenter(row: HelpCenter): void {
    if (!row?.id) return;

    this.service.delete(row.id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Eliminado',
          detail: 'Centro de ayuda eliminado correctamente.',
        });
        this.reloadCurrentPage();
      },
      error: (err: any) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo eliminar el centro de ayuda.',
        });
      },
    });
  }
}
