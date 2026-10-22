import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Subject } from '../models/subjects';

@Injectable({
  providedIn: 'root',
})
export class SubjectService {
  private apiUrl = environment.API_URL + 'enterprises/subjects/';

  constructor(private http: HttpClient) {}

  /** ==================== GET ==================== */
  getAllSubjects(): Observable<Subject[]> {
    // Obtener todas las materias
    return this.http.get<Subject[]>(this.apiUrl);
  }

  getSubjectByCode(code: string): Observable<Subject> {
    // Obtener materia por su código
    return this.http.get<Subject>(`${this.apiUrl}${code}`);
  }

  /** ==================== CREATE ==================== */
  createSubject(subject: Subject): Observable<Subject> {
    // Crear una nueva materia
    return this.http.post<Subject>(this.apiUrl, subject);
  }

  /** ==================== UPDATE ==================== */
  updateSubject(code: string, subject: Subject): Observable<Subject> {
    // Actualizar una materia existente
    return this.http.put<Subject>(`${this.apiUrl}${code}`, subject);
  }

  /** ==================== DELETE ==================== */
  deleteSubject(code: string): Observable<void> {
    // Eliminar materia por código
    return this.http.delete<void>(`${this.apiUrl}${code}`);
  }
}
