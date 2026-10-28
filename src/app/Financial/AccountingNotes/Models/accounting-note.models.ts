export interface AccountingNoteDetailRequest {
  accountCode: string;
  thirdPartyDocument?: string | null;
  costCenterCode?: string | null;
  description?: string | null;
  debit: number;
  credit: number;
}

export interface AccountingNoteRequest {
  documentTypeCode: string;
  concept: string;
  date: string;
  enterpriseId: string;
  originModule: string;
  originId: string;
  details: AccountingNoteDetailRequest[];
}

export interface AccountingNoteResponse {
  id: number;
  number: string;
  date: string;
  documentTypeCode: string;
  concept: string;
  enterpriseId: string;
  originModule: string;
  originId: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  details: AccountingNoteDetailResponse[];
  annulledAt?: string | null;
  annulmentReason?: string | null;
}

export interface AccountingNoteDetailResponse {
  accountCode: string;
  thirdPartyDocument?: string | null;
  costCenterCode?: string | null;
  description?: string | null;
  debit: number;
  credit: number;
}

export interface MovementItem {
  noteId: number;
  noteNumber: string;
  date: string;
  documentTypeCode: string;
  concept: string;
  originModule: string;
  originId: string;
  status: string;
  accountCode: string;
  thirdPartyId?: string;
  costCenterCode?: string;
  description?: string;
  debit: number;
  credit: number;
}

export interface MovementResponse {
  previousBalance: number;
  movements: MovementItem[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
}

export interface AccountOption {
  code: string;
  name: string;
  requiresCostCenter: boolean;
  requiresThirdParty: boolean;
}

export interface ThirdPartyOption {
  name: string;
  identification: string;
}

export interface CostCenterOption {
  name: string;
  code: string;
}

export interface DocumentTypeOption {
  label: string;
  value: string;
}
