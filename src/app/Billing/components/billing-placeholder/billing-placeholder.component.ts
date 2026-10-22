import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-billing-placeholder',
  templateUrl: './billing-placeholder.component.html',
})
export class BillingPlaceholderComponent {
  title: string = inject(ActivatedRoute).snapshot.data['title'] ?? 'Facturación';
}
