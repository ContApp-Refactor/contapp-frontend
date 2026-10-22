import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UnitOfMeasure } from '../models/UnitOfMeasure';

@Injectable({
  providedIn: 'root'
})
export class UnitOfMeasureService {
  
  constructor(private http: HttpClient) { }

  // Método para obtener por Id las unidades de medida
  getUnitOfMeasuresId(id: string, enterpriseId: string): Observable<UnitOfMeasure> {
    const url = `${environment.API_URL}unit-measures/findById/${id}`;
    const params = new HttpParams().set('enterpriseId', enterpriseId);
    return this.http.get<UnitOfMeasure>(url, { params });
  }
}
