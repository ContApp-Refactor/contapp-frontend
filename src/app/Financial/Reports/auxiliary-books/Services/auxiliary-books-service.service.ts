import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiResponse } from '../../../../Core/Model/apiResponseModel';
import { environment } from '../../../../../environments/environment';
import { Criteria } from '../Models/Criteria';
import { ExportAuxiliaryBookRequest } from '../Models/Requests/ExportAuxiliaryBookRequest';
import { GenerateAuxiliaryBookRequest } from '../Models/Requests/GenerateAuxiliaryBookRequest';
import { AuxiliaryBookType } from '../Models/eAuxiliaryBookType';

interface PageableParams {
  page: number;
  size: number;
  sort?: string;
}

type ScheduledReportFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';
type ScheduledReportDeliveryWay = 'DOWNLOAD' | 'EMAIL';

export interface ScheduledReportEmailConfig {
  to: string;
  subjectTemplate?: string | null;
  bodyTemplate?: string | null;
}

export interface ScheduledReportInfoTemplate {
  id: number;
  name: string;
  pathLogotype: string;
  alienation: 'LEFT' | 'CENTER' | 'RIGHT';
  font: string;
  fontSize: number;
  mainColor: string;
}

export interface ScheduledReportUpsertRequest {
  entId: string;
  entName?: string | null;
  userId: number;
  bookType: AuxiliaryBookType;
  criteria: Criteria;
  frequency: ScheduledReportFrequency;
  startAt: string;
  endAt?: string | null;
  createdBy?: string | null;
  deliveryWay: ScheduledReportDeliveryWay;
  emailConfig?: ScheduledReportEmailConfig | null;
  reportFormat?: 'EXCEL' | 'PDF';
  infoReportTemplate?: ScheduledReportInfoTemplate | null;
}

export type CreateScheduledReportRequest = ScheduledReportUpsertRequest;
export type UpdateScheduledReportRequest = ScheduledReportUpsertRequest;

export interface ScheduledReportListItemResponse {
  publicId: string;
  entId?: string;
  userId?: number;
  bookType?: AuxiliaryBookType | string;
  criteria?: Criteria | null;
  frequency?: ScheduledReportFrequency | null;
  startAt?: string | null;
  endAt?: string | null;
  createdBy?: string | null;
  deliveryWay?: ScheduledReportDeliveryWay | null;
  emailConfig?: ScheduledReportEmailConfig | null;
  nextExecutionAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  status?: string | null;
  scheduleId?: string | number | null;
}

export interface ScheduledReportResponse extends ScheduledReportListItemResponse {
  publicId: string;
  entId: string;
  userId: number;
  bookType: AuxiliaryBookType;
  criteria: Criteria;
  frequency: ScheduledReportFrequency;
  startAt: string;
  deliveryWay: ScheduledReportDeliveryWay;
}

export interface ScheduledReportExecutionListItemResponse {
  publicId?: string;
  executionPublicId?: string;
  scheduledReportPublicId?: string;
  auxiliaryBookPublicId?: string | null;
  status?: string | null;
  eventType?: string | null;
  message?: string | null;
  deliveryWay?: ScheduledReportDeliveryWay | null;
  executedAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt?: string | null;
}

interface AuxiliaryBookResponse {
  publicId: string;
  type?: AuxiliaryBookType | string;
  createdAt?: string | null;
  userId?: string | number | null;
  criteria?: Criteria | null;
  deliveryWay?: ScheduledReportDeliveryWay | string | string[] | null;
  frequency?: ScheduledReportFrequency | string | null;
  startAt?: string | null;
  endAt?: string | null;
  scheduleDate?: string | null;
  nextExecutionAt?: string | null;
  email?: string | null;
  scheduleId?: string | number | null;
  [key: string]: unknown;
}

interface AuxiliaryBookRegisterResponse {
  accountingData: unknown[];
  auxiliaryBook: AuxiliaryBookResponse;
  [key: string]: unknown;
}

interface AuxiliaryBookHistoryItemResponse {
  id: number | string;
  state?: string | null;
  eventAt?: string | null;
  scheduleDate?: string | null;
  nextExecutionAt?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  deliveryWay?: ScheduledReportDeliveryWay | string | string[] | null;
  frequency?: ScheduledReportFrequency | string | null;
  email?: string | null;
  scheduleId?: string | number | null;
  weekday?: string | number | null;
  monthDay?: string | number | null;
  auxiliaryBook: AuxiliaryBookResponse;
}

interface AuxiliaryBookHistoryPageResult {
  content: AuxiliaryBookHistoryItemResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

interface AuxiliaryBookLogResponse {
  id?: number | string;
  etypeEvent?: string | null;
  state?: string | null;
  eventAt?: string | null;
  createdAt?: string | null;
  message?: string | null;
  auxiliaryBook?: AuxiliaryBookResponse | null;
  [key: string]: unknown;
}

@Injectable({
  providedIn: 'root',
})
export class AuxiliaryBooksServiceService {
  private readonly auxiliaryBooksApiUrl = `${environment.API_URL}auxiliary-books`;
  private readonly scheduledReportsApiUrl = `${this.auxiliaryBooksApiUrl}/scheduled-reports`;

  constructor(private readonly http: HttpClient) {}

  registerAuxiliaryBook(
    request: GenerateAuxiliaryBookRequest,
  ): Observable<AuxiliaryBookRegisterResponse> {
    return this.http
      .post<
        ApiResponse<AuxiliaryBookRegisterResponse>
      >(`${this.auxiliaryBooksApiUrl}/register`, request)
      .pipe(map((response) => this.unwrapApiResponse(response)));
  }

  exportAuxiliaryBook(request: ExportAuxiliaryBookRequest): Observable<Blob> {
    return this.http.post(`${this.auxiliaryBooksApiUrl}/export`, request, {
      responseType: 'blob',
    });
  }

  getHistoryByEnterprise(
    enterpriseId: string,
    pageable: PageableParams,
  ): Observable<ApiResponse<AuxiliaryBookHistoryPageResult>> {
    let params = new HttpParams()
      .set('enterpriseId', enterpriseId)
      .set('page', pageable.page.toString())
      .set('size', pageable.size.toString());

    if (pageable.sort) {
      params = params.set('sort', pageable.sort);
    }

    return this.http.get<ApiResponse<AuxiliaryBookHistoryPageResult>>(
      `${this.auxiliaryBooksApiUrl}/history`,
      { params },
    );
  }

  getLogsByPublicId(
    auxiliaryBookPublicId: string,
  ): Observable<ApiResponse<AuxiliaryBookLogResponse[]>> {
    const params = new HttpParams().set(
      'auxiliaryBookId',
      auxiliaryBookPublicId,
    );

    return this.http.get<ApiResponse<AuxiliaryBookLogResponse[]>>(
      `${this.auxiliaryBooksApiUrl}/logs`,
      { params },
    );
  }

  createScheduledReport(
    payload: CreateScheduledReportRequest,
  ): Observable<ScheduledReportResponse> {
    return this.http
      .post<
        ApiResponse<ScheduledReportResponse>
      >(this.scheduledReportsApiUrl, payload)
      .pipe(map((response) => this.unwrapApiResponse(response)));
  }

  updateScheduledReport(
    publicId: string,
    payload: UpdateScheduledReportRequest,
  ): Observable<ScheduledReportResponse> {
    return this.http
      .put<
        ApiResponse<ScheduledReportResponse>
      >(`${this.scheduledReportsApiUrl}/${publicId}`, payload)
      .pipe(map((response) => this.unwrapApiResponse(response)));
  }

  cancelScheduledReport(publicId: string): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.scheduledReportsApiUrl}/${publicId}`)
      .pipe(map((response) => this.unwrapApiResponse(response)));
  }

  listScheduledReports(
    entId: string,
  ): Observable<ScheduledReportListItemResponse[]> {
    const params = new HttpParams().set('entId', entId);

    return this.http
      .get<
        ApiResponse<ScheduledReportListItemResponse[]>
      >(this.scheduledReportsApiUrl, { params })
      .pipe(map((response) => this.unwrapApiResponse(response, [])));
  }

  getScheduledReport(publicId: string): Observable<ScheduledReportResponse> {
    return this.http
      .get<
        ApiResponse<ScheduledReportResponse>
      >(`${this.scheduledReportsApiUrl}/${publicId}`)
      .pipe(map((response) => this.unwrapApiResponse(response)));
  }

  listScheduledReportExecutions(
    publicId: string,
    filters?: string | null,
  ): Observable<ScheduledReportExecutionListItemResponse[]> {
    let params = new HttpParams();

    if (filters?.trim()) {
      params = params.set('filters', filters.trim());
    }

    return this.http
      .get<
        ApiResponse<ScheduledReportExecutionListItemResponse[]>
      >(`${this.scheduledReportsApiUrl}/${publicId}/executions`, { params })
      .pipe(map((response) => this.unwrapApiResponse(response, [])));
  }

  private unwrapApiResponse<T>(
    response: ApiResponse<T> | T | null | undefined,
    fallbackValue?: T,
  ): T {
    if (response === null || response === undefined) {
      return fallbackValue as T;
    }

    if (
      typeof response === 'object' &&
      response !== null &&
      'data' in response
    ) {
      return (response.data ?? fallbackValue) as T;
    }

    return response as T;
  }
}
