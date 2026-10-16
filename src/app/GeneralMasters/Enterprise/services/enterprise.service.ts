import { Department } from './../../ThirdParties/models/Department';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { EnterpriseList } from '../models/EnterpriseList';
import { EnterpriseDetails } from '../models/EnterpriseDetails';
import { LocalStorageMethods } from '../../../Shared/Methods/local-storage.method';

export interface TaxLiability {
  id: number;
  name: string;
  taxLiabilitys?: Array<{ id: number; name: string }>;
}

export interface TaxPayerType {
  id: number;
  name: string;
  taxPayerTypes?: Array<{ id: number; name: string }>;
}

export interface EnterpriseType {
  id: number;
  name: string;
}

export interface DepartmentLookup {
  id: number;
  name: string;
}

export interface CountryLookup {
  id: number;
  name: string;
}

export interface CityResponse {
  id: number;
  name: string;
  cities: Array<{ id: number; name: string }>;
}

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
    role: string = 'Profesor'
  ): Observable<EnterpriseList[]> {
    const headers = { 'X-User-Role': role };
    return this.http.get<EnterpriseList[]>(this.apiUrl, { headers });
  }

  getEnterprisesInactive(): Observable<EnterpriseList[]> {
    // Endpoint para empresas inactivas
    return this.http.get<EnterpriseList[]>(`${this.apiUrl}inactive`);
  }

  getEnterpriseById(id: string): Observable<EnterpriseDetails> {
    // Obtener empresa completa por ID
    return this.http.get<EnterpriseDetails>(`${this.apiUrl}enterprise/${id}`);
  }

  getSelectedEnterprise() {
    return this.localStorageMethods.loadEnterpriseData();
  }

  /** ==================== CRUD ==================== */
  createEnterprise(
    enterprise: EnterpriseDetails
  ): Observable<EnterpriseDetails> {
    return this.http.post<EnterpriseDetails>(this.apiUrl, enterprise);
  }

  // Actualiza todos los datos de la empresa
  updateEnterprise(
    id: string,
    enterprise: EnterpriseDetails
  ): Observable<EnterpriseDetails> {
    return this.http.put<EnterpriseDetails>(
      `${this.apiUrl}update/${id}`,
      enterprise
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

  /** ==================== LOOKUP CATALOGS ==================== */

  /** Obtiene las responsabilidades tributarias */
  getTaxLiabilities(): Observable<TaxLiability[]> {
    return this.http.get<TaxLiability[]>(`${this.apiUrl}taxliabilities`);
  }

  /** Obtiene los tipos de contribuyente */
  getTaxPayerTypes(): Observable<TaxPayerType[]> {
    return this.http.get<TaxPayerType[]>(`${this.apiUrl}taxpayertype`);
  }

  /** Obtiene los departamentos */
  getDepartments(): Observable<DepartmentLookup[]> {
    return this.http.get<DepartmentLookup[]>(`${this.apiUrl}address/departments`);
  }

  /** Obtiene las ciudades de un departamento */
  getCities(departmentId: string): Observable<CityResponse> {
    return this.http.get<CityResponse>(`${this.apiUrl}address/cities/${departmentId}`);
  }

  /** Obtiene los países */
  getCountries(): Observable<CountryLookup[]> {
    return this.http.get<CountryLookup[]>(`${this.apiUrl}address/countries`);
  }

  /** Obtiene los tipos de empresa */
  getEnterpriseTypes(): Observable<EnterpriseType[]> {
    return this.http.get<EnterpriseType[]>(`${this.apiUrl}enterprisetypes`);
  }

  /** ==================== UTILIDADES ==================== */
  duplicateEnterprise(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}duplicate/${id}`, {});
  }

  backupEnterprise(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}backup/${id}`, {});
  }

  /** ==================== COMPARTIR EMPRESA ==================== */
  shareEnterprise(payload: {
    enterpriseId: number;
    emails: string[];
  }): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}share`, payload);
  }

  /** ==================== Departamentos ==================== */
  // getDepartaments(): Observable<DepartmentList[]> {
  //   return this.http.get<DepartmentList[]>(this.apiUrl);
  // }

  uploadEnterprisePdf(formData: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}create-from-pdf`, formData);
  }
}
