import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { HttpClient, HttpErrorResponse, HttpParams, HttpResponse } from '@angular/common/http';
import { NatureType } from '../models/NatureType';
import { FinancialStateType } from '../models/FinancialStateType';
import { ClasificationType } from '../models/ClasificationType';
import { Observable, map, catchError, of, throwError } from 'rxjs';
import { Account, AccountCatalogueListRes, ItemAccountCatalogueSearchRes, AccountCatalogueCreateRes, AccountCatalogueUpdateRes, AuxiliaryAccountsApiResponse } from '../models/ChartAccount';


let API_URL = environment.API_URL + 'accountCatalogue/';


@Injectable({
  providedIn: 'root'
})
export class ChartAccountService {


  private readonly apiURL = API_URL

  constructor(private readonly http: HttpClient) { }

  /**
     * Lista predefinida de tipos de naturaleza para las cuentas.
     *
     * @type {NatureType[]} - Un array de objetos que representa los tipos de naturaleza disponibles ('Débito' y 'Crédito'), cada uno con un identificador único.
     */
  listNature: NatureType[] = [
    { id: 1, name: 'Debito' },
    { id: 2, name: 'Credito' }
  ];

  /**
     * Lista predefinida de tipos de estados financieros.
     *
     * @type {FinancialStateType[]} - Un array de objetos que representa los tipos de estados financieros disponibles ('Estado de Resultados' y 'Estado de Situación Financiera'), cada uno con un identificador único.
     */
  listFinancialState: FinancialStateType[] = [
    { id: 1, name: 'Estado de Resultados' },
    { id: 2, name: 'Estado de Situacion Financiero' }
  ];

  /**
     * Lista predefinida de tipos de clasificación financiera.
     *
     * @type {ClasificationType[]} - Un array de objetos que representa los tipos de clasificación disponibles, incluyendo activos, pasivos, patrimonio, ingresos y gastos, cada uno con un identificador único.
     */
  listClasification: ClasificationType[] = [
    { id: 1, name: 'Activo Corriente' },
    { id: 2, name: 'Activo No Corriente' },
    { id: 3, name: 'Pasivo Corriente' },
    { id: 4, name: 'Pasivo No Corriente' },
    { id: 5, name: 'Patrimonio' },
    { id: 6, name: 'Ingresos No Operacionales' },
    { id: 7, name: 'Gastos Operacionales' },
    { id: 8, name: 'Ingresos Operacionales' }
  ];

  /**
     * Obtiene una lista de cuentas para un ID de entidad dado.
     *
     * @param entId - El ID de la entidad para la cual se desean obtener las cuentas.
     * @returns Un observable que emite un array de cuentas.
     */
  getListAccounts(entId: string): Observable<Account[]> {
    return this.http.get<AccountCatalogueListRes[]>(this.apiURL + 'trees/' + entId).pipe(
      map(response => this.convertAccountCatalogueListResToAccount(response, entId))
    );
  }

  /**
   * Obtiene una lista de cuentas auxiliares para un ID de entidad dado.
   * @param entId - El ID de la entidad para la cual se desean obtener las cuentas auxiliares.
   * @returns Un observable que emite un array de cuentas auxiliares.
   */
  getListAuxiliaryAccounts(entId: string): Observable<Account[]> {
    return this.http.get<AuxiliaryAccountsApiResponse>(this.apiURL + 'trees/' + entId).pipe(
      map(response => {
        if (response && Array.isArray(response.auxiliaryAccounts)) {
          return this.convertAccountCatalogueListResToAccount(response.auxiliaryAccounts, entId);
        }
        console.warn('La respuesta de cuentas auxiliares no tiene el formato esperado. Se recibió:', response);
        return [];
      })
    );
  }

  /**
   * Convierte la respuesta del backend AccountCatalogueListRes[] a Account[]
   *
   * @param accountList - Lista de cuentas del backend
   * @param entId - ID de la empresa
   * @returns Array de cuentas convertidas
   */
  private convertAccountCatalogueListResToAccount(accountList: AccountCatalogueListRes[], entId: string): Account[] {
    if (!accountList || accountList.length === 0) {
      return [];
    }

    return accountList.map(item => this.mapAccountCatalogueToAccount(item, entId));
  }

  /**
   * Mapea recursivamente AccountCatalogueListRes a Account
   *
   * @param item - Item del backend
   * @param entId - ID de la empresa
   * @returns Cuenta mapeada
   */
  private mapAccountCatalogueToAccount(item: AccountCatalogueListRes, entId: string): Account {
    return {
      id: item.id,
      idEnterprise: entId,
      code: item.code,
      description: item.description,
      nature: item.nature,
      financialStatus: item.financialStatus,
      classification: item.classification,
      parent: item.parent,
      children: item.children ? item.children.map(child => this.mapAccountCatalogueToAccount(child, entId)) : [],
      showSubAccounts: false,
      crossing: item.crossing,
      costCenter: item.costCenter,
      status: item.status ?? true // Default a true si no está definido
    };
  }

  /**
     * Elimina una cuenta por su ID y empresa.
     *
     * @param id - El ID de la cuenta a eliminar.
     * @param idEnterprise - El ID de la empresa.
     * @returns Un observable que indica si la eliminación fue exitosa.
     */
  deleteAccount(id: string, idEnterprise: string): Observable<void> {
    return this.http.delete<void>(`${this.apiURL}${id}/${idEnterprise}`);
  }

  /**
   * Cambia el estado de una cuenta.
   *
   * @param id - El ID de la cuenta.
   * @param idEnterprise - El ID de la empresa.
   * @param status - El nuevo estado de la cuenta.
   * @returns Un observable que indica si el cambio fue exitoso.
   */
  changeState(id: number, idEnterprise: string, status: boolean): Observable<any> {
    const url = `${this.apiURL}changeState/${id}/${idEnterprise}?status=${status}`;
    return this.http.patch<any>(url, {});
  }

  /**
     * Crea una nueva cuenta.
     *
     * @param account - La cuenta a crear.
     * @returns Un observable de la cuenta creada.
     */
  createAccount(account: Account): Observable<Account> {
    return this.http.post<AccountCatalogueCreateRes>(this.apiURL, account).pipe(
      map(response => this.mapCreateResponseToAccount(response))
    );
  }

  /**
   * Mapea AccountCatalogueCreateRes a Account
   *
   * @param item - Item de respuesta del backend
   * @returns Cuenta mapeada
   */
  private mapCreateResponseToAccount(item: AccountCatalogueCreateRes): Account {
    return {
      id: item.id,
      idEnterprise: item.idEnterprise,
      code: item.code,
      description: item.description,
      nature: item.nature,
      financialStatus: item.financialStatus,
      classification: item.classification,
      parent: item.parent,
      children: [],
      showSubAccounts: false,
      crossing: item.crossing,
      costCenter: item.costCenter,
      status: item.status ?? true // Default a true si no está definido
    };
  }

  /**
     * Actualiza una cuenta existente.
     *
     * @param id - El ID de la cuenta a actualizar.
     * @param account - La información actualizada de la cuenta.
     * @returns Un observable de la cuenta actualizada.
     */
  updateAccount(id?: number, account?: Account): Observable<Account> {
    return this.http.put<AccountCatalogueUpdateRes>(`${this.apiURL}${id}`, account).pipe(
      map(response => this.mapUpdateResponseToAccount(response, account?.idEnterprise || ''))
    );
  }

  /**
   * Mapea AccountCatalogueUpdateRes a Account
   *
   * @param item - Item de respuesta del backend
   * @param entId - ID de la empresa
   * @returns Cuenta mapeada
   */
  private mapUpdateResponseToAccount(item: AccountCatalogueUpdateRes, entId: string): Account {
    return {
      id: item.id,
      idEnterprise: entId,
      code: item.code,
      description: item.description,
      nature: item.nature,
      financialStatus: item.financialStatus,
      classification: item.classification,
      parent: item.parent,
      children: [],
      showSubAccounts: false,
      crossing: item.crossing,
      costCenter: item.costCenter,
      status: item.status ?? true // Default a true si no está definido
    };
  }


  /**
   * Obtiene una cuenta por su código y el ID de entidad.
   * Si la cuenta no existe (404), devuelve null silenciosamente sin errores en consola.
   *
   * @param code - El código de la cuenta a obtener.
   * @param entId - El ID de la entidad a la que pertenece la cuenta.
   * @returns Un observable de la cuenta obtenida o null si no existe.
   */
  getAccountByCode(code: string | number, entId: string): Observable<Account | null> {
    return this.http.get<ItemAccountCatalogueSearchRes>(this.apiURL + 'accountByCode/' + code + '/' + entId).pipe(
      map(response => this.mapItemAccountToAccount(response, entId)),
      catchError((error: HttpErrorResponse) => {
        // Silenciosamente devuelve null para errores 404 (cuenta no encontrada)
        if (error.status === 404) {
          return of(null);
        }
        // Para otros errores, propaga el error
        throw error;
      })
    );
  }


  /**
   * Busca cuentas por código o descripción de forma eficiente.
   * Retorna todas las cuentas que coincidan, ordenadas por código ascendente.
   *
   * @param entId - El ID de la entidad.
   * @param search - El término de búsqueda (código o descripción). Si no se proporciona, retorna todas las cuentas.
   * @returns Un observable con la lista de cuentas que coinciden.
   */
  searchAccounts(entId: string, search?: string): Observable<Account[]> {
    let params = new HttpParams();

    if (search && search.trim()) {
      params = params.set('search', search.trim());
    }

    return this.http.get<ItemAccountCatalogueSearchRes[]>(this.apiURL + 'search/' + entId, { params }).pipe(
      map((response: ItemAccountCatalogueSearchRes[]) => {
        // Mapear cada item de la respuesta a Account
        return response.map((item: ItemAccountCatalogueSearchRes) =>
          this.mapItemAccountToAccount(item, entId)
        );
      }),
      catchError(error => {
        console.error('Error en búsqueda de cuentas:', error);
        throw error;
      })
    );
  }

  /**
   * Verifica si una cuenta existe sin cargar datos completos ni mostrar errores.
   * Usa método HEAD para verificar existencia sin transferir contenido.
   *
   * @param code - El código de la cuenta a verificar.
   * @param entId - El ID de la entidad a la que pertenece la cuenta.
   * @returns Un observable boolean que indica si la cuenta existe.
   */
  checkAccountExists(code: string | number, entId: string): Observable<boolean> {
    // Usamos HEAD para verificar existencia sin cargar el contenido
    return this.http.head(
      this.apiURL + 'accountByCode/' + code + '/' + entId,
      { observe: 'response' }
    ).pipe(
      map(response => response.status === 200), // Si status es 200, la cuenta existe
      catchError((error: HttpErrorResponse) => {
        // Para cualquier error (incluyendo 404), consideramos que no existe
        return of(false);
      })
    );
  }

  /**
   * Mapea ItemAccountCatalogueSearchRes a Account
   *
   * @param item - Item del backend
   * @param entId - ID de la empresa
   * @returns Cuenta mapeada
   */
  private mapItemAccountToAccount(item: ItemAccountCatalogueSearchRes, entId: string): Account {
    return {
      id: item.id,
      idEnterprise: entId,
      code: item.code,
      description: item.description,
      nature: item.nature,
      financialStatus: item.financialStatus,
      classification: item.classification,
      parent: item.parent,
      children: [],
      showSubAccounts: false,
      crossing: item.crossing,
      costCenter: item.costCenter,
      status: item.status
    };
  }

  /**
     * Obtiene la lista de tipos de clasificación.
     *
     * @returns Un array de tipos de clasificación.
     */
  getClasificationType(): ClasificationType[] {
    return this.listClasification;
  }

  /**
 * Obtiene la lista de tipos de naturaleza.
 *
 * @returns Un array de tipos de naturaleza.
 */
  getNatureType(): NatureType[] {
    return this.listNature;
  }

  /**
   * Obtiene la lista de tipos de estados financieros.
   *
   * @returns Un array de tipos de estados financieros.
   */
  getFinancialStateType(): FinancialStateType[] {
    return this.listFinancialState;
  }

  /**
   * Descarga la plantilla de catálogo de cuentas.
   *
   * @param entId - El ID de la entidad para la cual descargar la plantilla.
   * @returns Un observable con la respuesta HTTP que contiene el blob del archivo.
   */
  downloadTemplate(entId: string): Observable<HttpResponse<Blob>> {
    let params = new HttpParams().set('entId', entId);
    return this.http.get(`${this.apiURL}template/excel`, {
      params,
      responseType: 'blob',
      observe: 'response'
    }).pipe(
      catchError((error) => {
        console.error('Error al descargar la plantilla:', error);
        return throwError(() => new Error('Error al descargar la plantilla de catálogo de cuentas'));
      })
    );
  }

  /**
   * Exporta el catálogo de cuentas a formato Excel.
   *
   * @param entId - El ID de la entidad.
   * @param companyName - Nombre opcional de la empresa para el archivo.
   * @param status - Estado del filtro (true=activos, false=inactivos, undefined=todos).
   * @returns Un observable con la respuesta HTTP que contiene el blob del archivo.
   */
  exportAccounts(entId: string, companyName?: string, status?: boolean): Observable<HttpResponse<Blob>> {
    // Construir URL con parámetros query siempre
    const params = new URLSearchParams();

    // Siempre incluir entId como parámetro query (como otros endpoints)
    params.set('entId', entId);

    // Agregar status si está definido (incluyendo false)
    if (status !== undefined && status !== null) {
      params.set('status', status.toString());
    }

    // Agregar companyName si existe
    if (companyName && companyName.trim()) {
      params.set('companyName', companyName.trim());
    }

    const url = `${this.apiURL}export/excel?${params.toString()}`;

    return this.http.get(url, {
      responseType: 'blob',
      observe: 'response'
    }).pipe(
      catchError((error: HttpErrorResponse) => {
        // Re-lanzar el error para que el componente lo maneje
        return throwError(() => error);
      })
    );
  }

  /**
   * Inicia una importación asíncrona de cuentas desde un archivo Excel.
   *
   * @param entId - El ID de la entidad.
   * @param file - El archivo Excel a importar.
   * @returns Un observable con el jobId para hacer seguimiento de la importación.
   */
  importAccountsAsync(entId: string, file: File): Observable<{ jobId: string; message: string; statusEndpoint: string }> {
    const formData = new FormData();
    formData.append('entId', entId);
    formData.append('file', file);

    return this.http.post<{ jobId: string; message: string; statusEndpoint: string }>(
      `${this.apiURL}import/excel`, 
      formData
    ).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtiene el estado de una importación asíncrona.
   *
   * @param jobId - El ID del trabajo de importación.
   * @returns Un observable con el estado de la importación.
   */
  getImportStatus(jobId: string): Observable<any> {
    return this.http.get(`${this.apiURL}import/status/${jobId}`).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => error);
      })
    );
  }

  /**
   * Inicia una exportación asíncrona del catálogo de cuentas.
   *
   * @param entId - El ID de la entidad.
   * @param companyName - Nombre opcional de la empresa para el archivo.
   * @param status - Estado del filtro (true=activos, false=inactivos, undefined=todos).
   * @returns Un observable con el jobId para hacer seguimiento de la exportación.
   */
  exportAccountsAsync(entId: string, companyName?: string, status?: boolean): Observable<{ jobId: string; message: string; statusEndpoint: string }> {
    const params = new URLSearchParams();
    params.set('entId', entId);

    if (status !== undefined && status !== null) {
      params.set('status', status.toString());
    }

    if (companyName && companyName.trim()) {
      params.set('companyName', companyName.trim());
    }

    const url = `${this.apiURL}export/excel?${params.toString()}`;

    return this.http.get<{ jobId: string; message: string; statusEndpoint: string }>(url).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtiene el estado de una exportación asíncrona.
   *
   * @param jobId - El ID del trabajo de exportación.
   * @returns Un observable con el estado de la exportación.
   */
  getExportStatus(jobId: string): Observable<any> {
    return this.http.get(`${this.apiURL}export/status/${jobId}`).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => error);
      })
    );
  }

  /**
   * Descarga el archivo generado de una exportación completada.
   *
   * @param jobId - El ID del trabajo de exportación.
   * @returns Un observable con la respuesta HTTP que contiene el blob del archivo.
   */
  downloadExportFile(jobId: string): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.apiURL}export/download/${jobId}`, {
      responseType: 'blob',
      observe: 'response'
    }).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => error);
      })
    );
  }
}
