import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { EnterpriseList } from '../models/EnterpriseList';
import { EnterpriseDetails } from '../models/EnterpriseDetails';
import { LocalStorageMethods } from '../../../Shared/Methods/local-storage.method';
import { CopyProcess } from '../models/CopyProcess';

@Injectable({
  providedIn: 'root',
})
export class EnterpriseService {
  private apiUrl = environment.API_URL + 'enterprises/';
  private localStorageMethods = new LocalStorageMethods();

  constructor(private http: HttpClient) {}

  /** ==================== GET EMPRESAS ==================== */
  // getEnterprisesActive(): Observable<EnterpriseList[]> {
  //   // Devuelve empresas activas (endpoint principal)
  //   return this.http.get<EnterpriseList[]>(this.apiUrl);
  // }

  getEnterprisesActive(
    role: string = 'Profesor',
  ): Observable<EnterpriseList[]> {
    const headers = { 'X-User-Role': role };
    return this.http.get<EnterpriseList[]>(this.apiUrl, { headers });
  }

  searchEnterprises(q: string): Observable<EnterpriseList[]> {
    return this.http.get<EnterpriseList[]>(`${this.apiUrl}search?q=${encodeURIComponent(q)}`);
  }

  getEnterprisesInactive(): Observable<EnterpriseList[]> {
    // Endpoint para empresas inactivas
    return this.http.get<EnterpriseList[]>(`${this.apiUrl}inactive`);
  }

  getEnterpriseById(id: string): Observable<EnterpriseDetails> {
    // Obtener empresa completa por ID
    return this.http.get<EnterpriseDetails>(`${this.apiUrl}enterprise/${id}`);
  }

  getTaxLiabilities(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}taxliabilities`);
  }

  getEnterpriseExportData(id: string): Observable<any> {
    // Retornamos un ejemplo de json de exportación usando RxJS 'of'.
    // const exampleExportData = {
    //   enterpriseId: id,
    //   name: "Empresa Ejemplo",
    // };
    // return of(exampleExportData);
    return this.http.get<any>(`${this.apiUrl}export/${id}`);
  }

  getSelectedEnterprise() {
    return this.localStorageMethods.loadEnterpriseData();
  }

  /** ==================== PUT EMPRESAS  ==================== */
  createEnterprise(
    enterprise: EnterpriseDetails,
  ): Observable<EnterpriseDetails> {
    return this.http.post<EnterpriseDetails>(this.apiUrl, enterprise);
  }

  // Actualiza todos los datos de la empresa
  updateEnterprise(
    id: string,
    enterprise: EnterpriseDetails,
  ): Observable<EnterpriseDetails> {
    return this.http.put<EnterpriseDetails>(
      `${this.apiUrl}update/${id}`,
      enterprise,
    );
  }

  /**
   * Actualiza el tipo de configuración de inventario de una empresa
   * @param id ID de la empresa
   * @param inventoryConfigType Nuevo tipo de configuración de inventario
   * @returns Observable vacío
   */
  updateInventoryConfigType(id: string, inventoryConfigType: 'PEPS' | 'WEIGHTED_AVERAGE'): Observable<void> {
    const url = `${this.apiUrl}inventory-config/${id}`;
    return this.http.patch<void>(url, { inventoryConfigType });
  }

  /**
   * Elimina una empresa
   * @param id ID de la empresa a eliminar
   * @returns Observable vacío
   */
  deleteEnterprise(id: string): Observable<void> {
    const url = `${this.apiUrl}${id}`;
    return this.http.delete<void>(url);

  }
  archiveEnterprise(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}enterprise/${id}`);
  }

  unarchiveEnterprise(id: string): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}enterprise/activate/${id}`, null);
  }

  deleteEnterpriseHard(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}enterprise/hard/${id}`);
  }

  /** ==================== UTILIDADES ==================== */
  // LEGACY — copia local de los datos de empresa en JSON. No relacionado con Hito 6.
  duplicateEnterprise(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}duplicate/${id}`, {});
  }

  // LEGACY — backup local en JSON. No relacionado con los procesos de copia de Hito 6.
  backupEnterprise(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}backup/${id}`, {});
  }

  /** ==================== PROCESOS DE COPIA (Hito 6) ==================== */
  getCopyProcesses(): Observable<CopyProcess[]> {
    return this.http.get<CopyProcess[]>(`${this.apiUrl}copy/processes`);
  }

  startBackupProcess(empresaId: string): Observable<CopyProcess> {
    return this.http.post<CopyProcess>(`${this.apiUrl}copy/processes`, {
      tipo: 'BACKUP',
      empresaOrigen: empresaId,
      generateBackup: true,
    });
  }

  startDuplicateProcess(empresaId: string, destinationName: string): Observable<CopyProcess> {
    return this.http.post<CopyProcess>(`${this.apiUrl}copy/processes`, {
      tipo: 'DUPLICATE',
      empresaOrigen: empresaId,
      empresaDestino: { nombre: destinationName },
      generateBackup: false,
    });
  }

  getCopyProcessStatus(processId: string): Observable<CopyProcess> {
    return this.http.get<CopyProcess>(`${this.apiUrl}copy/processes/${processId}`);
  }

  downloadCopyProcessBackup(id: string): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.apiUrl}copy/processes/${id}/backup`, {
      responseType: 'blob',
      observe: 'response',
    });
  }

  deleteCopyProcess(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}copy/processes/${id}`);
  }

  restoreFromBackup(backupRef: string, empresaDestino: string, inplace = false): Observable<CopyProcess> {
    return this.http.post<CopyProcess>(`${this.apiUrl}copy/restore`, { backupRef, empresaDestino, inplace });
  }

  restoreFromZipUpload(file: File, empresaDestino: string, inplace = false, nombreDestino?: string): Observable<CopyProcess> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('empresaDestino', empresaDestino);
    formData.append('inplace', String(inplace));
    if (nombreDestino) formData.append('nombreDestino', nombreDestino);
    return this.http.post<CopyProcess>(`${this.apiUrl}copy/restore/upload`, formData);
  }

  /** ==================== COMPARTIR EMPRESA ==================== */
  shareEnterprise(payload: {
    enterpriseId: string;
    emails: string[];
    role: string;
  }): Observable<{ notified: string[]; rejected: string[]; notRegistered: string[] }> {
    return this.http.post<{ notified: string[]; rejected: string[]; notRegistered: string[] }>(`${this.apiUrl}share`, payload);
  }

  uploadEnterprisePdf(formData: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}create-from-pdf`, formData);
  }

  //** ==================== LOGO =========================== */
  uploadLogo(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ url: string }>(`${this.apiUrl}upload/logo`, formData);
  }

  extractEnterprisePdf(file: File): Observable<{ content: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ content: string }>(`${this.apiUrl}content-PDF-RUT`, formData);
  }

  /** ==================== RUT DATA (PDF pre-fill) ==================== */
  private rutData: string | null = null;

  setRutData(data: string): void {
    this.rutData = data;
  }

  getRutData(): string | null {
    return this.rutData;
  }

  clearRutData(): void {
    this.rutData = null;
  }
}
