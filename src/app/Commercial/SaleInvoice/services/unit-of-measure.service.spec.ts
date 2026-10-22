import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { UnitOfMeasureService } from './unit-of-measure.service';

describe('UnitOfMeasureService', () => {
  let service: UnitOfMeasureService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(UnitOfMeasureService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should include enterpriseId when requesting a unit of measure', () => {
    service.getUnitOfMeasuresId('1', 'enterprise-a').subscribe();

    const request = http.expectOne(req =>
      req.url.endsWith('unit-measures/findById/1') &&
      req.params.get('enterpriseId') === 'enterprise-a'
    );
    expect(request.request.method).toBe('GET');
    request.flush({ id: 1, abbreviation: 'UND' });
  });
});
