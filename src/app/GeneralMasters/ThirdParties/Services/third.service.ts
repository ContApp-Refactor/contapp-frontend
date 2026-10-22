import { HttpClient, HttpParams, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { Third } from '../models/Third';
import { environment } from '../../../../environments/environment';

export interface PageResponse<T> {
  content: T[];
  totalElements?: number;
  totalPages?: number;
  size?: number;
  number?: number;
  page?: {
    totalElements: number;
    totalPages: number;
    size: number;
    number: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ThirdService {
  /** Almacena información del RUT del tercero */
  private infoThirdRUT: string |null=null;

  /** URL base para las operaciones con terceros */
  private readonly thirdApiUrl = environment.API_URL + 'thirds/'

  /**
   * Constructor del servicio
   * @param http Cliente HTTP para realizar peticiones
   */
  constructor(private readonly http: HttpClient) { }

  /**
   * Establece la información del RUT
   * @param info Información del RUT a almacenar
   */
  setInfoThirdRUT(info: string): void {
    this.infoThirdRUT = info;
  }

  /**
   * Obtiene la información almacenada del RUT
   * @returns Información del RUT o null si no existe
   */
  getInfoThirdRUT(): string | null {
    return this.infoThirdRUT;
  }

  /**
   * Limpia la información almacenada del RUT
   */
  clearInfoThirdRUT(): void {
    this.infoThirdRUT = null;
  }

  /**
   * Crea un nuevo tercero en el sistema
   * @param Third Datos del tercero a crear
   * @returns Observable con el tercero creado
   */
  createThird(Third:Third): Observable<Third>{
    return this.http.post<Third>(this.thirdApiUrl,Third).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }

  /**
   * Extrae información del PDF del RUT
   * @param file Archivo PDF del RUT
   * @returns Observable con la información extraída
   */
  ExtractInfoPDFRUT(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<any>(this.thirdApiUrl+"content-PDF-RUT", formData).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }

  /**
   * Actualiza la información de un tercero existente
   * @param Third Datos actualizados del tercero
   * @returns Observable con el tercero actualizado
   */
  UpdateThird(Third:object): Observable<Third>{

    return this.http.post<Third>(this.thirdApiUrl+"update",Third).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtiene la lista paginada de terceros con búsqueda y ordenamiento
   * @param entId ID de la empresa
   * @param numPage Número de página (opcional, default: 0)
   * @param size Tamaño de página (opcional, default: 10)
   * @param sortField Campo de ordenamiento (opcional, default: "names")
   * @param sortOrder Orden asc/desc (opcional, default: "asc")
   * @param search Término de búsqueda (opcional)
   * @returns Observable con la respuesta paginada del backend
   */
  getThirdParties(entId: String, numPage: number = 0, size?: number, sortField: string = "names", sortOrder: string = "asc", search?: string): Observable<PageResponse<Third>> {
    let params = new HttpParams()
      .set('entId', entId.toString())
      .set('numPage', numPage.toString())
      .set('sortField', sortField)
      .set('sortOrder', sortOrder);

    if (size !== undefined) {
      params = params.set('size', size.toString());
    }

    if (search && search.trim()) {
      params = params.set('search', search.trim());
    }

    return this.http.get<PageResponse<Third>>(this.thirdApiUrl, { params });
  }

  /**
   * Obtiene la lista completa de terceros de una empresa
   * @param entId ID de la empresa
   * @returns Observable con la lista de terceros
   */
  getThirdList(entId: String): Observable<Third[]> {
    return this.getThirdParties(entId).pipe(
      map(response => response.content as Third[])
    );
  }

  /**
   * Obtiene un tercero específico por su ID
   * @param thId ID del tercero
   * @param entId ID de la empresa
   * @returns Observable con los datos del tercero
   */
  getThirdPartie(thId: number, entId: string): Observable<Third>{
    return this.http.get<any>(this.thirdApiUrl+`third?thId=${thId}&entId=${entId}`)
  }

  /**
   * Cambia el estado de un tercero
   * @param thId ID del tercero
   * @param entId ID de la empresa
   * @returns Observable con el resultado del cambio de estado
   */
  changeThirdPartieState(thId:number, entId: string): Observable<Third>{
    let params = new HttpParams()
    .set('thId', thId)
    .set('entId', entId);
    return this.http.put<Third>(this.thirdApiUrl,null,{params})
  }

  /**
   * Elimina un tercero del sistema
   * @param thId ID del tercero
   * @param entId ID de la empresa
   * @returns Observable con el resultado de la eliminación
   */
  deleteThird(thId: number, entId: string): Observable<boolean> {
    let params = new HttpParams()
      .set('thirdId', thId)
      .set('entId', entId);
    return this.http.delete<boolean>(this.thirdApiUrl + 'delete', { params }).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }

  /**
   * Descarga la plantilla de importación de terceros con validaciones
   * @param entId ID de la empresa
   * @returns Observable con el Blob del archivo Excel
   */
  downloadThirdTemplate(entId: string): Observable<Blob> {
    let params = new HttpParams().set('entId', entId);
    return this.http.get(this.thirdApiUrl + 'template/excel', {
      params,
      responseType: 'blob'
    }).pipe(
      catchError((error) => {
        return throwError(() => new Error('Error al descargar la plantilla de terceros'));
      })
    );
  }

  /**
   * Exporta los terceros a un archivo Excel
   * @param entId ID de la empresa
   * @param companyName Nombre de la empresa
   * @param status Estado de los terceros (true: activos, false: inactivos, null: todos)
   * @param optionalFields Array con los campos opcionales a incluir
   * @returns Observable con la respuesta HTTP que contiene el archivo Excel
   */
  exportToExcel(entId: string, companyName: string, status: boolean | null, optionalFields: string[]): Observable<any> {
    let params = new HttpParams()
      .set('entId', entId)
      .set('companyName', companyName);

    // Agregar el filtro de estado si está definido
    if (status !== null) {
      params = params.set('status', status.toString());
    }

    // Agregar los campos opcionales si existen
    if (optionalFields && optionalFields.length > 0) {
      optionalFields.forEach(field => {
        params = params.append('optionalFields', field);
      });
    }

    return this.http.get(this.thirdApiUrl + 'export/excel', {
      params,
      responseType: 'blob',
      observe: 'response'
    }).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }

  /**
   * Importa terceros masivamente desde un archivo Excel
   * @param entId ID de la empresa
   * @param file Archivo Excel con los terceros a importar
   * @returns Observable con la respuesta de importación
   */
  importFromExcel(entId: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    let params = new HttpParams().set('entId', entId);

    const url = this.thirdApiUrl + 'import/excel';

    return this.http.post(url, formData, {
      params,
      observe: 'response'
    }).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtiene una lista de terceros activos
   * @param entId ID de la empresa
   * @returns Observable con la lista de terceros activos
   */
  getActiveThirds(entId: string): Observable<PageResponse<Third>> {
    const params = new HttpParams().set('entId', entId);

    return this.http.get<PageResponse<Third>>(`${this.thirdApiUrl}findAllActive`, { params }).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtiene una lista de terceros filtrados por tipo con paginación inteligente
   * @param entId ID de la empresa
   * @param thirdTypeName Nombre del tipo de tercero (case insensitive)
   * @returns Observable con la respuesta paginada de terceros filtrados por tipo
   */
  getThirdsByType(entId: string, thirdTypeName: string): Observable<PageResponse<Third>> {
    let params = new HttpParams()
      .set('entId', entId)
      .set('thirdTypeName', thirdTypeName)
    return this.http.get<PageResponse<Third>>(this.thirdApiUrl + 'by-type', { params }).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }

  /**
   * Cambia el estado de todos los terceros de una empresa de forma masiva
   * @param entId ID de la empresa
   * @param newState Nuevo estado para todos los terceros
   * @returns Observable con la respuesta del cambio masivo
   */
  changeAllThirdsState(entId: string, newState: boolean): Observable<any> {
    let params = new HttpParams()
      .set('entId', entId)
      .set('newState', newState.toString());

    return this.http.patch<any>(`${this.thirdApiUrl}allState`, null, { params }).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }

  /**
   * Inicia una importación asíncrona de terceros desde un archivo Excel.
   * @param entId - El ID de la entidad.
   * @param file - El archivo Excel a importar.
   * @returns Un observable con el jobId para hacer seguimiento de la importación.
   */
  importThirdsAsync(entId: string, file: File): Observable<{ jobId: string; message: string; statusUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);

    let params = new HttpParams().set('entId', entId);

    return this.http.post<{ jobId: string; message: string; statusUrl: string }>(
      `${this.thirdApiUrl}import/excel`,
      formData,
      { params }
    ).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtiene el estado de una importación asíncrona.
   * @param jobId - El ID del trabajo de importación.
   * @returns Un observable con el estado de la importación.
   */
  getImportStatus(jobId: string): Observable<any> {
    return this.http.get(`${this.thirdApiUrl}import/status/${jobId}`).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => error);
      })
    );
  }

  /**
   * Inicia una exportación asíncrona de terceros.
   * @param entId - El ID de la entidad.
   * @param companyName - Nombre opcional de la empresa para el archivo.
   * @param status - Estado del filtro (true=activos, false=inactivos, null=todos).
   * @param optionalFields - Campos opcionales a incluir en la exportación.
   * @returns Un observable con el jobId para hacer seguimiento de la exportación.
   */
  exportThirdsAsync(entId: string, companyName?: string, status?: boolean | null, optionalFields?: string[]): Observable<{ jobId: string; message: string; downloadUrl: string }> {
    let params = new HttpParams().set('entId', entId);

    if (status !== null && status !== undefined) {
      params = params.set('status', status.toString());
    }

    if (companyName && companyName.trim()) {
      params = params.set('companyName', companyName.trim());
    }

    // Agregar los campos opcionales si existen
    if (optionalFields && optionalFields.length > 0) {
      optionalFields.forEach(field => {
        params = params.append('optionalFields', field);
      });
    }

    return this.http.get<{ jobId: string; message: string; downloadUrl: string }>(
      `${this.thirdApiUrl}export/excel`,
      { params }
    ).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtiene el estado de una exportación asíncrona.
   * @param jobId - El ID del trabajo de exportación.
   * @returns Un observable con el estado de la exportación.
   */
  getExportStatus(jobId: string): Observable<any> {
    return this.http.get(`${this.thirdApiUrl}export/status/${jobId}`).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => error);
      })
    );
  }

  /**
   * Descarga el archivo generado de una exportación completada.
   * @param jobId - El ID del trabajo de exportación.
   * @returns Un observable con la respuesta HTTP que contiene el blob del archivo.
   */
  downloadExportFile(jobId: string): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.thirdApiUrl}export/download/${jobId}`, {
      responseType: 'blob',
      observe: 'response'
    }).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => error);
      })
    );
  }
}
