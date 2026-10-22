import { Pipe, PipeTransform } from '@angular/core';
import { formatCop } from '../utils/money';

// Muestra centavos como pesos colombianos (es-CO)
@Pipe({ name: 'copCents' })
export class CopCentsPipe implements PipeTransform {
  transform(cents: number | null | undefined): string {
    return formatCop(cents ?? 0);
  }
}
