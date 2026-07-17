import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { environment } from '../../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ScheduledReportDownloadService {
  private readonly http = inject(HttpClient);
  private readonly messageService = inject(MessageService);

  download(publicId: string, executionId: string): void {
    const url = `${environment.API_URL}auxiliary-books/scheduled-reports/${publicId}/executions/${executionId}/download`;
    this.http
      .get(url, { responseType: 'blob', observe: 'response' })
      .subscribe({
        next: (res) => {
          const blob = res.body;
          if (!blob) {
            return;
          }
          const filename =
            this.parseFilename(res.headers.get('content-disposition')) ??
            `report-${executionId}.pdf`;
          const objUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = objUrl;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(objUrl);
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Descarga fallida',
            detail: 'No se pudo generar el reporte programado.',
          });
        },
      });
  }

  private parseFilename(header: string | null): string | null {
    if (!header) return null;
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
    return match ? decodeURIComponent(match[1]) : null;
  }
}
