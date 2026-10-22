// Tipo de documento de Facturación. Venta y compra comparten modelos, APIs y pantallas;
// lo que cambia (textos, prefijos de numeración, rutas) vive en DOCUMENT_KIND_CONFIG.
// Los registros guardados antes de existir `kind` se tratan siempre como 'SALE'.

export type DocumentKind = 'SALE' | 'PURCHASE';

export interface DocumentKindConfig {
  tag: string; // etiqueta corta del tipo: Venta / Compra
  basePath: string; // ruta de la factura: `${basePath}/:id`
  invoicePrefix: string; // prefijo de numeración de la factura
  returnPrefix: string; // prefijo de numeración de la devolución
  counterparty: string; // Cliente / Proveedor
  counterpartyLower: string;
  newInvoiceTitle: string;
  invoiceTitle: string;
  headerHint: string; // texto guía del borrador
  refPriceLabel: string; // columna de referencia del catálogo (precio de venta o costo)
  previewTitle: string; // encabezado de la vista previa de la factura
  invoiceFooter: string; // pie de la vista previa de una factura emitida
  returnTitle: string; // título de la devolución (con número)
  newReturnTitle: string;
  returnPreviewTitle: string; // encabezado de la vista previa de la devolución
  originalInvoiceLabel: string; // referencia a la factura original
  soldLabel: string; // columna "Vendido" / "Comprado"
  noteName: string; // documento que hace de devolución: nota crédito (venta) / nota débito (compra)
  noteShort: string;
}

export const DOCUMENT_KIND_CONFIG: Record<DocumentKind, DocumentKindConfig> = {
  SALE: {
    tag: 'Venta',
    basePath: '/billing/sale',
    invoicePrefix: 'FV-',
    returnPrefix: 'NC-',
    counterparty: 'Cliente',
    counterpartyLower: 'cliente',
    newInvoiceTitle: 'Nueva Factura Venta',
    invoiceTitle: 'Factura de Venta',
    headerHint: 'Completa el cliente y las líneas.',
    refPriceLabel: 'Precio catálogo',
    previewTitle: 'FACTURA DE VENTA',
    invoiceFooter: 'Gracias por su compra.',
    returnTitle: 'Devolución',
    newReturnTitle: 'Nueva devolución',
    returnPreviewTitle: 'DEVOLUCIÓN',
    originalInvoiceLabel: 'Factura original',
    soldLabel: 'Vendido',
    noteName: 'Nota de crédito',
    noteShort: 'nota crédito',
  },
  PURCHASE: {
    tag: 'Compra',
    basePath: '/billing/purchase',
    invoicePrefix: 'FC-',
    returnPrefix: 'DC-',
    counterparty: 'Proveedor',
    counterpartyLower: 'proveedor',
    newInvoiceTitle: 'Nueva Factura Compra',
    invoiceTitle: 'Factura de Compra',
    headerHint: 'Completa el proveedor, el N.º de factura del proveedor y las líneas.',
    refPriceLabel: 'Costo catálogo',
    previewTitle: 'FACTURA DE COMPRA',
    invoiceFooter: 'Factura de compra registrada.',
    returnTitle: 'Devolución de compra',
    newReturnTitle: 'Nueva devolución de compra',
    returnPreviewTitle: 'DEVOLUCIÓN DE COMPRA',
    originalInvoiceLabel: 'Factura de compra original',
    soldLabel: 'Comprado',
    noteName: 'Nota de débito',
    noteShort: 'nota débito',
  },
};

// Opciones del filtro "Tipo" de los listados compartidos
export const KIND_FILTER_OPTIONS: { label: string; value: DocumentKind | null }[] = [
  { label: 'Todas', value: null },
  { label: DOCUMENT_KIND_CONFIG.SALE.tag, value: 'SALE' },
  { label: DOCUMENT_KIND_CONFIG.PURCHASE.tag, value: 'PURCHASE' },
];
