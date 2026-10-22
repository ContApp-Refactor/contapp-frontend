import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

import { Country } from '../../ThirdParties/models/Country';
import { Department } from '../../ThirdParties/models/Department';
import { CitiesbyDepartmentResponse } from '../models/CitiesbyDepartmentResponse';

@Injectable({
  providedIn: 'root',
})
export class AddressService {

  private apiUrl = environment.API_URL + 'enterprises/address/';

  constructor(private http: HttpClient) {}

  /** ==================== GET PAÍSES ==================== */
  getCountries(): Observable<Country[]> {
    return this.http.get<Country[]>(`${this.apiUrl}countries`);
  }

  /** ==================== GET DEPARTAMENTOS ==================== */
  getDepartmentsByCountry(idCountry: number | string): Observable<Department[]> {
    return this.http.get<Department[]>(
      `${this.apiUrl}countries/${idCountry}/departments`
    );
  }

  /** ==================== GET CIUDADES ==================== */
  getCitiesByDepartment(
    idDepartment: number | string
  ): Observable<CitiesbyDepartmentResponse> {
    return this.http.get<CitiesbyDepartmentResponse>(
      `${this.apiUrl}departments/${idDepartment}/cities`
    );
  }

}
