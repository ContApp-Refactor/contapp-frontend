/* tslint:disable:no-unused-variable */

import { TestBed, inject } from '@angular/core/testing';
import { TaxService } from './tax.service';

describe('Service: Tax', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TaxService]
    });
  });

  it('should ...', inject([TaxService], (service: TaxService) => {
    expect(service).toBeTruthy();
  }));
});
