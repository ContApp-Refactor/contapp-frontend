import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import { DropdownModule } from 'primeng/dropdown';
import { DatePickerModule } from 'primeng/datepicker';
import { AuditOperationServiceService } from '../../Services/audit-operation-service.service';
import { MessageService } from 'primeng/api';
import { UserRole } from '../../Models/enums/UserRole';
import { OperationType } from '../../Models/enums/OperationType';
import { Option } from '../../Models/common/Option';
import { OperationAudit } from '../../Models/operations/OperationAudit';
import { OperationAuditFilters } from '../../Models/operations/OperationAuditFilters';
import { PageResponse } from '../../Models/common/PageResponse';

@Component({
  selector: 'app-audit-system',
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    FormsModule,
    TagModule,
    ToggleSwitchModule,
    TooltipModule,
    ToastModule,
    InputIconModule,
    InputTextModule,
    IconFieldModule,
    DropdownModule,
    DatePickerModule,
  ],
  templateUrl: './audit-system.component.html',
  styleUrl: './audit-system.component.css'
})
export class AuditSystemComponent {
  private readonly operationService = inject(AuditOperationServiceService);
  private readonly messageService = inject(MessageService);
  private firstLoad = true;

  filtro: {
    fechaInicio: Date | null;
    fechaFin: Date | null;
    userName: string;
    userRole: UserRole | null;
    operationType: OperationType | null;
  } = {
      fechaInicio: null,
      fechaFin: null,
      userName: '',
      userRole: null,
      operationType: null,
    };
  
  roles: Option<UserRole>[] = [
    { label: 'Todos', value: null },
    { label: 'Administrador', value: UserRole.ADMINISTRADOR },
    { label: 'Profesor', value: UserRole.PROFESOR },
    { label: 'Estudiante', value: UserRole.ESTUDIANTE }
  ];

  operationsOptions: Option<OperationType>[] = [
    { label: 'Todos', value: null },
    { label: 'Creación', value: OperationType.CREATE },
    { label: 'Modificación', value: OperationType.UPDATE },
    { label: 'Eliminación', value: OperationType.DELETE },
    { label: 'Inactivación', value: OperationType.INACTIVATE },
    { label: 'Activación', value: OperationType.ACTIVATE }
  ];

  operationTypeLabels: Record<string, string> = {
    [OperationType.CREATE]: 'Creación',
    [OperationType.UPDATE]: 'Modificación',
    [OperationType.DELETE]: 'Eliminación',
    [OperationType.INACTIVATE]: 'Inactivación'
  };

  operations: OperationAudit[] = [];

  totalRecords = 0;
  currentPage = 0;
  pageSize = 20;

  loading = false;
  hasSearched = false;
  sortField: string = '';
  sortOrder: number = 0;

  today = new Date();

  applyFilters(page: number = 0): void {
    if (!this.isValidFilters()) {
      return;
    }
    this.loading = true;
    this.hasSearched = true;
    this.currentPage = page;

    const fechaInicio = this.filtro.fechaInicio!;
    const fechaFin = this.filtro.fechaFin!;

    const filters: OperationAuditFilters = {
      dateFrom: this.formatDateToISO(fechaInicio),
      dateTo: this.formatDateToISO(fechaFin, true),
      page: this.currentPage,
      size: this.pageSize,
      sortField: this.sortField,
      sortDirection: this.sortOrder === 1 ? 'ASC' : 'DESC'
    }
    if (this.filtro.userName && this.filtro.userName.trim()) {
      filters.userName = this.filtro.userName.replace(/\s+/g, ' ').trim();
    }
    if (this.filtro.userRole) {
      filters.userRole = this.filtro.userRole;
    }
    if (this.filtro.operationType) {
      filters.operationType = this.filtro.operationType;
    }

    this.operationService.getOperations(filters, 'system').subscribe({
      next: (response: PageResponse<OperationAudit>) => {
        this.operations = response.data;
        this.totalRecords = response.totalElements;
        this.loading = false;
        if (response.data.length === 0) {
          this.messageService.add({
            severity: 'info',
            summary: 'Sin resultados',
            detail: 'No se encontraron operaciones con los filtros aplicados'
          });
        }
      },
      error: (error) => {
        console.error('Error al obtener operaciones de auditoría:', error);
        this.loading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar las operaciones de auditoría'
        });
      }
    })
  }

  onLazyLoad(event: any) {
    if (this.firstLoad) {
      this.firstLoad = false;
      return;
    }
    this.pageSize = event.rows;
    this.currentPage = event.first / event.rows;

    if (event.sortField) {
      this.sortField = event.sortField;
      this.sortOrder = event.sortOrder;
    }

    this.applyFilters(this.currentPage);
  }

  onInputChange(event: any, field: 'userName') {
    const value = event.target.value;
    this.filtro[field] = this.sanitizeInput(value);
  }

  private sanitizeInput(value: string): string {
    if (!value) return '';
    let sanitized = value.replace(/[%_]/g, '');
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    return sanitized;
  }

  private isValidFilters(): boolean { 
    // Fechas vacias
    if (!this.filtro.fechaInicio || !this.filtro.fechaFin) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Atención',
        detail: 'Debe seleccionar un rango de fechas'
      });
      return false;
    }
    // Rango maximo 1 año
    const diff = this.filtro.fechaFin.getTime() - this.filtro.fechaInicio.getTime();
    const days = diff / (1000 * 60 * 60 * 24);
    if (days > 365) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Rango muy grande',
        detail: 'El rango máximo permitido es de 1 año'
      });
      return false;
    }
    // Fechas futuras
    const now = new Date();
    if (this.filtro.fechaInicio > now || this.filtro.fechaFin > now) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Fecha inválida',
        detail: 'No se pueden seleccionar fechas futuras'
      });
      return false;
    }
    // Validar usuario
    if (!this.validateTextField(this.filtro.userName, "Usuario", 3, 50)) {
      return false;
    }
    return true;
  }

  private validateTextField(
    value: string | null | undefined,
    fieldLabel: string,
    min: number,
    max: number
  ): boolean {
    if (!value || !value.trim()) {
      return true;
    }

    const trimmed = value.trim();

    if (trimmed.length < min) {
      this.messageService.add({
        severity: 'warn',
        summary: `${fieldLabel} muy corto`,
        detail: `Debe ingresar mínimo ${min} caracteres`
      });
      return false;
    }

    if (trimmed.length > max) {
      this.messageService.add({
        severity: 'warn',
        summary: `${fieldLabel} muy largo`,
        detail: `No puede exceder ${max} caracteres`
      });
      return false;
    }

    return true;
  }

  private formatDateToISO(date: Date, endOfDay = false): string {
    if (!date) return '';

    const d = new Date(date);

    const now = new Date();
    const isToday =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();

    if (endOfDay) {
      if (isToday) {
        d.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      } else {
        d.setHours(23, 59, 59, 999);
      }
    } else {
      d.setHours(0, 0, 0, 0);
    }

    return d.toISOString();
  }

  formatDateTime(dateString: string | null): string {
    if (!dateString) return '';

    const date = new Date(dateString);

    return date.toLocaleString(navigator.language, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  formatData(operation: OperationAudit): string {
    const data = operation.dataObject;
    if (!data) return '';

    switch (operation.operationType) {
      case OperationType.UPDATE:
        return this.formatUpdate(data);

      case OperationType.CREATE:
        return this.formatEntity("Datos creados", data.entity);

      case OperationType.DELETE:
        return this.formatEntity("Datos eliminados", data.entity);

      case OperationType.INACTIVATE:
        return this.formatEntity("Registro inactivado", data.entity); 

      default:
        return JSON.stringify(data);
    }
  }

  private formatUpdate(data: any): string {
    if (!data.changes || Object.keys(data.changes).length === 0) {
      return "Sin cambios";
    }

    const changes = Object.entries(data.changes)
      .map(([key, value]: any) =>
        `• ${key}: ${value.before} → ${value.after}`
      )
      .join('<br>');

    return `Cambios:<br>${changes}`;
  }

  private formatEntity(title: string, entity: any): string {
    if (!entity || Object.keys(entity).length === 0) {
      return `${title}: (sin datos)`;
    }

    const entries = Object.entries(entity)
      .map(([key, value]) => `• ${key}: ${value}`)
      .join('<br>');

    return `${title}:<br>${entries}`;
  }
}
