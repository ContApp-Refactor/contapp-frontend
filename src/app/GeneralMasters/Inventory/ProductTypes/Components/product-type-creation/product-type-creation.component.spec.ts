import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { MessageService } from 'primeng/api';

import { ProductTypeCreationComponent } from './product-type-creation.component';

describe('ProductTypeCreationComponent', () => {
  let component: ProductTypeCreationComponent;
  let fixture: ComponentFixture<ProductTypeCreationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductTypeCreationComponent],
      providers: [provideRouter([]), provideHttpClient(), MessageService]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ProductTypeCreationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('HU1: debería inicializar la clasificación con vendible=true, comprable=true, inventariable=false', () => {
    const form = component.productTypeForm;
    expect(form.get('sellable')?.value).toBeTrue();
    expect(form.get('purchasable')?.value).toBeTrue();
    expect(form.get('inventoryable')?.value).toBeFalse();
  });
});
