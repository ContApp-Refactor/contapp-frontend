import { NEVER } from 'rxjs';
import { HelpCenterListComponent } from './help-center-list.component';

describe('HelpCenterListComponent PP8 permissions', () => {
  function build(role: string, permissions: string[]) {
    const auth = {
      hasRole: (value: string) => value === role,
      getCurrentUserPermissions: () => permissions,
      requireAnyPermission: () => true
    };
    const modules = { getAllModules: () => NEVER };
    return new HelpCenterListComponent({} as any, modules as any, {} as any, {} as any,
      {} as any, {} as any, auth as any);
  }

  it('allows an administrator only for each explicit HC permission', () => {
    const component = build('Administrador', ['HC#C', 'HC#U', 'HC#CS', 'HC#D']);
    component.ngOnInit();
    expect(component.canCreate).toBeTrue();
    expect(component.canEdit).toBeTrue();
    expect(component.canToggleState).toBeTrue();
    expect(component.canDelete).toBeTrue();
  });

  it('keeps student and professor in consultation mode even if a permission leaks into the token', () => {
    for (const role of ['Estudiante', 'Profesor']) {
      const component = build(role, ['HC#C', 'HC#U', 'HC#CS', 'HC#D']);
      component.ngOnInit();
      expect(component.canCreate).toBeFalse();
      expect(component.canEdit).toBeFalse();
      expect(component.canToggleState).toBeFalse();
      expect(component.canDelete).toBeFalse();
    }
  });
});
