// Rastro de retorno: permite ir a otra pantalla (p. ej. Productos) y volver a la factura.
// Solo se aceptan rutas internas de Facturación para evitar open redirects.

const ALLOWED_PREFIX = '/billing/';

/** Devuelve la ruta si es un path interno seguro (/billing/...), o null. */
export function safeReturnTo(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value.startsWith(ALLOWED_PREFIX)) return null; // descarta '//evil', 'https://...', etc.
  if (value.startsWith('//') || /[\\\s\u0000-\u001f]/.test(value)) return null;
  if (value.includes('..')) return null;
  return value;
}

/** queryParams para navegar a otra pantalla dejando el rastro de vuelta. */
export function buildReturnQuery(url: string, label = 'factura'): { returnTo: string; returnLabel: string } {
  return { returnTo: url, returnLabel: label };
}
