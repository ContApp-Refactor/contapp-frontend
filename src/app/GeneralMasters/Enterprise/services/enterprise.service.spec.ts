import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { EnterpriseService } from './enterprise.service';
import { environment } from '../../../../environments/environment';
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

describe('EnterpriseService — Hito 6 copy-process methods', () => {
  let service: EnterpriseService;
  let httpMock: HttpTestingController;
  const baseUrl = environment.API_URL + 'enterprises/';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [EnterpriseService],
    });
    service = TestBed.inject(EnterpriseService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getCopyProcesses GET /enterprises/copy/processes', () => {
    service.getCopyProcesses().subscribe(res => expect(res.length).toBe(1));
    const req = httpMock.expectOne(r => r.url.includes('copy/processes') && r.method === 'GET');
    req.flush([mockProcess]);
  });

  it('downloadCopyProcessBackup GET blob', () => {
    service.downloadCopyProcessBackup('proc-1').subscribe(res => expect(res.body).toBeTruthy());
    const req = httpMock.expectOne(r => r.url.includes('copy/processes/proc-1/backup'));
    req.flush(new Blob(['data']));
  });

  it('restoreFromBackup POST /enterprises/copy/restore', () => {
    service.restoreFromBackup('ref.zip', 'dest').subscribe(res => expect(res.id).toBeDefined());
    const req = httpMock.expectOne(r => r.url.includes('copy/restore') && r.method === 'POST');
    expect(req.request.body).toEqual({ backupRef: 'ref.zip', empresaDestino: 'dest' });
    req.flush(mockProcess);
  });
});
