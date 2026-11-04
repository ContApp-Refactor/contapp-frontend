import { DatePipe } from '@angular/common';

// Textos planos para los filtros de las tablas de Facturación (p-columnFilter filtra por campo del objeto fila,
// así que las columnas calculadas o con formato se exponen como campos de texto).

const datePipe = new DatePipe('en-US');

/** yyyy-MM-dd -> dd/MM/yyyy (sin pasar por Date para no correr el día por zona horaria). */
export const isoDateText = (iso: string | null | undefined): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};

/** Fecha y hora ISO -> dd/MM/yyyy HH:mm */
export const isoDateTimeText = (iso: string | null | undefined): string =>
  iso ? (datePipe.transform(iso, 'dd/MM/yyyy HH:mm') ?? '') : '';
