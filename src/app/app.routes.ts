import { Routes } from '@angular/router';
import { StyleGuideComponent } from './Shared/Components/style-guide/style-guide.component';
import { LoginComponent } from './Core/auth/login/login.component';
import { ForgotPasswordComponent } from './Core/auth/forgot-password/forgot-password.component';
import { RegisterComponent } from './Core/auth/register/register.component';
import { ResetPasswordComponent } from './Core/auth/reset-password/reset-password.component';
import { ListEnterpriseComponent } from './GeneralMasters/Enterprise/list-enterprise/list-enterprise.component';
import { EditEnterpriseComponent } from './GeneralMasters/Enterprise/edit-enterprise/edit-enterprise.component';
import { CreateEnterpriseComponent } from './GeneralMasters/Enterprise/create-enterprise/create-enterprise.component';
import { ArchiveEnterpriseComponent } from './GeneralMasters/Enterprise/archive-enterprise/archive-enterprise.component';
import { hasRoleChildGuard, hasRoleGuard } from './Core/Guards/has-role.guard';
import { MainTemplateComponent } from './Core/Components/MainTemplate/main-template.component';
import { ViewEnterpriseComponent } from './GeneralMasters/Enterprise/view-enterprise/view-enterprise.component';
import { Breadcrumb } from 'primeng/breadcrumb';
import { hasPermissionGuard } from './Core/Guards/has-permission.guard';
import {
  isAuthenticatedChildGuard,
  isAuthenticatedGuard,
} from './Core/Guards/is-authenticated.guard';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
  },
  {
    path: 'register',
    component: RegisterComponent,
  },
  {
    path: 'forgot-password',
    component: ForgotPasswordComponent,
  },
  {
    path: 'reset-password',
    component: ResetPasswordComponent,
  },
  {
    path: 'enterprise/list',
    canActivate: [isAuthenticatedGuard],
    data: {
      breadcrumb: 'enterprise-list',
    },
    component: ListEnterpriseComponent,
  },
  {
    path: 'enterprise/archive',
    canActivate: [isAuthenticatedGuard],
    data: {
      breadcrumb: 'enterprise-archive',
    },
    component: ArchiveEnterpriseComponent,
  },
  {
    path: 'enterprise/create',
    data: {
      breadcrumb: 'enterprise-create',
    },
    loadComponent: () =>
      import(
        './GeneralMasters/Enterprise/create-enterprise/create-enterprise.component'
      ).then((m) => m.CreateEnterpriseComponent),
  },
  {
    path: 'enterprise/edit',
    data: {
      breadcrumb: 'enterprise-edit',
    },
    loadComponent: () =>
      import(
        './GeneralMasters/Enterprise/edit-enterprise/edit-enterprise.component'
      ).then((m) => m.EditEnterpriseComponent),
  },
  {
    path: 'enterprise/copy-processes',
    canActivate: [isAuthenticatedGuard],
    data: {
      breadcrumb: 'enterprise-copy-processes',
    },
    loadComponent: () =>
      import(
        './GeneralMasters/Enterprise/copy-processes/copy-process-list.component'
      ).then((m) => m.CopyProcessListComponent),
  },
  {
    path: 'enterprise/copy-processes/:id',
    canActivate: [isAuthenticatedGuard],
    data: {
      breadcrumb: 'enterprise-copy-process-detail',
    },
    loadComponent: () =>
      import(
        './GeneralMasters/Enterprise/copy-processes/copy-process-detail/copy-process-detail.component'
      ).then((m) => m.CopyProcessDetailComponent),
  },
  {
    path: 'subjects/list',
    data: {
      breadcrumb: 'subjects-list',
    },
    loadComponent: () =>
      import(
        './GeneralMasters/Subjects/list-subjects/list-subjects.component'
      ).then((m) => m.ListSubjectsComponent),
  },
  {
    path: '',
    component: MainTemplateComponent,
    canActivate: [isAuthenticatedChildGuard],
    data: {
      breadcrumb: 'Home',
    },
    children: [
      {
        path: 'configuration',
        data: { breadcrumb: 'Configuración' },
        canActivate: [hasRoleChildGuard],
        children: [
          {
            path: '',
            pathMatch: 'full',
            data: {
              breadcrumb: null,
            },
            loadComponent: () =>
              import(
                './Configuration/Components/configuration-main/configuration-main.component'
              ).then((m) => m.ConfigurationMainComponent),
          },
          {
            path: 'users/list',
            data: { breadcrumb: 'Usuarios' },
            loadComponent: () =>
              import(
                './Configuration/Users/Components/user-list/user-list.component'
              ).then((m) => m.UserListComponent),
          },
          {
            path: 'users/create',
            data: { breadcrumb: 'Crear usuario' },
            loadComponent: () =>
              import(
                './Configuration/Users/Components/user-create/user-create.component'
              ).then((m) => m.UserCreateComponent),
          },
          {
            path: 'users/edit/:id',
            data: { breadcrumb: 'Editar usuario' },
            loadComponent: () =>
              import(
                './Configuration/Users/Components/user-edit/user-edit.component'
              ).then((m) => m.UserEditComponent),
          },
          {
            path: 'profiles',
            data: {
              breadcrumb: 'Gestión de Perfiles',
            },
            children: [
              {
                path: 'list',
                data: { breadcrumb: null },
                loadComponent: () =>
                  import(
                    './Configuration/Profiles/Components/profile-list/profile-list.component'
                  ).then((m) => m.ProfileListComponent),
              },
              {
                path: 'create',
                data: { breadcrumb: 'Crear Perfil' },
                loadComponent: () =>
                  import(
                    './Configuration/Profiles/Components/profile-create/profile-create.component'
                  ).then((m) => m.ProfileCreateComponent),
              },
              {
                path: 'edit/:id',
                data: { breadcrumb: 'Editar Perfil' },
                loadComponent: () =>
                  import(
                    './Configuration/Profiles/Components/profile-edit/profile-edit.component'
                  ).then((m) => m.ProfileEditComponent),
              },
            ],
          },
          {
            path: 'permissions',
            data: {
              breadcrumb: 'Gestión de Permisos',
            },
            children: [
              {
                path: 'list',
                data: { breadcrumb: null },
                loadComponent: () =>
                  import(
                    './Configuration/Permissions/Components/permission-list/permission-list.component'
                  ).then((m) => m.PermissionListComponent),
              },
              {
                path: 'create',
                data: { breadcrumb: 'Asignar Permisos a un Perfil' },
                loadComponent: () =>
                  import(
                    './Configuration/Permissions/Components/permission-create/permission-create.component'
                  ).then((m) => m.PermissionCreateComponent),
              },
              {
                path: 'edit/:role',
                data: { breadcrumb: 'Editar Permisos del Perfil' },
                loadComponent: () =>
                  import(
                    './Configuration/Permissions/Components/permission-edit/permission-edit.component'
                  ).then((m) => m.PermissionEditComponent),
              },
            ],
          },
          {
            path: 'audit',
            data: {
              breadcrumb: 'Auditoría',
            },
            children: [
              {
                path: '',
                pathMatch: 'full',
                data: {
                  breadcrumb: null,
                },
                loadComponent: () =>
                  import(
                    './Audit/Components/audit-hub/audit-hub.component'
                  ).then((m) => m.AuditHubComponent),
              },
              {
                path: 'sessions',
                data: { breadcrumb: 'Sesiones' },
                loadComponent: () =>
                  import(
                    './Audit/Components/audit-session/audit-session.component'
                  ).then((m) => m.AuditSessionComponent),
              },
              {
                path: 'operations',
                data: { breadcrumb: 'Operaciones' },
                loadComponent: () =>
                  import(
                    './Audit/Components/audit-operations/audit-operations.component'
                  ).then((m) => m.AuditOperationsComponent),
              },
              {
                path: 'documents',
                data: { breadcrumb: 'Documentos Contables' },
                loadComponent: () =>
                  import(
                    './Audit/Components/audit-accounting-documents/audit-accounting-documents.component'
                  ).then((m) => m.AuditAccountingDocumentsComponent),
              },
              {
                path: 'consecutives',
                data: { breadcrumb: 'Consecutivos' },
                loadComponent: () =>
                  import(
                    './Audit/Components/audit-consecutive/audit-consecutive.component'
                  ).then((m) => m.AuditConsecutiveComponent),
              },
            ],
          },
        ],
      },
      {
        path: 'home',
        component: ViewEnterpriseComponent,
      },

      {
        path: 'gen-masters',
        data: {
          breadcrumb: 'Maestros Generales',
        },
        children: [
          {
            path: '',
            redirectTo: 'menu',
            pathMatch: 'full',
          },
          {
            path: 'menu',
            data: {
              breadcrumb: null,
            },
            loadComponent: () =>
              import(
                './GeneralMasters/Components/MenuCards/menu.component'
              ).then((m) => m.MenuComponent),
          },
          {
            path: 'subjects',
            data: {
              breadcrumb: 'Materias',
            },
            children: [
              {
                path: '',
                redirectTo: 'list',
                pathMatch: 'full',
              },
              {
                path: 'list',
                data: {
                  breadcrumb: null,
                },
                loadComponent: () =>
                  import(
                    './GeneralMasters/Subjects/list-subjects/list-subjects.component'
                  ).then((m) => m.ListSubjectsComponent),
              },
              {
                path: 'create',
                data: {
                  breadcrumb: 'Crear Materia',
                },
                loadComponent: () =>
                  import(
                    './GeneralMasters/Subjects/create-subjects/create-subjects.component'
                  ).then((m) => m.CreateSubjectsComponent),
              },
              {
                path: 'edit/:code',
                data: {
                  breadcrumb: 'Editar Materia',
                },
                loadComponent: () =>
                  import(
                    './GeneralMasters/Subjects/edit-subjects/edit-subjects.component'
                  ).then((m) => m.EditSubjectsComponent),
              },
            ],
          },
          {
            path: 'account-catalogue',
            data: {
              breadcrumb: 'Catálogo de Cuentas',
            },
            loadComponent: () =>
              import(
                './GeneralMasters/AccountCatalogue/components/account-list/account-list.component'
              ).then((m) => m.AccountListComponent),
          },
          {
            path: 'cost-centers',
            data: {
              breadcrumb: 'Centros de Costo',
            },
            loadComponent: () =>
              import(
                './GeneralMasters/CostCenters/components/cost-centers-list/cost-centers-list.component'
              ).then((m) => m.CostCentersListComponent),
          },
          {
            path: 'third-parties',
            data: {
              breadcrumb: 'Terceros',
            },
            children: [
              {
                path: '',
                redirectTo: 'list',
                pathMatch: 'full',
              },
              {
                path: 'list',
                data: {
                  breadcrumb: null,
                },
                loadComponent: () =>
                  import(
                    './GeneralMasters/ThirdParties/Components/third-list/third-list.component'
                  ).then((m) => m.ThirdListComponent),
              },
              {
                path: 'create',
                data: {
                  breadcrumb: null,
                },
                loadComponent: () =>
                  import(
                    './GeneralMasters/ThirdParties/Components/third-creation/third-creation.component'
                  ).then((m) => m.ThirdCreationComponent),
              },
              {
                path: 'edit/:id',
                data: {
                  breadcrumb: null,
                },
                loadComponent: () =>
                  import(
                    './GeneralMasters/ThirdParties/Components/third-edit/third-edit.component'
                  ).then((m) => m.ThirdEditComponent),
              },
              {
                path: 'configuration',
                data: {
                  breadcrumb: 'Configuración de Terceros',
                },
                loadComponent: () =>
                  import(
                    './GeneralMasters/ThirdParties/Components/third-config/third-config.component'
                  ).then((m) => m.ThirdConfigComponent),
              },
            ],
          },
          //Rutas de etiquetas no comerciales
          {
            path: 'no-commercial-tags',
            data: { Breadcrumb: 'Etiquetas no comerciales' },
            children: [
              {
                path: '',
                redirectTo: 'list',
                pathMatch: 'full',
              },
              {
                path: 'list',
                data: { breadcrumb: null },
                loadComponent: () =>
                  import(
                    './GeneralMasters/noCommercialTags/Components/list-tag/list-tag.component'
                  ).then((m) => m.ListTagComponent),
              },
              {
                path: 'create',
                data: { Breadcrumb: 'Crear Etiqueta No Comercial' },
                loadComponent: () =>
                  import(
                    './GeneralMasters/noCommercialTags/Components/create-tag/create-tag.component'
                  ).then((m) => m.CreateTagComponent),
              },
              {
                path: 'edit/:id',
                data: { Breadcrumb: 'Editar Etiqueta No Comercial' },
                loadComponent: () =>
                  import(
                    './GeneralMasters/noCommercialTags/Components/edit-tag/edit-tag.component'
                  ).then((m) => m.EditTagComponent),
              },
            ],
          },
          // Rutas de Impuestos
          {
            path: 'taxes',
            data: { breadcrumb: 'Impuestos' },
            children: [
              {
                path: '',
                redirectTo: 'list',
                pathMatch: 'full',
              },
              {
                path: 'list',
                data: { breadcrumb: null },
                loadComponent: () =>
                  import(
                    './GeneralMasters/Taxes/components/ListTax/list-tax.component'
                  ).then((m) => m.ListTaxComponent),
              },
              {
                path: 'create',
                data: { breadcrumb: 'Crear Impuesto' },
                loadComponent: () =>
                  import(
                    './GeneralMasters/Taxes/components/CreateTax/create-tax.component'
                  ).then((m) => m.CreateTaxComponent),
              },
              {
                path: 'edit/:id',
                data: { breadcrumb: 'Editar Impuesto' },
                loadComponent: () =>
                  import(
                    './GeneralMasters/Taxes/components/EditTax/edit-tax.component'
                  ).then((m) => m.EditTaxComponent),
              },
            ],
          },
          {
            path: 'inventory',
            data: { breadcrumb: 'Inventario' },
            children: [
              {
                path: '',
                data: { breadcrumb: null },
                loadComponent: () =>
                  import(
                    './GeneralMasters/Inventory/Components/MenuCards/inventory-menu.component'
                  ).then((m) => m.InventoryMenuComponent),
              },
              {
                path: 'products',
                data: { breadcrumb: 'Productos' },
                children: [
                  {
                    path: 'list',
                    data: { breadcrumb: null },
                    loadComponent: () =>
                      import(
                        './GeneralMasters/Inventory/Products/Components/product-list/product-list.component'
                      ).then((m) => m.ProductListComponent),
                  },
                  {
                    path: 'create',
                    data: { breadcrumb: 'Crear Producto' },
                    loadComponent: () =>
                      import(
                        './GeneralMasters/Inventory/Products/Components/product-creation/product-creation.component'
                      ).then((m) => m.ProductCreationComponent),
                    canActivate: [hasPermissionGuard(['P'])],
                  },
                  {
                    path: 'edit/:id',
                    data: { breadcrumb: 'Editar Producto' },
                    loadComponent: () =>
                      import(
                        './GeneralMasters/Inventory/Products/Components/product-edit/product-edit.component'
                      ).then((m) => m.ProductEditComponent),
                    canActivate: [hasPermissionGuard(['P'])],
                  },
                ],
              },
              {
                path: 'product-types',
                data: { breadcrumb: 'Tipos de Productos' },
                children: [
                  {
                    path: 'list',
                    data: { breadcrumb: null },
                    loadComponent: () =>
                      import(
                        './GeneralMasters/Inventory/ProductTypes/Components/product-type-list/product-type-list.component'
                      ).then((m) => m.ProductTypeListComponent),
                  },
                  {
                    path: 'create',
                    data: { breadcrumb: 'Crear Tipo de Producto' },
                    loadComponent: () =>
                      import(
                        './GeneralMasters/Inventory/ProductTypes/Components/product-type-creation/product-type-creation.component'
                      ).then((m) => m.ProductTypeCreationComponent),
                    canActivate: [hasPermissionGuard(['PT'])],
                  },
                  {
                    path: 'edit/:id',
                    data: { breadcrumb: 'Editar Tipo de Producto' },
                    loadComponent: () =>
                      import(
                        './GeneralMasters/Inventory/ProductTypes/Components/product-type-edit/product-type-edit.component'
                      ).then((m) => m.ProductTypeEditComponent),
                    canActivate: [hasPermissionGuard(['PT'])],
                  },
                ],
              },
              {
                path: 'categories',
                data: { breadcrumb: 'Categorías' },
                children: [
                  {
                    path: 'list',
                    data: { breadcrumb: null },
                    loadComponent: () =>
                      import(
                        './GeneralMasters/Inventory/Category/Components/category-list/category-list.component'
                      ).then((m) => m.CategoryListComponent),
                  },
                  {
                    path: 'create',
                    data: { breadcrumb: 'Crear Categoría' },
                    loadComponent: () =>
                      import(
                        './GeneralMasters/Inventory/Category/Components/category-creation/category-creation.component'
                      ).then((m) => m.CategoryCreationComponent),
                    canActivate: [hasPermissionGuard(['C'])],
                  },
                  {
                    path: 'edit/:id',
                    data: { breadcrumb: 'Editar Categoría' },
                    loadComponent: () =>
                      import(
                        './GeneralMasters/Inventory/Category/Components/category-edit/category-edit.component'
                      ).then((m) => m.CategoryEditComponent),
                    canActivate: [hasPermissionGuard(['C'])],
                  },
                ],
              },
              {
                path: 'measurement-units',
                data: { breadcrumb: 'Unidades de Medida' },
                children: [
                  {
                    path: 'list',
                    data: { breadcrumb: null },
                    loadComponent: () =>
                      import(
                        './GeneralMasters/Inventory/MeasurementUnits/Components/unit-of-measure-list/unit-of-measure-list.component'
                      ).then((m) => m.UnitOfMeasureListComponent),
                  },
                  {
                    path: 'create',
                    data: { breadcrumb: 'Crear Unidad de Medida' },
                    loadComponent: () =>
                      import(
                        './GeneralMasters/Inventory/MeasurementUnits/Components/unit-of-measure-creation/unit-of-measure-creation.component'
                      ).then((m) => m.UnitOfMeasureCreationComponent),
                    canActivate: [hasPermissionGuard(['UM'])],
                  },
                  {
                    path: 'edit/:id',
                    data: { breadcrumb: 'Editar Unidad de Medida' },
                    loadComponent: () =>
                      import(
                        './GeneralMasters/Inventory/MeasurementUnits/Components/unit-of-measure-edit/unit-of-measure-edit.component'
                      ).then((m) => m.UnitOfMeasureEditComponent),
                    canActivate: [hasPermissionGuard(['UM'])],
                  },
                ],
              },
            ],
          },
          {
            path: 'payment-methods',
            data: { breadcrumb: 'Métodos de Pago' },
            children: [
              {
                path: '',
                pathMatch: 'full',
                redirectTo: 'list',
              },
              {
                path: 'list',
                data: { breadcrumb: null },
                loadComponent: () =>
                  import(
                    './GeneralMasters/PaymentMethods/components/payment-methods-list/payment-methods-list.component'
                  ).then((m) => m.PaymentMethodsListComponent),
              },
              {
                path: 'create',
                data: { breadcrumb: 'Crear Método de Pago' },
                loadComponent: () =>
                  import(
                    './GeneralMasters/PaymentMethods/components/payment-methods-creation/payment-methods-creation.component'
                  ).then((m) => m.PaymentMethodsCreationComponent),
              },
              {
                path: 'edit/:id',
                data: { breadcrumb: 'Editar Método de Pago' },
                loadComponent: () =>
                  import(
                    './GeneralMasters/PaymentMethods/components/payment-methods-edit/payment-methods-edit.component'
                  ).then((m) => m.PaymentMethodsEditComponent),
              },
            ],
          },
          {
            path: 'document-types',
            data: { breadcrumb: 'Tipos de Documentos' },
            children: [
              {
                path: '',
                pathMatch: 'full',
                redirectTo: 'list',
              },
              {
                path: 'list',
                data: { breadcrumb: null },
                loadComponent: () =>
                  import(
                    './GeneralMasters/DocumentTypes/Components/document-types-list/document-types-list.component'
                  ).then((m) => m.DocumentTypesListComponent),
              },
              {
                path: 'create',
                data: { breadcrumb: 'Crear Tipo de Documento' },
                loadComponent: () =>
                  import(
                    './GeneralMasters/DocumentTypes/Components/document-types-creation/document-types-creation.component'
                  ).then((m) => m.DocumentTypesCreationComponent),
              },
              {
                path: 'edit/:id',
                data: { breadcrumb: 'Editar Tipo de Documento' },
                loadComponent: () =>
                  import(
                    './GeneralMasters/DocumentTypes/Components/document-types-edit/document-types-edit.component'
                  ).then((m) => m.DocumentTypesEditComponent),
              },
              {
                path: 'classes/list',
                data: { breadcrumb: 'Clases de Documentos' },
                loadComponent: () =>
                  import(
                    './GeneralMasters/DocumentTypes/Components/classes-of-documents-list/classes-of-documents-list.component'
                  ).then((m) => m.ClassesOfDocumentsListComponent),
              },
              {
                path: 'classes/create',
                data: { breadcrumb: 'Crear Clase de Documento' },
                loadComponent: () =>
                  import(
                    './GeneralMasters/DocumentTypes/Components/classes-of-documents-creation/classes-of-documents-creation.component'
                  ).then((m) => m.ClassesOfDocumentsCreationComponent),
              },
              {
                path: 'classes/edit/:id',
                data: { breadcrumb: 'Editar Clase de Documento' },
                loadComponent: () =>
                  import(
                    './GeneralMasters/DocumentTypes/Components/classes-of-documents-edit/classes-of-documents-edit.component'
                  ).then((m) => m.ClassesOfDocumentsEditComponent),
              },
            ],
          },

          {
            path: 'bank-accounts',
            data: { breadcrumb: 'Bancos y Cuentas Bancarias' },
            children: [
              {
                path: '',
                pathMatch: 'full',
                redirectTo: 'list',
              },
              {
                path: 'list',
                data: { breadcrumb: null },
                loadComponent: () =>
                  import(
                    './GeneralMasters/BankAccounts/components/bank-accounts-list/bank-accounts-list.component'
                  ).then((m) => m.BankAccountsListComponent),
              },
              {
                path: 'create',
                data: { breadcrumb: 'Crear Cuenta Bancaria' },
                loadComponent: () =>
                  import(
                    './GeneralMasters/BankAccounts/components/bank-accounts-creation/bank-accounts-creation.component'
                  ).then((m) => m.BankAccountsCreationComponent),
              },
              {
                path: 'edit/:id',
                data: { breadcrumb: 'Editar Cuenta Bancaria' },
                loadComponent: () =>
                  import(
                    './GeneralMasters/BankAccounts/components/bank-accounts-edit/bank-accounts-edit.component'
                  ).then((m) => m.BankAccountsEditComponent),
              },
              {
                path: 'banks',
                data: { breadcrumb: 'Bancos' },
                loadComponent: () =>
                  import(
                    './GeneralMasters/BankAccounts/components/bank-list/bank-list.component'
                  ).then((m) => m.BankListComponent),
              },
              {
                path: 'banks/create',
                data: { breadcrumb: 'Crear Banco' },
                loadComponent: () =>
                  import(
                    './GeneralMasters/BankAccounts/components/bank-creation/bank-creation.component'
                  ).then((m) => m.BankCreationComponent),
              },
              {
                path: 'banks/edit/:id',
                data: { breadcrumb: 'Editar Banco' },
                loadComponent: () =>
                  import(
                    './GeneralMasters/BankAccounts/components/bank-edit/bank-edit.component'
                  ).then((m) => m.BankEditComponent),
              },
            ],
          },
          {
            path: 'cost-centers',
            data: { breadcrumb: 'Centros de Costo' },
            loadComponent: () =>
              import(
                './GeneralMasters/Components/MenuCards/menu.component'
              ).then((m) => m.MenuComponent),
          },
          {
            path: 'help-panels',
            data: { breadcrumb: 'Centro de Ayuda' },
            loadComponent: () =>
              import(
                './GeneralMasters/Components/MenuCards/menu.component'
              ).then((m) => m.MenuComponent),
          },
          {
            path: 'help-center',
            data: { breadcrumb: 'Centro de Ayuda' },
            children: [
              {
                path: '',
                pathMatch: 'full',
                redirectTo: 'list',
              },
              {
                path: 'list',
                data: { breadcrumb: null },
                loadComponent: () =>
                  import(
                    './GeneralMasters/HelpCenter/components/help-center-list/help-center-list.component'
                  ).then((m) => m.HelpCenterListComponent),
              },
              {
                path: 'create',
                data: { breadcrumb: 'Crear Centro de Ayuda' },
                loadComponent: () =>
                  import(
                    './GeneralMasters/HelpCenter/components/help-center-creation/help-center-creation.component'
                  ).then((m) => m.HelpCenterCreationComponent),
              },
              {
                path: 'edit/:id',
                data: { breadcrumb: 'Editar Centro de Ayuda' },
                loadComponent: () =>
                  import(
                    './GeneralMasters/HelpCenter/components/help-center-edit/help-center-edit.component'
                  ).then((m) => m.HelpCenterEditComponent),
              },
            ],
          },
          {
            path: 'accounting-calendar',
            data: { breadcrumb: 'Calendario Contable' },
            loadComponent: () =>
              import(
                './GeneralMasters/AccountingCalendar/components/accounting-calendar/accounting-calendar.component'
              ).then((m) => m.AccountingCalendarComponent),
          },
        ],
      },
      {
        path: 'financial',
        data: {
          breadcrumb: 'Módulo Financiero',
        },
        children: [
          {
            path: 'reports',
            data: {
              breadcrumb: 'Reportes',
            },
            children: [
              {
                path: '',
                pathMatch: 'full',
                data: {
                  breadcrumb: null,
                },
                loadComponent: () =>
                  import(
                    './Financial/Reports/Components/main-view/main-view.component'
                  ).then((m) => m.MainViewComponent),
              },
              {
                path: 'auxiliary-books',
                data: {
                  breadcrumb: 'Libros Auxiliares',
                },
                children: [
                  {
                    path: 'list',
                    pathMatch: 'full',
                    data: {
                      breadcrumb: null,
                    },
                    loadComponent: () =>
                      import(
                        './Financial/Reports/auxiliary-books/Components/auxiliary-books-list/auxiliary-books-list.component'
                      ).then((m) => m.AuxiliaryBooksListComponent),
                  },
                  {
                    path: 'historial',
                    canActivate: [hasRoleChildGuard],
                    data: {
                      breadcrumb: 'Historial',
                    },
                    loadComponent: () =>
                      import(
                        './Financial/Reports/auxiliary-books/Components/auxiliary-books-historial/auxiliary-books-historial.component'
                      ).then((m) => m.AuxiliaryBooksHistorialComponent),
                  },
                  {
                    path: 'historial/details/:id',
                    canActivate: [hasRoleChildGuard],
                    data: {
                      breadcrumb: 'Detalles del Historial',
                    },
                    loadComponent: () =>
                      import(
                        './Financial/Reports/auxiliary-books/Components/auxiliary-books-historial/Components/auxiliary-books-details/auxiliary-books-details.component'
                      ).then((m) => m.AuxiliaryBooksDetailsComponent),
                  },
                  {
                    path: 'inventory-and-balances',
                    data: {
                      breadcrumb: 'Libro de Inventario y Balances',
                    },
                    loadComponent: () =>
                      import(
                        './Financial/Reports/auxiliary-books/Components/aux-book-types/inventory-and-balances/inventory-and-balances.component'
                      ).then((m) => m.InventoryAndBalancesComponent),
                  },
                  {
                    path: 'diary',
                    data: {
                      breadcrumb: 'Libro Diario',
                    },
                    loadComponent: () =>
                      import(
                        './Financial/Reports/auxiliary-books/Components/aux-book-types/diary/diary.component'
                      ).then((m) => m.DiaryComponent),
                  },
                  {
                    path: 'major-and-balances',
                    data: {
                      breadcrumb: 'Libro Mayor y Balances',
                    },
                    loadComponent: () =>
                      import(
                        './Financial/Reports/auxiliary-books/Components/aux-book-types/major-and-balances/major-and-balances.component'
                      ).then((m) => m.MajorAndBalancesComponent),
                  },
                  {
                    path: 'account-book',
                    data: {
                      breadcrumb: 'Libro Auxiliary por Cuenta',
                    },
                    loadComponent: () =>
                      import(
                        './Financial/Reports/auxiliary-books/Components/aux-book-types/account-book/account-book.component'
                      ).then((m) => m.AccountBookComponent),
                  },
                  {
                    path: 'third-party-book',
                    data: {
                      breadcrumb: 'Libro Auxiliar por Tercero',
                    },
                    loadComponent: () =>
                      import(
                        './Financial/Reports/auxiliary-books/Components/aux-book-types/third-party-book/third-party-book.component'
                      ).then((m) => m.ThirdPartyBookComponent),
                  },
                  {
                    path: 'accounting-movement',
                    data: {
                      breadcrumb: 'Movimiento de Contabilidad',
                    },
                    loadComponent: () =>
                      import(
                        './Financial/Reports/auxiliary-books/Components/aux-book-types/accounting-movement/accounting-movement.component'
                      ).then((m) => m.AccountingMovementComponent),
                  },
                ],
              },
              {
                path: 'financial-statements',
                data: {
                  breadcrumb: 'Estados Financieros',
                },
                children: [
                  {
                    path: 'list',
                    pathMatch: 'full',
                    data: {
                      breadcrumb: null,
                    },
                    loadComponent: () =>
                      import(
                        './Financial/Reports/financial-statements/Components/financial-statements-list/financial-statements-list.component'
                      ).then((m) => m.FinancialStatementsListComponent),
                  },
                  /* {
                    path: 'statement-financial-position',
                    data: {
                      breadcrumb: 'Estado de situacion Financiera',
                    },
                    loadComponent: () =>
                      import(
                        './Financial/Reports/financial-statements/Components/financial-statement-types/statement-financial-position/statement-financial-position.component'
                      ).then((m) => m.InventoryAndBalancesComponent),
                  },*/
                ],
              },
            ],
          },
          {
            path: 'wallet',
            data: {
              breadcrumb: 'Cartera',
            },
            children: [
              {
                path: 'receipts',
                data: {
                  breadcrumb: 'Recibos de Caja',
                },
                loadComponent: () =>
                  import(
                    './Financial/Wallet/CashReceipts/Components/receipts-list/receipts-list.component'
                  ).then((m) => m.ReceiptsListComponent),
              },
              {
                path: 'receipts/creation',
                data: {
                  breadcrumb: 'Creación de Recibos',
                },
                loadComponent: () =>
                  import(
                    './Financial/Wallet/CashReceipts/Components/receipt-creation/receipt-creation.component'
                  ).then((m) => m.ReceiptCreationComponent),
              },
              {
                path: 'receipts/details/:id',
                data: {
                  breadcrumb: 'Detalles del Recibo',
                },
                loadComponent: () =>
                  import(
                    './Financial/Wallet/CashReceipts/Components/receipt-details/receipt-details.component'
                  ).then((m) => m.ReceiptDetailsComponent),
              },
              {
                path: 'receipts/:id/accounting',
                data: {
                  breadcrumb: 'Contabilización del Recibo',
                },
                loadComponent: () =>
                  import(
                    './Financial/Wallet/CashReceipts/Components/receipt-accounting/receipt-accounting.component'
                  ).then((m) => m.ReceiptAccountingComponent),
              },
              {
                path: 'write-offs',
                data: {
                  breadcrumb: 'Castigos de cartera',
                },
                loadComponent: () =>
                  import(
                    './Financial/Wallet/PortfolioWriteOffs/Components/write-off-list/write-off-list.component'
                  ).then((m) => m.WriteOffListComponent),
              },
              {
                path: 'write-offs/creation',
                data: {
                  breadcrumb: 'Creación de castigo',
                },
                loadComponent: () =>
                  import(
                    './Financial/Wallet/PortfolioWriteOffs/Components/write-off-creation/write-off-creation.component'
                  ).then((m) => m.WriteOffCreationComponent),
              },
              {
                path: 'write-offs/details/:id',
                data: {
                  breadcrumb: 'Detalles del castigo',
                },
                loadComponent: () =>
                  import(
                    './Financial/Wallet/PortfolioWriteOffs/Components/write-off-details/write-off-details.component'
                  ).then((m) => m.WriteOffDetailsComponent),
              },
              {
                path: 'accounting-entries',
                data: {
                  breadcrumb: 'Asientos Contables',
                },
                loadComponent: () =>
                  import(
                    './Financial/Wallet/Accounting/Components/accounting-entries/accounting-entries.component'
                  ).then((m) => m.AccountingEntriesComponent),
              },
              {
                path: 'invoices',
                data: {
                  breadcrumb: 'Facturas',
                },
                loadComponent: () =>
                  import(
                    './Financial/Wallet/PortfolioManagement/Components/invoice-list/invoice-list.component'
                  ).then((m) => m.InvoiceListComponent),
              },
              {
                path: 'invoices/details/:id',
                data: {
                  breadcrumb: 'Detalles de la Factura',
                },
                loadComponent: () =>
                  import(
                    './Financial/Wallet/PortfolioManagement/Components/invoice-detail/invoice-detail.component'
                  ).then((m) => m.InvoiceDetailComponent),
              },
            {
              path: 'accounting-entries',
              data: {
                breadcrumb: 'Asientos Contables',
            },
              loadComponent: () =>
                import(
                  './Financial/Wallet/Accounting/Components/accounting-entries/accounting-entries.component'
                ).then((m) => m.AccountingEntriesComponent),
            },

            ],
          },
          {
            path: 'treasury',
            data: {
              breadcrumb: 'Tesorería',
            },
            children: [
              {
                path: 'expense-receipts',
                data: {
                  breadcrumb: 'Comprobantes de Egreso',
                },
                loadComponent: () =>
                  import(
                    './Financial/Treasury/ExpenseReceipts/Components/expense-receipts-list/expense-receipts-list.component'
                  ).then((m) => m.ExpenseReceiptsListComponent),
              },
              {
                path: 'expense-receipts/creation',
                data: {
                  breadcrumb: 'Creación de Comprobantes',
                },
                loadComponent: () =>
                  import(
                    './Financial/Treasury/ExpenseReceipts/Components/expense-receipt-creation/expense-receipt-creation.component'
                  ).then((m) => m.ExpenseReceiptCreationComponent),
              },
              {
                path: 'expense-receipts/details/:id',
                data: {
                  breadcrumb: 'Detalles del Comprobante',
                },
                loadComponent: () =>
                  import(
                    './Financial/Treasury/ExpenseReceipts/Components/expense-receipt-details/expense-receipt-details.component'
                  ).then((m) => m.ExpenseReceiptDetailsComponent),
              },
              {
                path: 'expense-receipts/:id/accounting',
                data: {
                  breadcrumb: 'Contabilización del Comprobante',
                },
                loadComponent: () =>
                  import(
                    './Financial/Treasury/ExpenseReceipts/Components/expense-receipt-accounting/expense-receipt-accounting.component'
                  ).then((m) => m.ExpenseReceiptAccountingComponent),
              },
              // Purchase Bills Routes
              {
                path: 'purchase-bills',
                data: {
                  breadcrumb: 'Facturas de Compra',
                },
                loadComponent: () =>
                  import(
                    './Financial/Treasury/PurchaseBills/Components/bill-list/bill-list.component'
                  ).then((m) => m.BillListComponent),
              },
              {
                path: 'purchase-bills/create',
                data: {
                  breadcrumb: 'Nueva Factura de Compra',
                },
                loadComponent: () =>
                  import(
                    './Financial/Treasury/PurchaseBills/Components/bill-creation/bill-creation.component'
                  ).then((m) => m.BillCreationComponent),
              },
              {
                path: 'reports',
                data: {
                  breadcrumb: 'Reportes',
                },
                children: [
                  {
                    path: 'vendors',
                    data: {
                      breadcrumb: 'Reportes de Proveedores',
                    },
                    loadComponent: () =>
                      import(
                        './Financial/Treasury/Reports/VendorReports/Components/vendor-list/vendor-list.component'
                      ).then((m) => m.VendorListComponent),
                  },
                  {
                    path: 'vendor-report/:id',
                    data: {
                      breadcrumb: 'Reporte Individual',
                    },
                    loadComponent: () =>
                      import(
                        './Financial/Treasury/Reports/VendorReports/Components/vendor-report/vendor-report.component'
                      ).then((m) => m.VendorReportComponent),
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        path: 'commercial',
        data: {
          breadcrumb: 'Módulo Comercial',
        },
        children: [
          {
            path: 'business-masters',
            data: {
              breadcrumb: 'Maestros Comerciales',
            },
            children: [
              {
                path: 'kardex',
                data: {
                  breadcrumb: 'Kardex',
                },
                loadComponent: () =>
                  import(
                    './Commercial/BusinessMasters/ValuationModels/WeightedAverage/list-kardex-weighted-average/list-kardex-weighted-average.component'
                  ).then((m) => m.ListKardexWeightedAverageComponent),
              },
              {
                path: 'peps',
                data: {
                  breadcrumb: 'KardexPEPS',
                },
                loadComponent: () =>
                  import(
                    './Commercial/BusinessMasters/ValuationModels/PEPS/list-kardex-peps/list-kardex-peps.component'
                  ).then((m) => m.ListKardexPepsComponent),
              },
            ],
          },
          {
            path: 'sale-invoice',
            data: {
              breadcrumb: 'Factura de Venta',
            },
            loadComponent: () =>
              import(
                './Commercial/SaleInvoice/components/sale-invoice-creation/sale-invoice-creation.component'
              ).then((m) => m.SaleInvoiceCreationComponent),
          },
          {
            path: 'invoice-template',
            data: {
              breadcrumb: 'Plantilla de Factura',
            },
            loadComponent: () =>
              import(
                './Commercial/InvoiceTemplate/components/create-invoice/create-invoice.component'
              ).then((m) => m.CreateInvoiceComponent),
          },
          {
            path: 'return-template',
            data: {
              breadcrumb: 'Plantilla de Devolución',
            },
            loadComponent: () =>
              import(
                './Commercial/InvoiceTemplate/components/create-return/create-return.component'
              ).then((m) => m.CreateReturnComponent),
          },
          {
            path:'non-commercial-template',
            data:{
              Breadcrumb:'Plantilla de Evento no Comercial'
            },
            loadComponent:()=>
              import(
                './Commercial/NonCommercialTemplate/components/create-non-commercial/create-non-commercial.component'
              ).then((m) =>m.CreateNonCommercialComponent)
          }
        ],
      },
      {
        path: 'billing',
        data: {
          breadcrumb: 'Facturación',
        },
        loadChildren: () =>
          import('./routes/billing.routes').then((m) => m.BILLING_ROUTES),
      },
    ],
  },
  {
    path: 'help-center-view',
    data: {
      breadcrumb: 'Centro de Ayuda',
    },
    loadComponent: () =>
      import('./PublicSite/help-center/help-center-view.component').then(
        (m) => m.HelpCenterViewComponent
      ),
  },
  {
    path: 'help-center-view/:moduleId',
    data: {
      breadcrumb: 'Centro de Ayuda',
    },
    loadComponent: () =>
      import('./PublicSite/help-center/help-center-view.component').then(
        (m) => m.HelpCenterViewComponent
      ),
  },
  {
    path: 'style-guide',
    data: {
      breadcrumb: '',
    },
    component: StyleGuideComponent,
  },
];
