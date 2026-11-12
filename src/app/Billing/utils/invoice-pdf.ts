import type { jsPDF } from 'jspdf';

// Generación del PDF de una factura a partir de su vista previa (el elemento HTML de la hoja).
// html2canvas y jsPDF se cargan en diferido: solo pesan cuando el usuario pulsa "Imprimir".

const MARGEN_MM = 10;
const A4_ANCHO_MM = 210;
const A4_ALTO_MM = 297;
const ESCALA = 2;

/** Nombre del archivo: `<tipo>-<numero|borrador>.pdf`, en minúsculas y sin espacios ni caracteres raros. */
export const invoicePdfFileName = (previewTitle: string, number: string | null | undefined): string => {
  const slug = (texto: string): string =>
    texto
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  const numero = slug(number ?? '');
  return `${slug(previewTitle) || 'factura'}-${numero || 'borrador'}.pdf`;
};

// --- Colores: html2canvas 1.4.1 no entiende oklch()/oklab()/color-mix()/color() (Tailwind 4 y PrimeNG los usan) ---

const COLOR_FN = /(oklch|oklab|lab|lch|color-mix|color)\(/i;

let pixel: CanvasRenderingContext2D | null = null;

/** Convierte cualquier color CSS que el navegador entienda a rgb()/rgba() dibujándolo en un canvas 1x1. */
export const toRgb = (color: string): string => {
  pixel ??= Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', {
    willReadFrequently: true,
  });
  if (!pixel) return color;
  pixel.clearRect(0, 0, 1, 1);
  pixel.fillStyle = '#000000';
  pixel.fillStyle = color; // si el valor no se entiende, queda el negro anterior
  pixel.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = pixel.getImageData(0, 0, 1, 1).data;
  return a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${+(a / 255).toFixed(3)})`;
};

/** Reemplaza cada función de color moderna dentro de un valor CSS (sombras, degradados...) por su rgb(). */
export const replaceModernColors = (value: string): string => {
  let out = '';
  let i = 0;
  while (i < value.length) {
    const m = COLOR_FN.exec(value.slice(i));
    if (!m) {
      out += value.slice(i);
      break;
    }
    const start = i + m.index;
    out += value.slice(i, start);
    let depth = 0;
    let end = start + m[0].length - 1;
    for (; end < value.length; end++) {
      if (value[end] === '(') depth++;
      else if (value[end] === ')' && --depth === 0) break;
    }
    out += toRgb(value.slice(start, end + 1));
    i = end + 1;
  }
  return out;
};

/**
 * Fija inline (con !important) la versión rgb de todo color moderno calculado en el elemento y sus descendientes.
 * Recorre TODAS las propiedades calculadas (no solo color/fondo/borde): html2canvas también lee, p. ej.,
 * -webkit-text-stroke-color o text-emphasis-color, que por defecto heredan el color moderno de Tailwind.
 */
export const flattenModernColors = (root: HTMLElement): void => {
  const view = root.ownerDocument.defaultView;
  if (!view) return;
  const nodos = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];
  for (const nodo of nodos) {
    const estilo = view.getComputedStyle(nodo);
    const cambios: [string, string][] = [];
    for (let i = 0; i < estilo.length; i++) {
      const prop = estilo[i];
      if (prop.startsWith('--')) continue; // variables CSS: html2canvas no las lee
      const valor = estilo.getPropertyValue(prop);
      if (COLOR_FN.test(valor)) cambios.push([prop, replaceModernColors(valor)]);
    }
    for (const [prop, valor] of cambios) nodo.style.setProperty(prop, valor, 'important');
  }
};

/**
 * html2canvas dibuja el texto con otras métricas que el navegador y lo baja dentro de las cajas con fondo
 * (cabeceras azules de tablas y recuadro del título). Se fija un line-height en px (el computado, que es
 * el que ve el usuario) y se compensa el desfase moviendo el texto con position:relative.
 */
export const alinearTextoDeCabeceras = (root: HTMLElement): void => {
  const view = root.ownerDocument.defaultView;
  if (!view) return;
  const cajas = root.querySelectorAll<HTMLElement>('thead th, .bg-primary');
  for (const caja of Array.from(cajas)) {
    const estilo = view.getComputedStyle(caja);
    const tamano = parseFloat(estilo.fontSize) || 12;
    caja.style.lineHeight = `${Math.round(tamano * 1.2)}px`;
    // Menos padding arriba y más abajo: sube el texto sin mover el fondo ni cambiar la altura de la caja
    const desfase = Math.round(tamano * 0.3);
    const arriba = parseFloat(estilo.paddingTop) || 0;
    const abajo = parseFloat(estilo.paddingBottom) || 0;
    caja.style.paddingTop = `${Math.max(0, arriba - desfase)}px`;
    caja.style.paddingBottom = `${abajo + desfase}px`;
  }
};

/**
 * Captura `element` y arma un PDF A4 vertical con márgenes de 10 mm. Si la hoja es más alta que una página,
 * se corta en tantas páginas como hagan falta sin deformar la imagen.
 */
export const buildInvoicePdf = async (element: HTMLElement): Promise<jsPDF> => {
  const [{ default: html2canvas }, { jsPDF: JsPdf }] = await Promise.all([import('html2canvas'), import('jspdf')]);

  const canvas = await html2canvas(element, {
    scale: ESCALA,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    onclone: (_doc, clonado) => {
      // Sin marco: el PDF no lleva sombra, borde ni esquinas redondeadas de la hoja
      clonado.style.boxShadow = 'none';
      clonado.style.borderColor = 'transparent';
      clonado.style.borderRadius = '0';
      flattenModernColors(clonado);
      alinearTextoDeCabeceras(clonado);
    },
  });

  const pdf = new JsPdf({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const anchoUtil = A4_ANCHO_MM - 2 * MARGEN_MM;
  const altoUtil = A4_ALTO_MM - 2 * MARGEN_MM;
  const mmPorPx = anchoUtil / canvas.width;
  const altoPaginaPx = Math.floor(altoUtil / mmPorPx);

  for (let y = 0, pagina = 0; y < canvas.height; y += altoPaginaPx, pagina++) {
    const altoPx = Math.min(altoPaginaPx, canvas.height - y);
    const trozo = Object.assign(document.createElement('canvas'), { width: canvas.width, height: altoPx });
    const ctx = trozo.getContext('2d');
    if (!ctx) throw new Error('No se pudo crear el lienzo para el PDF');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, trozo.width, trozo.height);
    ctx.drawImage(canvas, 0, y, canvas.width, altoPx, 0, 0, canvas.width, altoPx);
    if (pagina > 0) pdf.addPage();
    pdf.addImage(trozo.toDataURL('image/jpeg', 0.95), 'JPEG', MARGEN_MM, MARGEN_MM, anchoUtil, altoPx * mmPorPx);
  }
  return pdf;
};
