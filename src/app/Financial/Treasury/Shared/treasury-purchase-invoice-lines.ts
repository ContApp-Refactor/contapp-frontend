import { PurchaseInvoiceProductLine } from '../../../Commercial/PurchaseInvoice/models/purchase-invoice-payload';

export interface PaidInvoiceLineView {
  productId?: number;
  productLabel: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  taxLabel: string;
  taxAmount: number;
  lineTotal: number;
}

export function mapSkeletonProductsToLineViews(
  products: PurchaseInvoiceProductLine[] | null | undefined,
  productNames?: Map<number, string>,
): PaidInvoiceLineView[] {
  if (!products?.length) {
    return [];
  }
  return products.map((product) => mapSkeletonProductLine(product, productNames));
}

export function mapSkeletonProductLine(
  product: PurchaseInvoiceProductLine,
  productNames?: Map<number, string>,
): PaidInvoiceLineView {
  const quantity = Number(product.amount ?? 0);
  const unitPrice = Number(product.unitPrice ?? 0);
  const subtotal = Number(product.subtotal ?? 0);
  const discountPercent = Number(product.discount ?? 0);
  const gross = unitPrice * quantity;
  const discountAmount = gross > 0 && discountPercent > 0
    ? gross * (discountPercent / 100)
    : 0;
  const taxPercentages = (product.taxPercentage ?? []).map((value) => Number(value)).filter((value) => value > 0);
  const taxLabel = taxPercentages.length
    ? taxPercentages.map((value) => `${value}%`).join(', ')
    : '—';
  const taxAmount = taxPercentages.reduce((sum, percentage) => sum + (subtotal * percentage / 100), 0);
  const productId = product.productId != null ? Number(product.productId) : undefined;
  const resolvedName = productId != null ? productNames?.get(productId) : undefined;
  const description = (product.description ?? '').trim();
  const productLabel = resolvedName
    ?? (description ? description : (productId != null ? `Producto ${productId}` : 'Producto/servicio'));

  return {
    productId,
    productLabel,
    description: description || undefined,
    quantity,
    unitPrice,
    subtotal,
    discountPercent,
    discountAmount,
    taxLabel,
    taxAmount,
    lineTotal: subtotal + taxAmount,
  };
}
