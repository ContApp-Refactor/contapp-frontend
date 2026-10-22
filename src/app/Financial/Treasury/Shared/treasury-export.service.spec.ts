import { TestBed } from '@angular/core/testing';
import { TreasuryExportService } from './treasury-export.service';

describe('TreasuryExportService', () => {
  let service: TreasuryExportService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TreasuryExportService);
  });

  it('escapes csv cells with commas and quotes', () => {
    expect(service.escapeCsvCell('Proveedor, S.A.')).toBe('"Proveedor, S.A."');
    expect(service.escapeCsvCell('Empresa "ABC"')).toBe('"Empresa ""ABC"""');
    expect(service.escapeCsvCell('simple')).toBe('simple');
  });

  it('builds csv blob with utf-8 bom and header row', async () => {
    const blob = service.buildCsvBlob({
      title: 'Test',
      filename: 'test.csv',
      headers: ['Col A', 'Col B'],
      rows: [['1', '2'], ['3', '4']],
    });

    expect(blob.type).toContain('text/csv');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(bytes[0]).toBe(0xef);
    expect(bytes[1]).toBe(0xbb);
    expect(bytes[2]).toBe(0xbf);
    const text = await blob.text();
    expect(text).toContain('Col A,Col B');
    expect(text).toContain('1,2');
    expect(text).toContain('3,4');
  });

  it('builds pdf blob with non-zero size', () => {
    const blob = service.buildPdfBlob({
      title: 'Reporte de prueba',
      subtitle: 'Subtítulo',
      filename: 'reporte.pdf',
      headers: ['Factura', 'Saldo'],
      rows: [['FC-1', 100000]],
    });

    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(500);
  });

  it('builds multi-section pdf blob', () => {
    const blob = service.buildPdfSectionsBlob('Operaciones', [
      {
        title: 'Obligaciones',
        headers: ['Factura', 'Saldo'],
        rows: [['FC-1', 1000]],
      },
      {
        title: 'Comprobantes',
        headers: ['Número', 'Estado'],
        rows: [['CE-1', 'POSTED']],
      },
    ]);

    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(800);
  });

  it('formats currency and dates for colombia', () => {
    expect(service.formatCurrency(1500000)).toContain('1');
    expect(service.formatDate('2026-08-13')).toMatch(/\d/);
  });

  it('sanitizes filenames', () => {
    expect(service.sanitizeFilename('Estado / Proveedor #1')).toBe('Estado___Proveedor__1');
    expect(service.datedFilename('programacion-pagos', 'csv')).toMatch(/^programacion-pagos-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
