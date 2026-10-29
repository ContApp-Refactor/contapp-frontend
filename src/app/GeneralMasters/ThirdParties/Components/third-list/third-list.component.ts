import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { safeReturnTo } from '../../../../Billing/utils/return-trail';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// PrimeNG Imports
import { TableModule, Table } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { FileUploadModule } from 'primeng/fileupload';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { PaginatorModule } from 'primeng/paginator';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ProgressBarModule } from 'primeng/progressbar';
import { PopoverModule } from 'primeng/popover';
import { HelpCenterService } from '../../../../Shared/services/help-center.service';
import { TableEmptyMessageComponent } from '../../../../Shared/Components/table-empty-message/table-empty-message.component';

// Componentes internos
import { ThirdTemplateComponent } from '../third-template/third-template.component';
import { ThirdExportComponent, ExportParams } from '../third-export/third-export.component';
import { ThirdDetailsComponent } from '../third-details/third-details.component';
import { MessageService, ConfirmationService } from 'primeng/api';

// Models and Services
import { Third } from '../../models/Third';
import { ThirdService } from '../../Services/third.service';
import { ThirdServiceConfigurationService } from '../../Services/third-configuration.service';
import { ThirdType } from '../../models/ThirdType';
import { TypeId } from '../../models/TypeId';
import { LocalStorageMethods } from '../../../../Shared/Methods/local-storage.method';
import { ThirdValidationMessagesService } from '../../Services/third-validation-messages.service';

// Interfaces para manejo de errores de importación
interface ImportError {
  rowNumber: number;
  columnNumber: number;
  columnName: string;
  fieldValue: any;
  errorCode: string;
  errorMessage: string;
  errorType: string;
}

@Component({
  selector: 'app-third-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    TagModule,
    ToastModule,
    ConfirmDialogModule,
    FileUploadModule,
    DialogModule,
    TooltipModule,
    PaginatorModule,
    ToggleSwitchModule,
    ProgressBarModule,
    PopoverModule,
    TableEmptyMessageComponent,
    ThirdTemplateComponent,
    ThirdExportComponent,
    ThirdDetailsComponent
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './third-list.component.html',
  styleUrl: './third-list.component.css'
})
export class ThirdListComponent implements OnInit {
  @ViewChild('dt') dt!: Table;

  // Data properties
  thirds: Third[] = [];
  selectedThirds: Third[] = [];
  thirdTypes: ThirdType[] = [];
  typeIds: TypeId[] = [];

  // UI State
  loading = false;
  loadingPdfRut = false;
  loadingTemplate = false;
  showDetailView = false;
  searchValue = '';

  bulkStateToggle = true; // Default to active

  // Ruta segura para "Volver a factura" (solo si llegó con ?returnTo=/billing/...)
  returnTo: string | null = null;

  isImporting = false;
  isExporting = false;

  // Propiedades para manejo asíncrono (importación/exportación)
  showProgressDialog = false;
  progressJobId: string | null = null;
  progressValue = 0;
  progressStatus = '';
  progressPhase = '';
  progressOperationType: 'import' | 'export' = 'import';
  private progressPollingInterval: any = null;


  // Pagination
  totalRecords = 0;
  rows = 10;
  first = 0;
  sortField = 'names';
  sortOrder: 'asc' | 'desc' = 'asc';

  // Modal states
  showTemplateModal = false;
  showImportModal = false;
  showExportModal = false;
  showErrorModal = false;

  /** Control de visibilidad del modal de detalles */
  showDetailsModal = false;

  // Variables para manejar errores de importación
  importErrors: ImportError[] = [];
  totalErrors = 0;
  totalRecordsImported = 0;
  successfulImports = 0;
  failedImportsCount = 0;
  duplicatesOmitted = 0;

  /** Datos para el modal de detalles */
  detailsModalData: any = null;

  // Company data
  entData: string = '';
  
  // URL del centro de ayuda
  helpCenterUrl: string;

  // Constantes
  private readonly EMPTY_PDF_CONTENT = ';;0;;;;;;;;;0';

  constructor(
    private readonly thirdService: ThirdService,
    private readonly thirdConfigurationService: ThirdServiceConfigurationService,
    private readonly messageService: MessageService,
    private readonly confirmationService: ConfirmationService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly localStorageMethods: LocalStorageMethods,
    public readonly thirdValidationMessagesService: ThirdValidationMessagesService,
    private readonly helpCenterService: HelpCenterService
  ) {
    this.entData = this.localStorageMethods.getIdEnterprise();
    this.helpCenterUrl = this.helpCenterService.getHelpCenterUrl('configuracion');
  }

  ngOnInit(): void {
    this.returnTo = safeReturnTo(this.route.snapshot.queryParamMap.get('returnTo'));
    this.loadThirds();
    this.getThirdTypes();
    this.getTypesID();
    const savedBulkState = localStorage.getItem('thirdBulkStateToggle');
    if (savedBulkState !== null) {
      this.bulkStateToggle = JSON.parse(savedBulkState);
    }
  }

  goBackToInvoice(): void {
    if (this.returnTo) this.router.navigateByUrl(this.returnTo);
  }

  /**
   * Carga la lista de terceros con paginación desde el backend
   */
  loadThirds(): void {
    this.loading = true;
    const pageNumber = Math.floor(this.first / this.rows);

    this.thirdService.getThirdParties(
      this.entData,
      pageNumber,
      this.rows,
      this.sortField,
      this.sortOrder,
      this.searchValue || undefined
    ).subscribe({
      next: (response) => {
        this.thirds = response.content || [];
        this.totalRecords = response.page?.totalElements || response.totalElements || 0;
        this.loading = false;
      },
      error: (error: any) => {
        this.thirds = [];
        this.totalRecords = 0;
        this.loading = false;
        // Only show error if it's not a 404 or empty result
        if (error.status !== 404) {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Error al cargar los terceros'
          });
        }
      }
    });
  }

  /**
   * Obtiene los tipos de tercero
   */
  private getThirdTypes(): void {
    this.thirdConfigurationService.getThirdTypes(this.entData).subscribe({
      next: (response: ThirdType[]) => {
        this.thirdTypes = response;
      },
      error: (error: any) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se han encontrado Tipos De Tercero Para esta Empresa'
        });
      }
    });
  }

  /**
   * Obtiene los tipos de identificación
   */
  private getTypesID(): void {
    this.thirdConfigurationService.getTypeIds(this.entData).subscribe({
      next: (response: TypeId[]) => {
        this.typeIds = response;
      },
      error: (error: any) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se han encontrado Tipos De Identificación Para esta Empresa'
        });
      }
    });
  }

  /**
   * Maneja el cambio en el término de búsqueda
   */
  onSearch(): void {
    this.first = 0; // Reset to first page when searching
    this.loadThirds();
  }

  /**
   * Maneja el cambio de página
   */
  onPageChange(event: any): void {
    this.first = event.first;
    this.rows = event.rows;
    this.loadThirds();
  }

  /**
   * Maneja el cambio de ordenamiento
   */
  onSort(event: any): void {
    // Evitar llamadas recursivas si el ordenamiento no cambió
    if (this.sortField === event.field && this.sortOrder === (event.order === 1 ? 'asc' : 'desc')) {
      return;
    }

    this.sortField = event.field;
    this.sortOrder = event.order === 1 ? 'asc' : 'desc';
    this.loadThirds();
  }


  /**
   * Alterna entre vista detallada y resumida
   */
  toggleDetailView(): void {
    this.showDetailView = !this.showDetailView;
  }

  /**
   * Navega a la página de creación de terceros
   */
  navigateToCreate(): void {
    this.router.navigate(['/gen-masters/third-parties/create']);
  }

  /**
   * Navega a la página de edición de terceros
   */
  navigateToEdit(thirdId: number): void {
    this.router.navigate(['/gen-masters/third-parties/edit', thirdId]);
  }

  /**
   * Cambia el estado de un tercero
   */
  changeThirdState(third: Third): void {
    const previousState = third.state;

    this.thirdService.changeThirdPartieState(third.thId, this.entData).subscribe({
      next: (response: any) => {
        if (response && typeof response === 'object' && 'state' in response) {
          third.state = response.state;
        } else {
          // El backend no devuelve el tercero, obtener el estado actualizado
          this.thirdService.getThirdPartie(third.thId, this.entData).subscribe({
            next: (fetchedThird: any) => {
              third.state = fetchedThird.state;
            },
            error: (fetchError) => {
              third.state = !previousState;
            }
          });
        }

        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: `Estado del Tercero cambiado correctamente`
        });
      },
      error: (error) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: `Error al cambiar el estado del tercero`
        });
      }
    });
  }

  /**
   * Confirma y elimina un tercero
   */
  confirmDelete(third: Third): void {
    const displayName = this.getDisplayName(third);

    this.confirmationService.confirm({
      message: `¿Desea eliminar a "${displayName}"? Esta acción no se puede deshacer.`,
      header: 'Confirmar Eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-secondary',
      defaultFocus: 'reject',
      closeOnEscape: true,
      accept: () => {
        this.thirdService.deleteThird(third.thId, this.entData).subscribe({
          next: () => {
            this.thirds = this.thirds.filter(t => t.thId !== third.thId);
            this.totalRecords--;
            this.messageService.add({
              severity: 'success',
              summary: 'Eliminado',
              detail: 'Tercero eliminado correctamente'
            });
          },
          error: (error) => {
            // Verificar si el error específico de tercero en uso
            const errorCode = error?.error?.code || error?.code || '';
            if (errorCode === 'THIRD_IN_USE') {
              this.messageService.add({
                severity: 'info',
                summary: 'Información',
                detail: error?.error?.message || 'No se puede eliminar el tercero porque tiene movimientos contables'
              });
            } else {
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'Ha ocurrido un error al intentar eliminar el tercero.'
              });
            }
          }
        });
      }
    });
  }

  /**
   * Cambia el estado de todos los terceros de forma masiva
   */
  changeBulkState(): void {
    const actionLower = this.bulkStateToggle ? 'activar' : 'inactivar';

    this.confirmationService.confirm({
      message: `¿Desea ${actionLower} todos los terceros? Esta acción no se puede deshacer.`,
      header: 'Confirmar Cambio de Estado Masivo',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: `Sí, ${actionLower}`,
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: this.bulkStateToggle ? 'p-button-success' : 'p-button-danger',
      rejectButtonStyleClass: 'p-button-secondary',
      defaultFocus: 'reject',
      closeOnEscape: true,
      accept: () => {
        this.loading = true;
        this.thirdService.changeAllThirdsState(this.entData, this.bulkStateToggle).subscribe({
          next: (response: any) => {
            this.loadThirds();
            localStorage.setItem('thirdBulkStateToggle', JSON.stringify(this.bulkStateToggle));

            this.messageService.add({
              severity: 'success',
              summary: 'Cambio Masivo Exitoso',
              detail: `${response.message}`
            });
          },
          error: (error) => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Error al cambiar el estado masivo de los terceros'
            });
          }
        }).add(() => {
          this.loading = false;
        });
      },
      reject: () => {
        this.bulkStateToggle = !this.bulkStateToggle;
      }
    });
  }

  /**
   * Obtiene el nombre completo o razón social
   */
  getDisplayName(third: Third): string {
    return third.names ? `${third.names} ${third.lastNames}` : third.socialReason || '';
  }

  /**
   * Obtiene la severidad del tag según el estado
   */
  getStateSeverity(state: boolean): 'success' | 'danger' {
    return state ? 'success' : 'danger';
  }

  /**
   * Obtiene el texto del estado
   */
  getStateText(state: boolean): string {
    return state ? 'Activo' : 'Inactivo';
  }

  /**
   * Obtiene los tipos de tercero como string
   */
  getThirdTypesText(thirdTypes: ThirdType[]): string {
    return thirdTypes.map(type => type.thirdTypeName).join(', ');
  }

  /**
   * Maneja la selección de archivos para importación asíncrona
   */
  onFileSelect(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    // Validar tipo de archivo manualmente
    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel' // .xls
    ];

    if (!allowedMimeTypes.includes(file.type)) {
      this.messageService.add({
        severity: 'error',
        summary: 'Archivo inválido',
        detail: 'Por favor, selecciona un archivo EXCEL válido'
      });
      // Reset input
      event.target.value = '';
      return;
    }

    this.isImporting = true;
    this.progressOperationType = 'import';

    // Iniciar importación asíncrona
    this.thirdService.importThirdsAsync(this.entData, file).subscribe({
      next: (response) => {
        // Guardar el jobId y mostrar diálogo de progreso
        this.progressJobId = response.jobId;
        this.progressValue = 0;
        this.progressStatus = 'PROCESSING';
        this.progressPhase = 'Iniciando importación...';
        this.showProgressDialog = true;
        
        // Iniciar polling cada 5 segundos
        this.startProgressPolling();

        this.messageService.add({
          severity: 'info',
          summary: 'Importación iniciada',
          detail: 'La importación se está procesando.'
        });
      },
      error: (error) => {
        this.isImporting = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error al Iniciar Importación',
          detail: error.error?.message || 'No se pudo iniciar la importación'
        });
      }
    });

    // Reset input
    event.target.value = '';
  }


  /**
   * Muestra el modal de errores de importación
   */
  private showImportErrorsModal(errors: ImportError[], fileName: string, totalRecords?: number, failedImports?: number, successfulImports?: number, duplicatesSkipped?: number): void {
    this.importErrors = errors;
    this.totalErrors = errors.length;
    this.totalRecordsImported = totalRecords || 0;
    this.failedImportsCount = failedImports || errors.length;
    this.successfulImports = successfulImports || 0;
    this.duplicatesOmitted = duplicatesSkipped || 0;

    this.showErrorModal = true;
  }

  /**
   * Muestra una notificación de error
   */
  private showErrorNotification(message: string, details: string): void {
    const detailMessage = details ? `${message}\n${details}` : message;

    this.messageService.add({
      severity: 'error',
      summary: 'Error de Importación',
      detail: detailMessage,
      life: 8000
    });
  }

  // Navigation methods
  openConfigModal(): void {
    this.router.navigate(['/gen-masters/third-parties/configuration']);
  }

  /**
   * Maneja el evento cuando se inician parámetros de exportación desde el modal
   * @param params Parámetros de exportación (filtro de estado y campos opcionales)
   */
  onStartExportWithParams(params: ExportParams): void {
    this.exportThirds(params.statusFilter, params.optionalFields);
  }

  /**
   * Exporta terceros a formato Excel de forma asíncrona
   * @param status Estado del filtro (true=activos, false=inactivos, null=todos)
   * @param optionalFields Campos opcionales a incluir en la exportación
   */
  exportThirds(status?: boolean | null, optionalFields?: string[]): void {
    const entData = this.localStorageMethods.loadEnterpriseData();
    const entId = entData?.id || this.entData;
    const companyName = entData?.name || '';

    this.isExporting = true;
    this.progressOperationType = 'export';

    // Iniciar exportación asíncrona con campos opcionales
    this.thirdService.exportThirdsAsync(entId, companyName, status, optionalFields).subscribe({
      next: (response) => {
        // Guardar el jobId y mostrar diálogo de progreso
        this.progressJobId = response.jobId;
        this.progressValue = 0;
        this.progressStatus = 'PROCESSING';
        this.progressPhase = 'Iniciando exportación...';
        this.showProgressDialog = true;
        
        // Iniciar polling cada 5 segundos
        this.startProgressPolling();
      },
      error: (error) => {
        this.isExporting = false;
        
        // Manejar error del backend
        let errorMessage = 'No se pudo iniciar la exportación';
        
        // Intentar extraer el mensaje del error
        if (error.error instanceof Blob) {
          // Si el error viene como Blob, leerlo
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const errorData = JSON.parse(reader.result as string);
              errorMessage = errorData.message || errorMessage;
              const isNoDataMessage = this.isNoThirdsAvailableMessage(errorMessage);

              this.messageService.add({
                severity: isNoDataMessage ? 'info' : 'error',
                summary: isNoDataMessage ? 'Información' : 'Error al Iniciar Exportación',
                detail: errorMessage
              });
            } catch (e) {
              this.messageService.add({
                severity: 'error',
                summary: 'Error al Iniciar Exportación',
                detail: errorMessage
              });
            }
          };
          reader.onerror = () => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error al Iniciar Exportación',
              detail: errorMessage
            });
          };
          reader.readAsText(error.error);
        } else {
          // Error directo (JSON)
          errorMessage = error.error?.message || error.message || errorMessage;
          const isNoDataMessage = this.isNoThirdsAvailableMessage(errorMessage);

          this.messageService.add({
            severity: isNoDataMessage ? 'info' : 'error',
            summary: isNoDataMessage ? 'Información' : 'Error al Iniciar Exportación',
            detail: errorMessage
          });
        }
      }
    });
  }

  openTemplateModal(): void {
    this.showTemplateModal = true;
  }

  closeTemplateModal(): void {
    this.showTemplateModal = false;
  }

  openExportModal(): void {
    this.showExportModal = true;
  }

  closeExportModal(): void {
    this.showExportModal = false;
  }

  /**
   * Maneja el cambio de estado de progreso de plantilla
   */
  onTemplateInProgress(inProgress: boolean): void {
    this.loadingTemplate = inProgress;
  }

  /**
   * Cierra el modal de errores de importación
   */
  closeErrorModal(): void {
    this.showErrorModal = false;
    this.importErrors = [];
    this.totalErrors = 0;
  }

  /**
   * Obtiene la etiqueta amigable para el tipo de error
   */
  getErrorTypeLabel(errorType: string): string {
    const labels: { [key: string]: string } = {
      'VALIDATION_ERROR': 'Error de Validación',
      'REFERENCE_ERROR': 'Error de Referencia',
      'BUSINESS_RULE_ERROR': 'Error de Regla de Negocio',
      'DUPLICATE_ERROR': 'Error de Duplicado',
      'PROCESSING_ERROR': 'Error de Procesamiento'
    };
    return labels[errorType] || errorType;
  }

  /**
   * Abre el modal de detalles para un tercero específico
   * @param third Datos del tercero a mostrar
   */
  openDetailsModal(third: Third): void {
    this.detailsModalData = {
      title: `Detalles del Tercero - ${third.names || third.socialReason || 'Sin nombre'}`,
      thId: third.thId
    };
    this.showDetailsModal = true;
  }

  /**
   * Cierra el modal de detalles
   */
  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.detailsModalData = null;
  }

  /**
   * Maneja la selección de un archivo PDF RUT
   * Procesa el archivo y redirige a la creación del tercero
   */
  onPdfRutSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    // Validar que sea un PDF
    if (file.type !== 'application/pdf') {
      this.messageService.add({
        severity: 'error',
        summary: 'Archivo inválido',
        detail: 'Por favor, selecciona un archivo PDF válido'
      });
      input.value = '';
      return;
    }

    this.loadingPdfRut = true;

    this.thirdService.ExtractInfoPDFRUT(file).subscribe({
      next: (response) => {
        const pdfContent = response.content;

        if (pdfContent === this.EMPTY_PDF_CONTENT) {
          this.messageService.add({
            severity: 'error',
            summary: 'Sin información',
            detail: 'No se encontró información para crear un tercero'
          });
          this.loadingPdfRut = false;
        } else {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Archivo procesado correctamente'
          });

          // Redirigir a la creación del tercero
          this.thirdService.setInfoThirdRUT(pdfContent);
          this.router.navigate(['/gen-masters/third-parties/create']);
        }

        // Limpiar el input
        input.value = '';
      },
      error: (err) => {
        this.loadingPdfRut = false;
        const errorMessage = err?.error?.message || 'No se pudo procesar el archivo PDF';

        this.messageService.add({
          severity: 'error',
          summary: 'Error de procesamiento',
          detail: errorMessage
        });

        // Limpiar el input
        input.value = '';
      }
    });
  }

  /**
   * Inicia el polling para verificar el estado de la operación asíncrona cada 5 segundos.
   */
  private startProgressPolling(): void {
    // Limpiar cualquier polling anterior
    if (this.progressPollingInterval) {
      clearInterval(this.progressPollingInterval);
    }

    // Consultar inmediatamente y luego cada 5 segundos
    this.checkProgressStatus();
    this.progressPollingInterval = setInterval(() => {
      this.checkProgressStatus();
    }, 5000);
  }

  /**
   * Verifica el estado actual de la operación (importación o exportación).
   */
  private checkProgressStatus(): void {
    if (!this.progressJobId) return;

    const statusObservable = this.progressOperationType === 'import'
      ? this.thirdService.getImportStatus(this.progressJobId)
      : this.thirdService.getExportStatus(this.progressJobId);

    statusObservable.subscribe({
      next: (status) => {
        this.progressValue = status.progress || 0;
        this.progressStatus = status.status;
        
        // Actualizar mensaje de fase
        this.progressPhase = this.getProgressPhaseMessage(status);

        // Si la operación terminó (éxito, con errores o falla)
        if (status.status === 'COMPLETED' || status.status === 'COMPLETED_WITH_ERRORS' || status.status === 'FAILED') {
          this.stopProgressPolling();
          this.handleProgressCompletion(status);
        }
      },
      error: (error) => {
        const operationName = this.progressOperationType === 'import' ? 'importación' : 'exportación';
        this.stopProgressPolling();
        this.showProgressDialog = false;
        
        if (this.progressOperationType === 'import') {
          this.isImporting = false;
        } else {
          this.isExporting = false;
        }
        
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: `No se pudo consultar el estado de la ${operationName}`
        });
      }
    });
  }

  /**
   * Detiene el polling de la operación asíncrona.
   */
  private stopProgressPolling(): void {
    if (this.progressPollingInterval) {
      clearInterval(this.progressPollingInterval);
      this.progressPollingInterval = null;
    }
  }

  /**
   * Obtiene el mensaje de fase actual según el estado y tipo de operación.
   */
  private getProgressPhaseMessage(status: any): string {
    if (this.progressOperationType === 'import') {
      return this.getImportPhaseMessage(status);
    } else {
      return this.getExportPhaseMessage(status);
    }
  }

  /**
   * Obtiene el mensaje de fase actual para importación.
   */
  private getImportPhaseMessage(status: any): string {
    if (status.progress === 100) {
      return 'Finalizando importación...';
    }
    
    if (status.progress >= 80) {
      return 'Guardando terceros en la base de datos...';
    }
    
    if (status.progress >= 60) {
      return 'Validando relaciones y referencias...';
    }
    
    if (status.progress >= 40) {
      return 'Detectando duplicados...';
    }
    
    if (status.progress >= 20) {
      return 'Validando datos de terceros...';
    }
    
    return 'Analizando archivo Excel...';
  }

  /**
   * Obtiene el mensaje de fase actual para exportación.
   */
  private getExportPhaseMessage(status: any): string {
    if (status.progress === 100) {
      return 'Finalizando exportación...';
    }
    
    if (status.progress >= 66) {
      return 'Almacenando archivo...';
    }
    
    if (status.progress >= 33) {
      return 'Generando archivo Excel...';
    }
    
    return 'Obteniendo datos de terceros...';
  }

  /**
   * Maneja la finalización de la operación (importación o exportación).
   */
  private handleProgressCompletion(status: any): void {
    if (this.progressOperationType === 'import') {
      this.handleImportCompletion(status);
    } else {
      this.handleExportCompletion(status);
    }
  }

  /**
   * Maneja la finalización de la importación.
   */
  private handleImportCompletion(status: any): void {
    // Cerrar modal si está abierto
    this.showProgressDialog = false;
    this.isImporting = false;
    this.progressJobId = null;

    const { totalRecords, successfulImports, failedImports, duplicatesSkipped, errors } = status;

    // Si hay errores, mostrar modal de errores (sin notificación adicional)
    if (errors && errors.length > 0) {
      this.showImportErrorsModal(
        errors, 
        status.fileName || 'importacion.xlsx', 
        totalRecords, 
        failedImports, 
        successfulImports, 
        duplicatesSkipped
      );

      // Recargar lista si hubo importaciones exitosas
      if (successfulImports > 0) {
        this.loadThirds();
      }

      // No mostrar notificación cuando hay errores - el modal es suficiente
      return;
    }

    // Solo mostrar error general si el estado es FAILED sin errores detallados
    if (status.status === 'FAILED') {
      this.messageService.add({
        severity: 'error',
        summary: 'Importación Fallida',
        detail: status.errorMessage || 'La importación no pudo completarse',
        life: 8000
      });
      return;
    }

    // Importación exitosa sin errores
    if (status.status === 'COMPLETED') {
      let detailMessage = `Total procesados: ${totalRecords || 0}\n`;
      detailMessage += `Exitosos: ${successfulImports || 0}`;
      if (duplicatesSkipped > 0) {
        detailMessage += `\nDuplicados omitidos: ${duplicatesSkipped}`;
      }
      
      this.messageService.add({
        severity: 'success',
        summary: 'Importación Exitosa',
        detail: detailMessage,
        life: 8000
      });
      this.loadThirds();
    }
  }

  /**
   * Maneja la finalización de la exportación.
   */
  private handleExportCompletion(status: any): void {
    // Guardar el jobId antes de limpiarlo
    const jobId = this.progressJobId;
    
    // Cerrar modal si está abierto
    this.showProgressDialog = false;
    this.isExporting = false;
    this.progressJobId = null;

    if (status.status === 'FAILED') {
      const errorMessage = status.errorMessage || 'La exportación no pudo completarse';
      
      // Verificar si es un mensaje informativo (sin datos)
      const isNoDataMessage = this.isNoThirdsAvailableMessage(errorMessage);

      this.messageService.add({
        severity: isNoDataMessage ? 'info' : 'error',
        summary: isNoDataMessage ? 'Información' : 'Exportación Fallida',
        detail: errorMessage,
        life: 8000
      });
      return;
    }

    // Exportación exitosa - descargar archivo
    if (status.status === 'COMPLETED' && jobId) {
      this.thirdService.downloadExportFile(jobId).subscribe({
        next: (response) => {
          if (!response.body) {
            this.messageService.add({
              severity: 'error',
              summary: 'Error de Exportación',
              detail: 'No se recibió el archivo del servidor'
            });
            return;
          }

          this.downloadFile(response);
          
          let detailMessage = `Total de registros: ${status.totalRecords || 0}`;
          
          this.messageService.add({
            severity: 'success',
            summary: 'Exportación Exitosa',
            detail: detailMessage,
            life: 8000
          });
        },
        error: (error) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error de Descarga',
            detail: 'No se pudo descargar el archivo exportado'
          });
        }
      });
    }
  }

  /**
   * Verifica si el mensaje indica que no hay terceros disponibles para exportar.
   * @param message Mensaje de error
   * @returns true si es un mensaje informativo de sin datos
   */
  private isNoThirdsAvailableMessage(message: string): boolean {
    const noThirdsPatterns = [
      'no hay terceros',
      'no hay terceros activos',
      'no hay terceros inactivos',
      'no hay terceros para exportar',
      'no existen terceros',
      'no se encontraron terceros',
      'no hay registros',
      'empty',
      'sin terceros'
    ];

    const lowerMessage = message.toLowerCase();
    return noThirdsPatterns.some(pattern => lowerMessage.includes(pattern));
  }

  /**
   * Procesa la respuesta HTTP para descargar el archivo.
   */
  private downloadFile(response: any): void {
    const blob = response.body;
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'terceros.xlsx';

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '');
      }
    }

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  /**
   * Maneja el cierre del modal de progreso.
   * El polling continúa en segundo plano.
   */
  onProgressDialogClose(): void {
    // Solo cerrar el modal, el polling continúa en segundo plano
    this.showProgressDialog = false;
  }

  /**
   * Exporta los errores de importación a un archivo Excel
   * Genera un archivo con formato estructurado incluyendo resumen de estadísticas y detalle de errores
   */
  exportImportErrors(): void {
    try {
      // Validar que existan errores para exportar
      if (!this.importErrors || this.importErrors.length === 0) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Sin Errores',
          detail: 'No hay errores para exportar'
        });
        return;
      }

      // Crear el workbook y worksheet
      const wb: XLSX.WorkBook = XLSX.utils.book_new();
      const ws: XLSX.WorkSheet = {};

      // Información del encabezado
      const headerInfo = [
        ['ERRORES DE IMPORTACIÓN DE TERCEROS'],
        [''],
        ['Fecha de exportación:', new Date().toLocaleDateString('es-CO', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        })],
        ['Hora:', new Date().toLocaleTimeString('es-CO')],
        [''],
        ['RESUMEN DE IMPORTACIÓN'],
        ['Total procesados:', this.totalRecordsImported],
        ['Exitosos:', this.successfulImports],
        ['Fallidos:', this.failedImportsCount],
        ['Duplicados omitidos:', this.duplicatesOmitted],
        [''],
        ['DETALLE DE ERRORES']
      ];

      // Agregar la información del encabezado
      XLSX.utils.sheet_add_aoa(ws, headerInfo, { origin: 'A1' });

      // Encabezados de la tabla
      const tableHeaders = [
        ['Fila', 'Columna', 'Campo', 'Valor', 'Error']
      ];

      // Agregar encabezados de la tabla
      XLSX.utils.sheet_add_aoa(ws, tableHeaders, { origin: 'A14' });

      // Preparar los datos de la tabla
      const tableData = this.importErrors.map(error => [
        error.rowNumber,
        this.thirdValidationMessagesService.getExcelColumnLetter(error.columnNumber),
        error.columnName,
        error.fieldValue || '(vacío)',
        error.errorMessage
      ]);

      // Agregar los datos de la tabla
      XLSX.utils.sheet_add_aoa(ws, tableData, { origin: 'A15' });

      // Establecer el rango de la hoja
      const totalRows = headerInfo.length + 2 + tableData.length;
      ws['!ref'] = `A1:E${totalRows}`;

      // Configurar anchos de columnas
      ws['!cols'] = [
        { wch: 8 },  // A - Fila
        { wch: 10 }, // B - Columna
        { wch: 25 }, // C - Campo
        { wch: 25 }, // D - Valor
        { wch: 60 }  // E - Error
      ];

      // Combinar celdas para el título
      if (!ws['!merges']) ws['!merges'] = [];
      ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }); // A1:E1 (Título)

      // Agregar el worksheet al workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Errores Importación');

      // Generar el nombre del archivo con fecha local
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const timestamp = `${year}-${month}-${day}`;
      const fileName = `Errores_Importacion_Terceros_${timestamp}.xlsx`;

      // Generar el archivo y descargarlo
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/octet-stream' });
      saveAs(blob, fileName);

      // Cerrar el modal
      this.closeErrorModal();

      // Mostrar notificación de éxito
      this.messageService.add({
        severity: 'success',
        summary: 'Exportación exitosa',
        detail: `El archivo se ha exportado correctamente.`
      });

    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error de Exportación',
        detail: 'No se pudo exportar el archivo de errores. Por favor, intente nuevamente.'
      });
    }
  }
}
