import { environment } from '../../../environments/environment';

/**
 * URL absoluta (o del mismo origen) del logo del emisor. El back devuelve una ruta RELATIVA ("/api/enterprises/logos/<key>");
 * el host/prefijo se toma de `environment.API_URL` quitándole el sufijo "api/":
 *   "/api/"                                      -> "/api/enterprises/logos/<key>"   (proxy / mismo origen)
 *   "http://contables.unicauca.edu.co/dev/api/"  -> "http://contables.unicauca.edu.co/dev/api/enterprises/logos/<key>"
 * Sin logo (null/vacío) devuelve null. Una URL ya absoluta o un data: se respetan tal cual.
 */
export const resolveLogoUrl = (logo: string | null | undefined, apiUrl: string = environment.API_URL): string | null => {
  const value = logo?.trim();
  if (!value) return null;
  if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:')) return value;
  const prefix = apiUrl.replace(/\/?api\/?$/i, '').replace(/\/$/, '');
  return `${prefix}${value.startsWith('/') ? '' : '/'}${value}`;
};
