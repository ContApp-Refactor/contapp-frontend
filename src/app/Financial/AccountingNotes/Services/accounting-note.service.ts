import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  AccountingNoteRequest,
  AccountingNoteResponse,
  MovementResponse,
} from '../Models/accounting-note.models';

@Injectable({ providedIn: 'root' })
export class AccountingNoteService {
  private readonly apiUrl =`${environment.API_URL}accountCatalogue/accounting-notes`;

  constructor(private readonly http: HttpClient) {}

  create(request: AccountingNoteRequest): Observable<AccountingNoteResponse> {
    return this.http.post<AccountingNoteResponse>(this.apiUrl, request);
  }

  updateDraft(id: number, request: AccountingNoteRequest): Observable<AccountingNoteResponse> {
    return this.http.put<AccountingNoteResponse>(`${this.apiUrl}/${id}`, request);
  }

  postDraft(id: number, enterpriseId: string): Observable<AccountingNoteResponse> {
    const params = new HttpParams().set('enterpriseId', enterpriseId);
    return this.http.post<AccountingNoteResponse>(`${this.apiUrl}/${id}/post`, {}, { params });
  }

  annul(id: number, enterpriseId: string, originModule: string, reason: string): Observable<AccountingNoteResponse> {
    return this.http.post<AccountingNoteResponse>(`${this.apiUrl}/${id}/annul`, {
      enterpriseId,
      originModule,
      reason,
    });
  }

  getAll(enterpriseId: string): Observable<AccountingNoteResponse[]> {
    const params = new HttpParams().set('enterpriseId', enterpriseId);
    return this.http.get<AccountingNoteResponse[]>(this.apiUrl, { params });
  }

  getById(id: number, enterpriseId: string): Observable<AccountingNoteResponse> {
    const params = new HttpParams().set('enterpriseId', enterpriseId);
    return this.http.get<AccountingNoteResponse>(`${this.apiUrl}/${id}`, { params });
  }

  getMovements(
    accountCode: string,
    enterpriseId: string,
    startDate: string,
    endDate: string,
    thirdPartyId?: string,
    costCenterCode?: string,
    originModule?: string,
  ): Observable<MovementResponse> {
    let params = new HttpParams()
      .set('accountCode', accountCode)
      .set('enterpriseId', enterpriseId)
      .set('startDate', startDate)
      .set('endDate', endDate);
    if (thirdPartyId) params = params.set('thirdPartyId', thirdPartyId);
    if (costCenterCode) params = params.set('costCenterCode', costCenterCode);
    if (originModule) params = params.set('originModule', originModule);
    return this.http.get<MovementResponse>(`${this.apiUrl}/movements`, { params });
  }
}
