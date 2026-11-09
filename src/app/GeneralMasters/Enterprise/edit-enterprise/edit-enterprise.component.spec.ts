import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';

import { EditEnterpriseComponent } from './edit-enterprise.component';

describe('EditEnterpriseComponent', () => {
  let component: EditEnterpriseComponent;
  let enterpriseService: jasmine.SpyObj<any>;

  beforeEach(() => {
    enterpriseService = jasmine.createSpyObj('EnterpriseService', [
      'updateEnterprise',
      'uploadLogo',
    ]);
    enterpriseService.updateEnterprise.and.returnValue(of({}));
    const router = jasmine.createSpyObj('Router', ['navigate']);
    const messageService = jasmine.createSpyObj('MessageService', ['add']);

    const fb = new FormBuilder();
    component = new EditEnterpriseComponent(
      fb,
      router,
      enterpriseService,
      {} as any,
      {} as any,
      {} as any,
      messageService,
    );
    component.enterpriseId = '1';
    component.enterpriseData = {
      name: 'Empresa',
      logo: '/api/enterprises/logos/abc123',
      taxLiabilities: [],
    } as any;
    component.enterpriseForm = fb.group({ name: ['Empresa'] });
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('conserva el logo existente (ruta relativa) al guardar sin archivo nuevo', () => {
    component.selectedFile = null;

    component.onSubmit();

    const sent = enterpriseService.updateEnterprise.calls.mostRecent().args[1];
    expect(sent.logo).toBe('/api/enterprises/logos/abc123');
  });

  it('envia la URL nueva cuando se selecciona un archivo', () => {
    component.selectedFile = new File(['x'], 'logo.png', { type: 'image/png' });
    enterpriseService.uploadLogo.and.returnValue(
      of({ url: '/api/enterprises/logos/nuevo' }),
    );

    component.onSubmit();

    const sent = enterpriseService.updateEnterprise.calls.mostRecent().args[1];
    expect(sent.logo).toBe('/api/enterprises/logos/nuevo');
  });

  describe('materias asociadas', () => {
    const materias = [
      { id: 'uuid-1', code: 'M1', name: 'Contabilidad' },
      { id: 'uuid-2', code: 'M2', name: 'Costos' },
    ];

    beforeEach(() => {
      component.enterpriseData = {
        name: 'Empresa',
        logo: null,
        taxLiabilities: [],
        subjects: materias,
      } as any;
      component.initForm();
    });

    it('carga los ids de las materias de la empresa en el multiselect al abrir', () => {
      expect(component.enterpriseForm.get('subjects')?.value).toEqual([
        'uuid-1',
        'uuid-2',
      ]);
    });

    it('sin tocar el control envia las materias existentes', () => {
      component.onSubmit();

      const sent = enterpriseService.updateEnterprise.calls.mostRecent().args[1];
      expect(sent.subjects).toEqual(['uuid-1', 'uuid-2']);
    });

    it('vaciar la seleccion envia [] y no reenvia las originales', () => {
      component.enterpriseForm.get('subjects')?.setValue([]);

      component.onSubmit();

      const sent = enterpriseService.updateEnterprise.calls.mostRecent().args[1];
      expect(sent.subjects).toEqual([]);
    });

    it('envia el nuevo conjunto de ids seleccionado', () => {
      component.enterpriseForm.get('subjects')?.setValue(['uuid-2']);

      component.onSubmit();

      const sent = enterpriseService.updateEnterprise.calls.mostRecent().args[1];
      expect(sent.subjects).toEqual(['uuid-2']);
    });
  });
});
