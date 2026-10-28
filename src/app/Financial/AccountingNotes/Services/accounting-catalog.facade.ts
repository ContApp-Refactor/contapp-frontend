import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuxiliaryAccountsApiResponse } from '../../../GeneralMasters/AccountCatalogue/models/ChartAccount';
import { CostCenterService } from '../../../GeneralMasters/CostCenters/services/cost-center.service';
import { DocumentTypesServiceService } from '../../../GeneralMasters/DocumentTypes/services/document-types-service.service';
import { ThirdService } from '../../../GeneralMasters/ThirdParties/Services/third.service';
import { Third } from '../../../GeneralMasters/ThirdParties/models/Third';
import {
  AccountOption,
  CostCenterOption,
  DocumentTypeOption,
  ThirdPartyOption,
} from '../Models/accounting-note.models';

export interface AccountingCatalogs {
  accounts: AccountOption[];
  thirdParties: ThirdPartyOption[];
  costCenters: CostCenterOption[];
  documentTypes: DocumentTypeOption[];
}

@Injectable({ providedIn: 'root' })
export class AccountingCatalogFacade {
  constructor(
    private readonly http: HttpClient,
    private readonly thirdService: ThirdService,
    private readonly costCenterService: CostCenterService,
    private readonly documentTypeService: DocumentTypesServiceService,
  ) {}

  load(enterpriseId: string): Observable<AccountingCatalogs> {
    return forkJoin({
      accounts: this.http.get<AuxiliaryAccountsApiResponse>(
        `${environment.API_URL}accountCatalogue/auxiliary/${enterpriseId}`,
      ).pipe(
        map(response => (response.auxiliaryAccounts ?? [])
          .filter(account => account.status !== false)
          .map(account => ({
            code: account.code,
            name: `${account.code} - ${account.description}`,
            requiresCostCenter: account.costCenter === true,
            requiresThirdParty: account.crossing === true,
          }))),
      ),
      thirdParties: this.thirdService.getActiveThirds(enterpriseId),
      costCenters: this.costCenterService.findActiveAuxiliary(enterpriseId),
      documentTypes: this.documentTypeService.findAll(enterpriseId, 0, 100),
    }).pipe(
      map(({ accounts, thirdParties, costCenters, documentTypes }) => {
        const activeThirdParties: Third[] = thirdParties.content ?? [];

        return {
          accounts,
        thirdParties: activeThirdParties
          .filter(third => third.state !== false)
          .map(third => ({
            name: third.socialReason || `${third.names ?? ''} ${third.lastNames ?? ''}`.trim(),
            identification: String(third.idNumber),
          })),
        costCenters: (costCenters ?? [])
          .filter(center => center.status !== false)
          .map(center => ({
            name: `${center.code} - ${center.name}`,
            code: center.code,
          })),
        documentTypes: (documentTypes.content ?? [])
          .filter(documentType => documentType.status !== false)
          .map(documentType => ({
            label: `${documentType.prefix} - ${documentType.name}`,
            value: documentType.prefix,
          })),
        };
      }),
    );
  }
}
