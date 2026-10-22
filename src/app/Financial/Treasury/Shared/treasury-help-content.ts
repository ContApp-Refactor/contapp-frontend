/** Textos iniciales del popover ? para pantallas de Tesorería (editable en Centro de Ayuda). */
export const TREASURY_HELP = {
  operations: {
    title: 'Operaciones de Tesorería',
    summary:
      'Gestione las obligaciones pendientes con proveedores. Desde aquí puede efectuar pagos, programarlos o registrar bajas de cuentas por pagar.\n\n' +
      'Pagar: registra el pago total o parcial de una obligación pendiente.\n' +
      'Programar: agenda el pago de una obligación para una fecha determinada.\n' +
      'Baja CxP: reduce total o parcialmente una obligación sin realizar un pago, utilizando una cuenta contrapartida.',
    slug: 'tesoreria',
  },
  expenseReceipts: {
    title: 'Comprobantes de Egreso',
    summary:
      'Consulte y gestione los comprobantes generados por pagos a proveedores. Puede revisar su estado, consultar el asiento contable, anular cuando corresponda y exportar la información.',
    slug: 'tesoreria',
  },
  makePayment: {
    title: 'Efectuar pago',
    summary:
      'Genera un comprobante de egreso aplicado a una o varias facturas del proveedor. ' +
      'Seleccione método de pago y, si aplica, la cuenta bancaria exigida por el método.',
    slug: 'tesoreria',
  },
  paymentSchedule: {
    title: 'Programación de Pagos',
    summary:
      'Consulte y gestione los pagos de facturas que fueron programados previamente desde Operaciones de Tesorería. ' +
      'Puede desprogramar pagos pendientes o reintentar las programaciones fallidas.',
    slug: 'tesoreria',
  },
  agingReport: {
    title: 'Antigüedad de saldos',
    summary:
      'Clasifica las obligaciones pendientes por días de vencimiento (corriente, 1-30, 31-60, 61-90 y 91+). ' +
      'Los filtros de proveedor provienen de cuentas por pagar activas.',
    slug: 'tesoreria',
  },
  vendorReports: {
    title: 'Estado de proveedores',
    summary:
      'Resume débitos, créditos y saldo pendiente por proveedor con CxP. ' +
      'El detalle muestra movimientos del período y antigüedad de saldos.',
    slug: 'tesoreria',
  },
  writeOffCounterpartAccount: {
    title: 'Cuenta contrapartida',
    summary:
      'Cuenta contable que explica el reconocimiento de la disminución de la deuda cuando esta no se cancela mediante un pago.\n\n' +
      'En una Baja CxP se disminuye una obligación sin realizar un pago. La Cuenta por Pagar se debita para reducir la deuda y la cuenta contrapartida se acredita según el motivo contable de la baja.\n\n' +
      'Ejemplo del asiento:\n' +
      'CxP                  Débito   $40.000\n' +
      'Cuenta contrapartida Crédito   $40.000\n\n' +
      'La cuenta contrapartida debe seleccionarse de acuerdo con la razón contable de la baja y no representa automáticamente una cuenta bancaria o de caja.\n\n' +
      'Ejemplo práctico: si una obligación de $100.000 se reduce en $40.000 mediante una Baja CxP, el saldo pendiente queda en $60.000 sin que exista salida de dinero.',
    slug: 'tesoreria',
  },
} as const;

export const ACCOUNT_CATALOGUE_HELP = {
  title: 'Catálogo de Cuentas PUC',
  summary:
    'El Plan Único de Cuentas (PUC) es una herramienta contable que organiza y clasifica sistemáticamente las cuentas según su naturaleza y función. ' +
    'Permite estructurar la información financiera de manera jerárquica mediante clases, grupos, cuentas y subcuentas para un registro contable preciso y estandarizado.',
  slug: 'configuracion',
} as const;

export const PAYMENT_METHODS_HELP = {
  title: 'Métodos de pago',
  summary:
    'Cada método se asocia a una cuenta contable del catálogo. La opción «Requiere cuenta bancaria al pagar» obliga a seleccionar una cuenta bancaria en Tesorería al efectuar el pago.',
  slug: 'configuracion',
} as const;
