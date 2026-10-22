import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CopyProcessListComponent } from './copy-process-list.component';
import { EnterpriseService } from '../services/enterprise.service';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';
import { HttpResponse, HttpHeaders } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CopyProcess } from '../models/CopyProcess';

const mockProcess: CopyProcess = {
  id: 'proc-1',
  tipo: 'BACKUP',
  estado: 'COMPLETADO',
  empresaOrigen: 'uuid-origen',
  empresaDestino: 'empresa-destino',
  iniciadoPor: 'user1',
  iniciadoEn: '2024-01-01T10:00:00',
  backupRef: 'backup_uuid-origen_proc-1_20240101-100000.zip',
};

describe('CopyProcessListComponent', () => {
  let component: CopyProcessListComponent;
  let fixture: ComponentFixture<CopyProcessListComponent>;
  let enterpriseService: jasmine.SpyObj<EnterpriseService>;
  let messageService: jasmine.SpyObj<MessageService>;

  beforeEach(async () => {
    const enterpriseSpy = jasmine.createSpyObj('EnterpriseService', [
      'getCopyProcesses', 'downloadCopyProcessBackup', 'restoreFromBackup',
    ]);
    const messageSpy = jasmine.createSpyObj('MessageService', ['add']);

    enterpriseSpy.getCopyProcesses.and.returnValue(of([mockProcess]));

    await TestBed.configureTestingModule({
      imports: [CopyProcessListComponent, NoopAnimationsModule],
      providers: [
        { provide: EnterpriseService, useValue: enterpriseSpy },
        { provide: MessageService, useValue: messageSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CopyProcessListComponent);
    component = fixture.componentInstance;
    enterpriseService = TestBed.inject(EnterpriseService) as jasmine.SpyObj<EnterpriseService>;
    messageService = TestBed.inject(MessageService) as jasmine.SpyObj<MessageService>;
    fixture.detectChanges();
  });

  it('debería crearse el componente', () => {
    expect(component).toBeTruthy();
  });

  it('carga procesos al iniciar (REQ-UI-LIST-01)', () => {
    expect(enterpriseService.getCopyProcesses).toHaveBeenCalled();
    expect(component.processes.length).toBe(1);
    expect(component.loading).toBeFalse();
  });

  it('muestra error si la carga falla (REQ-UI-STATE-01)', () => {
    enterpriseService.getCopyProcesses.and.returnValue(throwError(() => new Error('fail')));
    component.loadProcesses();
    fixture.detectChanges();
    expect(messageService.add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error' }));
    expect(component.loading).toBeFalse();
  });

  it('botón Descargar ausente si backupRef es null (REQ-UI-DOWNLOAD-01)', () => {
    component.processes = [{ ...mockProcess, backupRef: undefined }];
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('[icon="pi pi-download"]');
    expect(btn).toBeNull();
  });

  it('descarga blob con nombre del Content-Disposition (REQ-UI-DOWNLOAD-01)', () => {
    const headers = new HttpHeaders({ 'Content-Disposition': 'attachment; filename="mi_backup.zip"' });
    const blob = new Blob(['data'], { type: 'application/zip' });
    enterpriseService.downloadCopyProcessBackup.and.returnValue(
      of(new HttpResponse({ body: blob, headers })),
    );
    spyOn(document.body, 'appendChild').and.callThrough();
    component.downloadBackup(mockProcess);
    expect(enterpriseService.downloadCopyProcessBackup).toHaveBeenCalledWith('proc-1');
  });

  it('usa nombre de fallback si Content-Disposition ausente (REQ-UI-DOWNLOAD-01)', () => {
    const blob = new Blob(['data'], { type: 'application/zip' });
    enterpriseService.downloadCopyProcessBackup.and.returnValue(
      of(new HttpResponse({ body: blob, headers: new HttpHeaders() })),
    );
    spyOn(window.URL, 'createObjectURL').and.returnValue('blob:fake');
    spyOn(window.URL, 'revokeObjectURL');
    const anchor = document.createElement('a');
    spyOn(document, 'createElement').and.returnValue(anchor);
    component.downloadBackup(mockProcess);
    expect(anchor.download).toBe('backup_proc-1.zip');
  });

  it('descarga falla — muestra toast de error (REQ-UI-DOWNLOAD-01)', () => {
    enterpriseService.downloadCopyProcessBackup.and.returnValue(throwError(() => ({ status: 404 })));
    component.downloadBackup(mockProcess);
    expect(messageService.add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error' }));
  });

  it('abre diálogo de restauración al pulsar Restaurar (REQ-UI-RESTORE-01)', () => {
    component.openRestoreDialog(mockProcess);
    expect(component.restoreDialogVisible).toBeTrue();
    expect(component.selectedProcess).toBe(mockProcess);
    expect(component.empresaDestinoInput).toBe('');
  });

  it('restaura con éxito y muestra toast success (REQ-UI-RESTORE-01)', () => {
    enterpriseService.restoreFromBackup.and.returnValue(of({ ...mockProcess, tipo: 'RESTORE' }));
    component.selectedProcess = mockProcess;
    component.empresaDestinoInput = 'nueva-empresa';
    component.confirmRestore();
    expect(messageService.add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'success' }));
    expect(component.restoreDialogVisible).toBeFalse();
  });

  it('restauración falla 422 — muestra toast error con mensaje corrupto (REQ-UI-RESTORE-01)', () => {
    enterpriseService.restoreFromBackup.and.returnValue(throwError(() => ({ status: 422 })));
    component.selectedProcess = mockProcess;
    component.empresaDestinoInput = 'empresa';
    component.confirmRestore();
    expect(messageService.add).toHaveBeenCalledWith(
      jasmine.objectContaining({ severity: 'error', detail: jasmine.stringContaining('corrupto') }),
    );
  });

  it('cancelar restauración limpia el estado (REQ-UI-RESTORE-01)', () => {
    component.restoreDialogVisible = true;
    component.selectedProcess = mockProcess;
    component.cancelRestore();
    expect(component.restoreDialogVisible).toBeFalse();
    expect(component.selectedProcess).toBeNull();
  });

  it('botón Descargar ausente si tipo no es BACKUP aunque haya backupRef (REQ-UI-DOWNLOAD-01)', () => {
    component.processes = [{ ...mockProcess, tipo: 'DUPLICATE', backupRef: 'ref.zip' }];
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('[icon="pi pi-download"]');
    expect(btn).toBeNull();
  });
});
