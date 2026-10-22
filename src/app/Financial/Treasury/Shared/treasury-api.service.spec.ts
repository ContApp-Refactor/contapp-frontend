import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { createTreasuryIdempotencyKey, TreasuryApiService } from './treasury-api.service';

describe('TreasuryApiService PP8', () => {
  let service: TreasuryApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(TreasuryApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends every statement filter to the backend', () => {
    service.statement('enterprise-a', 7, '2026-01-01', '2026-08-01', 'FC-9', false).subscribe();
    const request = http.expectOne(req => req.url.endsWith('/treasury/reports/statement'));
    expect(request.request.params.get('enterpriseId')).toBe('enterprise-a');
    expect(request.request.params.get('supplierId')).toBe('7');
    expect(request.request.params.get('from')).toBe('2026-01-01');
    expect(request.request.params.get('to')).toBe('2026-08-01');
    expect(request.request.params.get('invoice')).toBe('FC-9');
    expect(request.request.params.get('active')).toBe('false');
    request.flush({ supplierId: 7, invoiced: 0, paid: 0, pending: 0, invoices: [], vouchers: [] });
  });

  it('sends supplier, account and document filters for aging', () => {
    service.aging('enterprise-a', '2026-08-01', 7, '2205', 'FC-9').subscribe();
    const request = http.expectOne(req => req.url.endsWith('/treasury/reports/aging'));
    expect(request.request.params.get('supplierId')).toBe('7');
    expect(request.request.params.get('accountCode')).toBe('2205');
    expect(request.request.params.get('document')).toBe('FC-9');
    request.flush([]);
  });

  it('uses the caller idempotency key when posting a voucher', () => {
    service.postVoucher(10, 'enterprise-a', 'stable-key').subscribe();
    const request = http.expectOne(req => req.url.endsWith('/payment-vouchers/10/post'));
    expect(request.request.headers.get('Idempotency-Key')).toBe('stable-key');
    request.flush({});
  });

  it('generates an idempotency key when randomUUID is unavailable', () => {
    const key = createTreasuryIdempotencyKey(null);

    expect(key).toMatch(/^treasury-\d+-[a-z0-9]+$/);
  });

  it('posts a voucher with an automatically generated idempotency key', () => {
    service.postVoucher(11, 'enterprise-a').subscribe();
    const request = http.expectOne(req => req.url.endsWith('/payment-vouchers/11/post'));

    expect(request.request.headers.get('Idempotency-Key')).toBeTruthy();
    request.flush({});
  });
});
