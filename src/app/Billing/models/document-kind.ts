// Tipo de documento de Facturación. Venta y compra comparten modelos, APIs y pantallas;
// lo que cambia (textos, prefijos de numeración, rutas) vive en DOCUMENT_KIND_CONFIG.
// Los registros guardados antes de existir `kind` se tratan siempre como 'SALE'.

export type DocumentKind = 'SALE' | 'PURCHASE';

export type WithholdingCode = 'RETE_IVA' | 'RETE_ICA' | 'RETE_FUENTE' | 'AUTO_RENTA';
export interface WithholdingOption {
  code: WithholdingCode;
  label: string;
}

const BASE_WITHHOLDINGS: readonly WithholdingOption[] = [
  { code: 'RETE_IVA', label: 'ReteIVA' },
  { code: 'RETE_ICA', label: 'ReteICA' },
  { code: 'RETE_FUENTE', label: 'ReteFuente' },
];

export interface DocumentKindConfig {
  withholdings: readonly WithholdingOption[]; // retenciones seleccionables en la factura
  tag: string; // etiqueta corta del tipo: Venta / Compra
  basePath: string; // ruta de la factura: `${basePath}/:id`
  invoicePrefix: string; // prefijo de numeración de la factura
  returnPrefix: string; // prefijo de numeración de la devolución
  counterparty: string; // Cliente / Proveedor
  counterpartyLower: string;
  newButtonLabel: string; // botón del hub: Nueva venta / Nueva compra
  newInvoiceTitle: string; // documento nuevo (aún sin abrir uno guardado)
  draftInvoiceTitle: string; // borrador existente en edición
  invoiceTitle: string; // factura emitida o anulada
  headerHint: string; // texto guía del borrador
  refPriceLabel: string; // columna de referencia del catálogo (precio de venta o costo)
  previewTitle: string; // encabezado de la vista previa de la factura (también nombra el archivo PDF)
  sheetTitle: string; // título del recuadro de la hoja de la factura
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
    withholdings: [...BASE_WITHHOLDINGS, { code: 'AUTO_RENTA', label: 'AutoRenta' }], // AutoRenta solo en venta
    basePath: '/billing/sale',
    invoicePrefix: 'FV-',
    returnPrefix: 'NC-',
    counterparty: 'Cliente',
    counterpartyLower: 'cliente',
    newButtonLabel: 'Nueva venta',
    newInvoiceTitle: 'Nueva factura de venta',
    draftInvoiceTitle: 'Borrador de factura de venta',
    invoiceTitle: 'Factura de venta',
    headerHint: 'Completa el cliente y los ítems.',
    refPriceLabel: 'Precio catálogo',
    previewTitle: 'FACTURA DE VENTA',
    sheetTitle: 'FACTURA DE VENTA',
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
    withholdings: BASE_WITHHOLDINGS,
    basePath: '/billing/purchase',
    invoicePrefix: 'FC-',
    returnPrefix: 'DC-',
    counterparty: 'Proveedor',
    counterpartyLower: 'proveedor',
    newButtonLabel: 'Nueva compra',
    newInvoiceTitle: 'Nueva factura de compra',
    draftInvoiceTitle: 'Borrador de factura de compra',
    invoiceTitle: 'Factura de compra',
    headerHint: 'Completa el proveedor, el N.º de factura del proveedor y los ítems.',
    refPriceLabel: 'Costo catálogo',
    previewTitle: 'FACTURA DE COMPRA',
    sheetTitle: 'FACTURA DE COMPRA',
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
