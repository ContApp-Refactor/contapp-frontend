import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';

import { CreateEnterpriseComponent } from './create-enterprise.component';

describe('CreateEnterpriseComponent', () => {
  let component: CreateEnterpriseComponent;
  let enterpriseService: jasmine.SpyObj<any>;

  // Valores minimos del formulario que usa createEnterpriseWithLogo
  const baseForm = (subjects?: string[]) => ({
    name: 'Empresa',
    nit: '900123456',
    dv: '1',
    phone: '3001234567',
    email: 'a@b.co',
    mainActivity: '471100',
    secondaryActivity: '',
    taxLiabilities: [],
    taxPayerType: 1,
    inventoryConfigurationType: 'PEPS',
    enterpriseType: 1,
    legalName: 'Empresa SAS',
    address: 'Calle 1 # 2-3',
    city: 1,
    department: 1,
    country: 1,
    hasBranches: false,
    subjects,
  });

  beforeEach(() => {
    enterpriseService = jasmine.createSpyObj('EnterpriseService', [
      'createEnterprise',
    ]);
    enterpriseService.createEnterprise.and.returnValue(of({}));
    const router = jasmine.createSpyObj('Router', ['navigate']);
    const messageService = jasmine.createSpyObj('MessageService', ['add']);

    component = new CreateEnterpriseComponent(
      new FormBuilder(),
      router,
      enterpriseService,
      {} as any,
      {} as any,
      messageService,
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('el control subjects del formulario arranca como arreglo vacio', () => {
    component.initForm();

    expect(component.enterpriseForm.get('subjects')?.value).toEqual([]);
  });

  it('crear envia el arreglo de ids de todas las materias seleccionadas', () => {
    (component as any).createEnterpriseWithLogo(baseForm(['uuid-1', 'uuid-2']), null);

    const sent = enterpriseService.createEnterprise.calls.mostRecent().args[0];
    expect(sent.subjects).toEqual(['uuid-1', 'uuid-2']);
  });

  it('crear sin materias seleccionadas envia un arreglo vacio', () => {
    (component as any).createEnterpriseWithLogo(baseForm(undefined), null);

    const sent = enterpriseService.createEnterprise.calls.mostRecent().args[0];
    expect(sent.subjects).toEqual([]);
  });
});
