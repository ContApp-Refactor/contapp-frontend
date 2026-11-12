// Números a letras en español de Colombia (escala larga: millón = 10^6, "mil millones" = 10^9, billón = 10^12).
// Utilidad pura, en MAYÚSCULAS, para el "Valor letras" de la factura.

const UNITS = [
  'CERO', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
  'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE',
  'VEINTIOCHO', 'VEINTINUEVE',
];
const TENS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const HUNDREDS = [
  '', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS',
  'OCHOCIENTOS', 'NOVECIENTOS',
];

// Apócope delante de un sustantivo (MIL, MILLONES, PESOS): UNO -> UN, VEINTIUNO -> VEINTIÚN
const apocope = (words: string): string =>
  words.endsWith('VEINTIUNO') ? words.slice(0, -'VEINTIUNO'.length) + 'VEINTIÚN' : words.endsWith('UNO') ? words.slice(0, -1) : words;

// 1..999
function below1000(n: number): string {
  if (n === 100) return 'CIEN';
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(HUNDREDS[h]);
  if (r) {
    if (r < 30) parts.push(UNITS[r]);
    else {
      const t = Math.floor(r / 10);
      const u = r % 10;
      parts.push(u ? `${TENS[t]} Y ${UNITS[u]}` : TENS[t]);
    }
  }
  return parts.join(' ');
}

// 1..999.999
function below1e6(n: number): string {
  const t = Math.floor(n / 1000);
  const r = n % 1000;
  const parts: string[] = [];
  if (t === 1) parts.push('MIL');
  else if (t > 1) parts.push(`${apocope(below1000(t))} MIL`);
  if (r) parts.push(below1000(r));
  return parts.join(' ');
}

// 1..999.999 millones (incluye "MIL MILLONES")
function scaled(n: number, singular: string, plural: string): string {
  return n === 1 ? `UN ${singular}` : `${apocope(below1e6(n))} ${plural}`;
}

/**
 * Entero >= 0 a letras: 21 -> "VEINTIUNO", 1000 -> "MIL", 1000000 -> "UN MILLÓN".
 * Con `apocopado` (delante de un sustantivo): 21 -> "VEINTIÚN", 1 -> "UN".
 */
export function numberToWordsEs(value: number, apocopado = false): string {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`Entero no negativo esperado: ${value}`);
  if (value === 0) return 'CERO';
  const billones = Math.floor(value / 1e12);
  const millones = Math.floor((value % 1e12) / 1e6);
  const resto = value % 1e6;
  const parts: string[] = [];
  if (billones) parts.push(scaled(billones, 'BILLÓN', 'BILLONES'));
  if (millones) parts.push(scaled(millones, 'MILLÓN', 'MILLONES'));
  if (resto) parts.push(below1e6(resto));
  const words = parts.join(' ');
  return apocopado ? apocope(words) : words;
}

/**
 * Total en centavos a letras: 582566000 -> "CINCO MILLONES OCHOCIENTOS VEINTICINCO MIL SEISCIENTOS SESENTA PESOS M/CTE".
 * Con centavos: "... PESOS CON 50/100 M/CTE". Millones exactos llevan "DE" ("UN MILLÓN DE PESOS M/CTE").
 */
export function totalInWords(cents: number): string {
  const abs = Math.abs(Math.round(cents));
  const pesos = Math.floor(abs / 100);
  const centavos = abs % 100;
  const sign = cents < 0 && abs > 0 ? 'MENOS ' : '';
  const words = numberToWordsEs(pesos, true);
  const unit = pesos === 1 ? 'PESO' : pesos >= 1e6 && pesos % 1e6 === 0 ? 'DE PESOS' : 'PESOS';
  const fraction = centavos ? ` CON ${String(centavos).padStart(2, '0')}/100` : '';
  return `${sign}${words} ${unit}${fraction} M/CTE`;
}
