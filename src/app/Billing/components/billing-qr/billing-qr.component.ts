import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { create } from 'qrcode';

const QUIET_ZONE = 2; // módulos de margen blanco alrededor (el estándar pide 4; 2 basta para escaneo en hoja)

// Código QR vectorial (SVG) y presentacional. Codifica EXACTAMENTE `value`. Se dibuja como un único <path> a partir
// de la matriz de módulos de `qrcode`, así es nítido al imprimir/exportar y no hay que inyectar HTML.
@Component({
  selector: 'app-billing-qr',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (qr(); as q) {
      <svg
        role="img"
        aria-label="Código QR de verificación de la factura"
        data-testid="billing-qr"
        xmlns="http://www.w3.org/2000/svg"
        [attr.viewBox]="q.viewBox"
        [attr.width]="size()"
        [attr.height]="size()"
        shape-rendering="crispEdges"
        style="display: block"
      >
        <rect width="100%" height="100%" fill="#ffffff" />
        <path [attr.d]="q.path" fill="#000000" />
      </svg>
    }
  `,
})
export class BillingQrComponent {
  readonly value = input.required<string>();
  readonly size = input<number>(104); // px

  readonly qr = computed(() => {
    const value = this.value();
    if (!value) return null;
    try {
      const { modules } = create(value, { errorCorrectionLevel: 'M' });
      const n = modules.size;
      let path = '';
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          if (modules.get(y, x)) path += `M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`;
        }
      }
      const total = n + QUIET_ZONE * 2;
      return { path, viewBox: `0 0 ${total} ${total}` };
    } catch (error) {
      console.error('No se pudo generar el código QR', error);
      return null;
    }
  });
}
