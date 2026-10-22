export interface VendorReportSummary {
  id: number;
  name: string;
  totalDebits: number;
  totalCredits: number;
  currentBalance: number;
  lastTransactionDate: Date;
  transactionCount: number;
}

export interface VendorReportTransaction {
  date: Date;
  dueDate?: Date;
  reference: string;
  documentNumber?: string;
  expenseReceiptNumber?: string;
  type: 'Bill' | 'Payment' | 'PaymentReversal' | 'WriteOff' | 'WriteOffReversal';
  description: string;
  debits: number;
  credits: number;
  balance: number;
  documentStatus: string;
  voided?: boolean;
  informational?: boolean;
}

export interface VendorReport {
  vendor: {
    id: number;
    name: string;
  };
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  transactions: VendorReportTransaction[];
  periodTotals: {
    openingBalance: number;
    periodPayments: number;
    totalDebits: number;
    totalCredits: number;
    writeOffTotal: number;
    netBalance: number;
  };
  totalDue: number;
  agingReport: {
    prePaid: number;
    current: number;
    days0to30: number;
    days31to60: number;
    days61to90: number;
    days91Plus: number;
    total: number;
  };
}

export interface VendorListFilter {
  supplierId?: number;
  dateFrom?: Date;
  dateTo?: Date;
}
