import { ExpenseReceiptDetail } from "./ExpenseReceiptDetail";

export interface ExpenseReceiptCreateRequest {
    thirdPartyId: number,
    paymentMethodId: number,
    bankAccountId?: number | null,
    receiptTypeId: number, // Asegúrate que el dropdown entrega el ID numérico
    observations: string,
    enterpriseId: string,
    totalAmount: number,
    details: ExpenseReceiptDetail[];
}
