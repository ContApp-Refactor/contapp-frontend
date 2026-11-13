import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  imports: [],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css',
})
export class FooterComponent {
  systemName: string = 'ContApp';
  vicerrectoriaName: string = 'Vicerrectoría Académica';
  divisionName: string =
    'División de Tecnologías de la Información y las Comunicaciones';
  version: string = 'Versión 1.0.0';
}
