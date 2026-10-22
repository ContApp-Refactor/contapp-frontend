export interface PurchaseBill {
  id?: number;
  billId: string;
  dateOpened: Date;
  supplierId: number;
  supplierName?: string;
  subtotal: number;
  taxes?: number;
  total: number;
  paidAmount?: number; // Total amount already paid
  pendingBalance?: number; // Remaining balance to pay
  notes?: string;
  status: 'DRAFT' | 'POSTED' | 'PAID' | 'PARTIALLY_PAID' | 'CANCELLED';
  lineItems: PurchaseBillLineItem[];
  enterpriseId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PurchaseBillLineItem {
  id?: number;
  billId?: number;
  date: Date;
  description: string;
  expenseAccountId: number;
  expenseAccountCode?: string;
  expenseAccountName?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number; // quantity * unitPrice
}

export interface PurchaseBillCreateRequest {
  billId: string;
  dateOpened: Date;
  supplierId: number;
  subtotal: number;
  taxes?: number;
  total: number;
  notes?: string;
  lineItems: PurchaseBillLineItemCreateRequest[];
  enterpriseId: string;
}

export interface PurchaseBillLineItemCreateRequest {
  date: Date;
  description: string;
  expenseAccountId: number;
  quantity: number;
  unitPrice: number;
}

export interface PurchaseBillResponse {
  id: number;
  billId: string;
  dateOpened: string; // API returns dates as strings
  supplierId: number;
  subtotal: number;
  taxes: number;
  total: number;
  notes: string;
  status: string;
  lineItems: PurchaseBillLineItemResponse[];
  enterpriseId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseBillLineItemResponse {
  id: number;
  billId: number;
  date: string;
  description: string;
  expenseAccountId: number;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

// Para el dropdown de cuentas de gastos
export interface ExpenseAccount {
  id: number;
  code: string;
  name: string;
  fullName: string; // "code - name"
}

// Para el listado de facturas
export interface PurchaseBillListView {
  id: number;
  billId: string;
  dateOpened: Date;
  supplierId: number;
  supplierName: string;
  total: number;
  paidAmount?: number; // Total amount already paid
  pendingBalance?: number; // Remaining balance to pay
  status: string;
  statusDisplay: string; // Para mostrar en español
}

export interface BillFilterOption {
  label: string;
  value: string | number;
  supplierId?: number;
}
