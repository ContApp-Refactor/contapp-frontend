export interface PurchaseInvoiceProductLine {
  productId: number;
  amount: number;
  description: string;
  discount: number;
  unitPrice: number;
  subtotal: number;
  taxPercentage: number[];
}

export interface PurchaseInvoicePayload {
  factCode: number;
  entId: string;
  thId: number;
  products: PurchaseInvoiceProductLine[];
  totalValue: string;
  totalPay: string;
  pendingValue: string;
  issueDate: string;
  expirationDate?: string;
  factureType: 'PURCHASE';
  inventoryConfigType: 'PEPS' | 'WEIGHTED_AVERAGE';
}
