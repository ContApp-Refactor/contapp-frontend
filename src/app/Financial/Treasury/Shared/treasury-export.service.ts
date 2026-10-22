import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface TreasuryExportSection {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

export interface TreasuryExportOptions {
  title: string;
  subtitle?: string;
  filename: string;
  headers: string[];
  rows: (string | number)[][];
  orientation?: 'portrait' | 'landscape';
}

@Injectable({ providedIn: 'root' })
export class TreasuryExportService {
  downloadCsv(options: TreasuryExportOptions): void {
    this.triggerBrowserDownload(this.buildCsvBlob(options), this.ensureExtension(options.filename, 'csv'));
  }

  buildCsvBlob(options: TreasuryExportOptions): Blob {
    const lines = [options.headers.map((cell) => this.escapeCsvCell(cell)).join(',')];
    for (const row of options.rows) {
      lines.push(row.map((cell) => this.escapeCsvCell(cell)).join(','));
    }
    return new Blob(['\uFEFF' + lines.join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    });
  }

  downloadCsvSections(filename: string, sections: TreasuryExportSection[]): void {
    const lines: string[] = [];
    sections.forEach((section, index) => {
      if (index > 0) lines.push('');
      lines.push(this.escapeCsvCell(section.title));
      lines.push(section.headers.map((cell) => this.escapeCsvCell(cell)).join(','));
      for (const row of section.rows) {
        lines.push(row.map((cell) => this.escapeCsvCell(cell)).join(','));
      }
    });
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    this.triggerBrowserDownload(blob, this.ensureExtension(filename, 'csv'));
  }

  downloadPdf(options: TreasuryExportOptions): void {
    this.triggerBrowserDownload(this.buildPdfBlob(options), this.ensureExtension(options.filename, 'pdf'));
  }

  buildPdfBlob(options: TreasuryExportOptions): Blob {
    return this.buildPdfDoc(options).output('blob');
  }

  private buildPdfDoc(options: TreasuryExportOptions): jsPDF {
    const doc = new jsPDF({
      orientation: options.orientation ?? 'landscape',
      unit: 'pt',
      format: 'a4',
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(options.title, 40, 36);

    let startY = 54;
    if (options.subtitle) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(options.subtitle, 40, startY);
      startY += 16;
    }

    doc.setFontSize(10);
    doc.text(`Generado: ${this.formatDate(new Date())}`, 40, startY);
    startY += 12;

    autoTable(doc, {
      startY: startY + 8,
      theme: 'grid',
      head: [options.headers],
      body: options.rows.map((row) => row.map((cell) => String(cell ?? ''))),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [0, 86, 179], textColor: 255 },
    });

    return doc;
  }

  downloadPdfSections(
    title: string,
    filename: string,
    sections: TreasuryExportSection[],
    orientation: 'portrait' | 'landscape' = 'landscape',
  ): void {
    this.triggerBrowserDownload(
      this.buildPdfSectionsBlob(title, sections, orientation),
      this.ensureExtension(filename, 'pdf'),
    );
  }

  buildPdfSectionsBlob(
    title: string,
    sections: TreasuryExportSection[],
    orientation: 'portrait' | 'landscape' = 'landscape',
  ): Blob {
    return this.buildPdfSectionsDoc(title, sections, orientation).output('blob');
  }

  private buildPdfSectionsDoc(
    title: string,
    sections: TreasuryExportSection[],
    orientation: 'portrait' | 'landscape' = 'landscape',
  ): jsPDF {
    const doc = new jsPDF({ orientation, unit: 'pt', format: 'a4' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(title, 40, 36);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Generado: ${this.formatDate(new Date())}`, 40, 52);

    let startY = 68;
    sections.forEach((section, index) => {
      if (index > 0) startY += 16;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(section.title, 40, startY);
      startY += 10;

      autoTable(doc, {
        startY,
        theme: 'grid',
        head: [section.headers],
        body: section.rows.map((row) => row.map((cell) => String(cell ?? ''))),
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [0, 86, 179], textColor: 255 },
      });

      startY = ((doc as any).lastAutoTable?.finalY ?? startY) + 8;
    });

    return doc;
  }

  formatDate(date: Date | string): string {
    return new Intl.DateTimeFormat('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(date));
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  }

  sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  datedFilename(prefix: string, ext: string): string {
    return `${this.sanitizeFilename(prefix)}-${new Date().toISOString().slice(0, 10)}.${ext}`;
  }

  escapeCsvCell(value: string | number | null | undefined): string {
    const text = String(value ?? '');
    if (/[",\r\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  private ensureExtension(filename: string, ext: string): string {
    const normalized = filename.trim();
    if (normalized.toLowerCase().endsWith(`.${ext}`)) {
      return normalized;
    }
    return `${normalized}.${ext}`;
  }

  triggerBrowserDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 40_000);
  }
}
