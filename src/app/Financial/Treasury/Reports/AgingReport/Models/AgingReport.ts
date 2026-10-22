export interface AgingReportFilter {
  supplierId?: number | null;
  supplierName?: string;
  accountCode?: string | null;
  cutoffDate?: Date;
  document?: string;
  includeDocuments?: boolean;
}

export interface AgingReportLine {
  id: number;
  supplierId: number;
  reference: string;
  accountCode: string;
  accountDescription: string;
  dueDate: string;
  daysOverdue: number;
  totalDue: number;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days91Plus: number;
}

export interface AgingReportResponse {
  reportDate: Date;
  supplierName: string;
  lines: AgingReportLine[];
  totals: {
    totalDue: number;
    current: number;
    days1to30: number;
    days31to60: number;
    days61to90: number;
    days91Plus: number;
  };
}

export interface AccountTypeOption {
  label: string;
  value: string;
}

export interface SupplierOption {
  id: number;
  value: number;
  name: string;
  label: string;
}

export interface DocumentOption {
  label: string;
  value: string;
  supplierId: number;
  accountCode: string;
}

export interface AgingFilterOptions {
  suppliers: SupplierOption[];
  documents: DocumentOption[];
  accounts: AccountTypeOption[];
}

