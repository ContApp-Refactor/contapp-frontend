import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  imports: [],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css',
})
export class FooterComponent {
  systemName: string = 'ContApp';
  // ======================================================================
  // [UNICAUCA] valores originales — referencias a la Universidad del Cauca.
  // Restaurar si el producto vuelve a publicarse bajo la universidad.
  // ======================================================================
  // vicerrectoriaName: string = 'Vicerrectoría Académica';
  // divisionName: string =
  //   'División de Tecnologías de la Información y las Comunicaciones';
  // ====================== [/UNICAUCA] ======================

  // ===== [CONTAPP] versión sin referencias a la universidad =====
  vicerrectoriaName: string = 'Gestión contable';
  divisionName: string = 'Software contable';
  // ===== [/CONTAPP] =====

  version: string = 'Versión 1.0.0';
}
