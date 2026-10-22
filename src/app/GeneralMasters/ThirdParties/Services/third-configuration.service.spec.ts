import { TestBed } from '@angular/core/testing';

import { ThirdServiceConfigurationService } from './third-configuration.service';

describe('ThirdServiceConfigurationService', () => {
  let service: ThirdServiceConfigurationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThirdServiceConfigurationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
