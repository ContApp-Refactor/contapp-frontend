import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Subscription, filter } from 'rxjs';
import { Third } from '../../../../GeneralMasters/ThirdParties/models/Third';
import { ProductToSale } from '../../models/ProductToSale';
import { SaleInvoiceService } from '../../services/sale-invoice.service';
import { Router } from '@angular/router';
import { EnterpriseService } from '../../../../GeneralMasters/Enterprise/services/enterprise.service';
import { EnterpriseDetails } from '../../../../GeneralMasters/Enterprise/models/EnterpriseDetails';
import { UnitOfMeasureService } from '../../services/unit-of-measure.service';
import { FactureV } from '../../models/SaleInvoice';
import { ProductS } from '../../models/ProductSelect';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { DropdownModule } from 'primeng/dropdown';
import { SaleInvoiceSelectedProductsComponent } from '../sale-invoice-selected-products/sale-invoice-selected-products.component';
import { DatePickerModule } from 'primeng/datepicker';
import { LocalStorageMethods } from '../../../../Shared/Methods/local-storage.method';
import { ThirdService } from '../../../../GeneralMasters/ThirdParties/Services/third.service';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';


@Component({
  selector: 'app-sale-invoice-creation',
  standalone: true,
  imports: [
    // Módulos básicos de Angular
    CommonModule,
    FormsModule,

    // Módulos de PrimeNG para el template
    ButtonModule,
    TableModule,
    InputTextModule,
    InputNumberModule,
    CheckboxModule,
    TooltipModule,
    AutoCompleteModule,
    DropdownModule,
    DatePickerModule,
    ToastModule,
    ConfirmDialogModule
  ],
  providers: [
    DialogService,
    MessageService,
    ConfirmationService
  ],
  templateUrl: './sale-invoice-creation.component.html',
  styleUrl: './sale-invoice-creation.component.css'
})
export class SaleInvoiceCreationComponent {
  //Variables para manejar las referencias a los diálogos de PrimeNG ---
  ref: DynamicDialogRef | undefined;
  dialogSubscription: Subscription | undefined;

  /**
   * Detalles de la empresa seleccionada (opcional).
   *
   * @type {EnterpriseDetails} - Objeto que contiene los detalles de la empresa seleccionada.
   */
  enterpriseSelected?: EnterpriseDetails;

  /**
   * Estado de carga para la vista previa del PDF.
   *
   * @type {boolean} - Indica si se está cargando la vista previa del PDF.
   */
  isLoadingPdfPreview: boolean = false;

  /**
   * Estado de guardado para el PDF.
   *
   * @type {boolean} - Indica si se está guardando el PDF.
   */
  isSavingPdf: boolean = false;

  /**
   * Variables relacionadas con terceros.
   *
   * @type {boolean} showSectionThrid - Indica si se debe mostrar la sección de terceros.
   * @type {boolean} SectionNotas - Controla la visibilidad de la sección de notas.
   * @type {boolean} showInfoThird - Indica si se debe mostrar la información del tercero seleccionado.
   * @type {any} selectedSupplier - Almacena el proveedor seleccionado.
   * @type {number} selectedSupplierS - Almacena el ID del proveedor seleccionado (opcional).
   * @type {Third} supplierS - Objeto que representa el proveedor seleccionado (opcional).
   * @type {Third} supplierSCopy - Copia del objeto proveedor seleccionado (opcional).
   * @type {boolean} changeSupplierS - Indica si se ha realizado un cambio en el proveedor seleccionado.
   */
  showSectionThrid: boolean = true; //Posible para borrar
  SectionNotas: boolean = false; //Posible para borrar
  showInfoThird: boolean = false; //Posible para borrar
  selectedSupplier: any;
  selectedSupplierS?: number;
  supplierS?: Third;
  supplierSCopy?: Third;
  changeSupplierS: boolean = false;
  allSuppliers: Third[] = []; // Lista de proveedores, debe ser cargada desde el servicio
  filteredSuppliers: Third[] = []; // Lista filtrada de proveedores para autocompletar

  /**
   * Carga la lista completa de terceros (clientes) desde el servicio.
   */
  loadAllSuppliers() {
    const entId = this.localStorageMethods.getIdEnterprise();
    this.thirdService.getThirdList(entId).subscribe({
      next: (data: any) => {
        this.allSuppliers = data;
        console.log(this.allSuppliers)
      },
      error: (error: any) => {
        console.error('Error loading suppliers:', error);
      }
    });
  }


  /**
   * Filtra la lista de clientes para el componente p-autoComplete.
   * @param event El evento emitido por p-autoComplete, contiene la consulta (query).
   */
  searchSupplier(event: { query: string }) {
    const query = (event.query || '').toLowerCase();

    // Mapea la lista original a una nueva con un campo displayName virtual
    const suppliersWithLabel = this.allSuppliers.map(supplier => ({
      ...supplier,
      displayName: this.getDisplayName(supplier)
    }));

    if (!query) {
      this.filteredSuppliers = suppliersWithLabel.slice(0, 50);
      return;
    }

    this.filteredSuppliers = suppliersWithLabel.filter(supplier => {
      const idNumber = supplier.idNumber?.toString().toLowerCase() || '';
      return supplier.displayName.toLowerCase().includes(query) || idNumber.includes(query);
    });
  }

  // Generador de nombre para el campo virtual
  getDisplayName(supplier: Third): string {
    if (supplier.personType === 'Natural') {
      return `${supplier.names || ''} ${supplier.lastNames || ''}`.trim();
    } else {
      return supplier.socialReason || '';
    }
  }



  /**
   * Se ejecuta cuando un usuario selecciona un cliente del autocompletado.
   * @param selectedClient El cliente seleccionado.
   */
  onClientSelect(selectedClient: Third) {
    if (this.lstProducts.length > 0) {
      this.confirmationService.confirm({
        header: 'Cambio de cliente',
        message: 'Has cambiado de cliente. Esto limpiará la lista de productos actual. ¿Deseas continuar?',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Sí, continuar',
        rejectLabel: 'Cancelar',
        rejectButtonStyleClass: 'p-button-secondary',
        defaultFocus: 'reject',
        closeOnEscape: true,
        accept: () => {
          this.lstProducts = []; // Limpiar productos
          this.calculateInvoiceTotals(); // Recalcular totales
          this.messageService.add({
            severity: 'success',
            summary: 'Cliente cambiado',
            detail: 'Se ha limpiado la lista de productos.'
          });
        }
      });
    }
  }


  /**
   * Variables relacionadas con productos.
   *
   * @type {boolean} showSectionProducts - Indica si se debe mostrar la sección de productos.
   * @type {boolean} showInfoProducts - Controla la visibilidad de la información de los productos.
   * @type {ProductToSale[]} lstProducts - Lista de productos disponibles.
   * @type {ProductToSale[]} lstProductsSecurity - Lista de productos relacionados con la seguridad.
   */
  showSectionProducts: boolean = true; //Posible para borrar
  showInfoProducts: boolean = false; //Posible para borrar
  lstProducts: ProductToSale[] = [];
  lstProductsSecurity: ProductToSale[] = [];

  /**
   * Variables relacionadas con la factura de compra.
   *
   * @type {number} subTotal - El subtotal de la factura antes de impuestos y descuentos.
   * @type {number} taxTotal - El total de impuestos aplicados en la factura.
   * @type {number} uvt - El valor de la unidad de valor tributario (UVT).
   * @type {number} retention - El valor de la retención aplicada en la factura.
   * @type {number} descuentoPorc - El porcentaje de descuento aplicado en la factura.
   * @type {number} descuentoVal - El valor del descuento aplicado en la factura.
   * @type {number} descuentoTotal - El total de descuento aplicado, que puede ser un valor o un cálculo.
   * @type {number} total - El total de la factura después de aplicar impuestos y descuentos.
   * @type {boolean} impuestoCheck - Indica si se debe aplicar el impuesto en la factura.
   * @type {boolean} retencionCheck - Indica si se debe aplicar la retención en la factura.
   */
  subTotal: number = 0;
  taxTotal: number = 0;
  uvt: number = 47065;
  retention: number = 0;
  descuentoPorc: number = 0;
  descuentoVal: number = 0;
  descuentoTotal: number = 0;
  total: number = 0;
  impuestoCheck: boolean = true;
  retencionCheck: boolean = true;

  /**
   * Variables relacionadas con la factura de compra y el pago.
   *
   * @type {Date} currentDate - La fecha actual al momento de la creación de la factura.
   * @type {string} dueDate - La fecha de vencimiento de la factura (opcional).
   * @type {string} paymentMethod - El método de pago seleccionado (por defecto 'debito').
   * @type {ProductS[]} lstProductsSend - Lista de productos a ser enviados en la factura.
   */
  currentDate: Date = new Date();
  dueDate?: string;
  paymentMethod: string = 'debito';
  lstProductsSend: ProductS[] = [];
  factureType: string = 'Venta';
  nota: string = "";

  /**
   * Columnas de la tabla de productos.
   *
   * @type {any[]} columnsProducts - Un array de objetos que define las columnas de la tabla de productos, incluyendo los títulos y los datos asociados.
   * Cada objeto puede tener un título para la columna y un campo de datos asociado.
   */
  columnsProducts: any[] = [
    { title: '#' },
    { title: 'Codigo', data: 'name' },
    { title: 'Descripción', data: 'description' },
    { title: 'Cantidad' },
    { title: 'U/M' },
    { title: 'Precio Unitario', data: 'price' },
    { title: 'Descuento' },
    { title: 'IVA' },
    { title: 'Subtotal' },
    { title: 'Eliminar' }
  ];

  constructor(
    private enterpriseService: EnterpriseService, //Descomentar cuando este implementado
    private UnitMeasureService: UnitOfMeasureService,  //Descomentar cuando este implementado
    private dialogService: DialogService,
    private thirdService: ThirdService,
    private saleService: SaleInvoiceService,
    private router: Router,
    private localStorageMethods: LocalStorageMethods,
    private messageService: MessageService,
    private confirmationService: ConfirmationService) { }

  ngOnInit() {
    this.getEnterpriseSelectedInfo();
    this.loadAllSuppliers(); // Cargar la lista de proveedores al iniciar el componente
  }

  /**
   * Obtiene la información de la empresa seleccionada.
   *
   * @returns {EnterpriseDetails | undefined} - Devuelve los detalles de la empresa seleccionada, o undefined si no se ha seleccionado ninguna empresa.
   *
   * Si no hay una empresa seleccionada, se maneja el caso y no se realiza ninguna acción.
   * Si se ha seleccionado una empresa, se realiza una llamada a la API para obtener los detalles de la empresa por su ID.
   */
  getEnterpriseSelectedInfo() {
    const id = this.localStorageMethods.getIdEnterprise();
    //const id = this.enterpriseService.getSelectedEnterprise();
    if (id === null) {
      // Manejar caso donde no hay empresa seleccionada
    } else {
      this.enterpriseService.getEnterpriseById(id).subscribe({
        next: (enterpriseData) => {
          this.enterpriseSelected = enterpriseData;
        },
      });
    }
    console.log(this.enterpriseSelected)
    return this.enterpriseSelected;
  }

  /**
   * Cancela la creación de un producto y navega hacia la página anterior en el historial de navegación.
   */
  /*Descomentar cuando este implementado
  cancelCreateProduct() {
    this.location.back(); // Navega hacia atrás en el historial
  }*/

  /**
   * Obtiene la información de un proveedor a partir de su ID y la asigna a la propiedad local `supplierS`.
   * @param thirdId - Identificador del proveedor a consultar.
   */
  getSupplier(thirdId: any) {
    if (thirdId) {
      const entId = this.localStorageMethods.getIdEnterprise();
      this.thirdService.getThirdPartie(thirdId, entId).subscribe({
        next: (response: Third) => {
          this.supplierS = response;
        }
      });
    }
  }

  /**
   * Actualiza la lista de productos con la abreviatura de la unidad de medida correspondiente a cada producto.
   * Realiza una solicitud para obtener la unidad de medida por su ID y asigna la abreviatura al producto.
   * @param lstProducts - Lista de productos a actualizar.
   * @returns La lista de productos con las unidades de medida actualizadas.
   */
  getUnitOfMeasureForId(lstProducts: ProductToSale[]): ProductToSale[] {
    if (lstProducts != null || this.lstProducts.length > 0) {
      const enterpriseId = this.localStorageMethods.getIdEnterprise();

      lstProducts.forEach((prod) => {
        this.UnitMeasureService.getUnitOfMeasuresId("" + prod.unitOfMeasureId, enterpriseId).subscribe({
          next: (response) => {
            prod.unitOfMeasure = response.abbreviation;
          }
        });
      });
    }

    return lstProducts;
  }

  /**
   * Alterna la visibilidad de la sección relacionada con terceros, notas y demas
   */
  showSectionThridM() {
    this.showSectionThrid = !this.showSectionThrid;
  }
  showSectionNotas() {
    this.SectionNotas = !this.SectionNotas;
  }
  showSectionProductsM() {
    this.showSectionProducts = !this.showSectionProducts;
  }


  //Posible para borrar
  OpenListThirds(title: any, entId: any, component: any) {
    this.ref = this.dialogService.open(component, {
      header: title,
      width: '50%',
      contentStyle: { "max-height": "500px", "overflow": "auto" },
      baseZIndex: 10000,
      data: {
        entId: entId
      }
    });

    // `onClose` es el equivalente a `afterClosed`
    this.dialogSubscription = this.ref.onClose.subscribe((result: any) => {
      if (result) {
        // La lógica interna sigue siendo la misma
        this.selectedSupplier = result;
        this.showInfoThird = true;
        this.showSectionProducts = true;
        this.getSupplier(result);
        // ... resto de tu lógica para `Swal.fire`
      } else {
        this.supplierS = undefined;
        this.showInfoThird = false;
        this.showInfoProducts = false;
        this.showSectionProducts = false;
      }
    });
  }

  OpenListProducts(title: any, entId: any, thId: any, component: any) {
    this.ref = this.dialogService.open(component, {
      header: title,
      width: '50%',
      contentStyle: { "max-height": "500px", "overflow": "auto" },
      baseZIndex: 10000,
      data: {
        entId: entId,
        thId: thId,
        products: this.lstProducts
      }
    });

    this.dialogSubscription = this.ref.onClose.subscribe((result: any) => {
      if (result && result.length > 0) {
        let products = result.map((prod: any) => {
          return {
            id: prod.id,
            name: prod.name,
            description: prod.description,
            price: prod.cost,
            displayPrice: String(prod.cost),
            taxPercentage: prod.taxPercentage,
            unitOfMeasureId: prod.unitOfMeasureId,
            IVA: 0,
            IvaValor: 0,
            amount: 0,
            totalValue: 0,
            descuentos: [0, 0],
            displayDescuentos: '0'
          };
        });

        this.lstProducts = products;

        this.lstProducts.forEach(prod => {
          prod.IVA = prod.taxPercentage;
          prod.IvaValor = prod.cost * prod.IVA / 100;
          prod.amount = 1;
          prod.totalValue = 0;
        });
        this.lstProducts = this.getUnitOfMeasureForId(this.lstProducts);
        this.showInfoProducts = true;
        this.calculateInvoiceTotals();
      } else {
        this.showInfoProducts = false;
      }
    });
  }

  // Metodo para limpiar la suscripción para evitar memory leaks
  ngOnDestroy() {
    if (this.ref) {
      this.ref.close();
    }
    if (this.dialogSubscription) {
      this.dialogSubscription.unsubscribe();
    }
  }

  /**
   * Calcula los totales de la factura, incluyendo el subtotal, impuestos, retención y descuentos.
   * Recorre la lista de productos para calcular el subtotal y el descuento de cada uno, y luego calcula el total de impuestos y el total general de la factura.
   */
  calculateInvoiceTotals(): void {
    // 1. Calcular Subtotal General
    this.subTotal = this.lstProducts.reduce((acc, prod) => acc + this.calculateLineSubtotal(prod), 0);

    // 2. Calcular Descuento Total
    this.descuentoTotal = this.lstProducts.reduce((acc, prod) => {
      const totalBeforeDiscount = (prod.cost || 0) * (prod.amount || 0);
      const discountPerc = prod.descuentos?.[0] || 0;
      const discountVal = prod.descuentos?.[1] || 0;
      return acc + (totalBeforeDiscount * (discountPerc / 100)) + discountVal;
    }, 0);

    // 3. Calcular Total de Impuestos
    this.taxTotal = this.impuestoCheck
      ? this.lstProducts.reduce((acc, prod) => acc + (prod.IvaValor || 0), 0)
      : 0;

    // 4. Calcular Retención
    this.calculateRetention();

    // 5. Calcular Total Final
    this.total = this.subTotal + this.taxTotal - this.retention;
  }

  /**
   * Calcula el valor total de un producto, considerando su precio, cantidad, descuentos en porcentaje y en valor.
   * @param prod - El producto para el cual se calculará el valor total.
   * @returns El valor total calculado del producto después de aplicar los descuentos, o 0 si la cantidad es 0.
   */
  calculateTotalValue(prod?: ProductToSale): any {
    if (prod) {
      if (prod.amount == 0) {
        return 0;
      }
      const totalValue = prod.cost * prod.amount;

      return totalValue - (totalValue * prod.descuentos[0] / 100) - prod.descuentos[1];
    }

  }

  /**
   * Formatea un precio a dos decimales y lo convierte a una cadena de texto.
   * @param price - El precio a formatear.
   * @returns El precio formateado como una cadena.
   */
  formatPrice(price: number): string {
    price = parseFloat(price.toFixed(2))

    return price.toString();
  }

  /**
   * Maneja el evento de teclado, permitiendo solo números y teclas especiales como Backspace, ArrowLeft, y ArrowRight.
   * @param event - El evento de teclado.
   */
  onKeyDown(event: KeyboardEvent) {
    // Permitir solo números y teclas especiales como Backspace, Tab, etc.
    const allowedKeys = ['Backspace', 'ArrowLeft', 'ArrowRight'];
    if (!/\d/.test(event.key) && !allowedKeys.includes(event.key)) {
      event.preventDefault();
    }
  }

  /**
 * Formatea un valor numérico, eliminando caracteres no numéricos y agregando separadores de miles para la visualización.
 * @param displayValue - El valor a mostrar (como cadena) que puede contener caracteres no numéricos.
 * @param value - El valor numérico a calcular.
 * @param formatValue - El valor formateado para mostrar.
 * @returns Un arreglo con el valor numérico y el valor formateado como cadena.
 */
  formatValue(displayValue: string, value: number, formatValue: string): [number, string] {
    if (displayValue === '') {
      value = 0;
      formatValue = '';
      return [0, ''];
    }

    const numericValue = String(displayValue).replace(/\D/g, '');
    value = parseFloat(numericValue);
    formatValue = numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return [value, formatValue];
  }

  /**
   * Calcula el total de un producto y actualiza los valores relacionados, como el IVA y el total de la factura.
   * Si se proporciona un índice y un producto, actualiza solo ese producto en la lista.
   * Si no se proporcionan parámetros, actualiza todos los productos.
   * @param index - El índice del producto en la lista (opcional).
   * @param prod - El producto a actualizar (opcional).
   */
  calculateTotal(index?: number, prod?: ProductToSale): void {
    if (index === undefined || prod === undefined) {
      if (prod != undefined) {
        prod.totalValue = this.calculateTotalValue(prod); //Llamado para cada producto
        prod.IvaValor = prod.totalValue * prod.IVA / 100;
        this.calculateInvoiceTotals(); //Llama para que se vaya actualizando los labels de abajo
      }

      return;
    } else {
      this.lstProducts[index].cost = this.formatValue(prod.displayPrice, prod.cost, prod.displayPrice)[0];
      this.lstProducts[index].displayPrice = this.formatValue(prod.displayPrice, prod.cost, prod.displayPrice)[1];

      prod.totalValue = this.calculateTotalValue(prod); //Llamado para cada producto
      prod.IvaValor = prod.totalValue * prod.IVA / 100;
      this.calculateInvoiceTotals(); //Llama para que se vaya actualizando los labels de abajo
    }

  }

  /**
   * Cambia el tipo de descuento (porcentaje o valor) en un producto y actualiza los valores correspondientes.
   * Si el tipo es 'porc', se limpia el descuento en valor, y si es 'val', se limpia el descuento en porcentaje.
   * Luego, recalcula el total del producto y los totales de la factura.
   * @param type - El tipo de descuento: 'porc' para porcentaje o 'val' para valor.
   * @param prod - El producto al que se le aplicará el cambio de descuento.
   */
  switchDescuento(type: 'porc' | 'val', prod: ProductToSale): void {
    if (prod.descuentos) {
      if (type === 'porc') {
        prod.descuentos[1] = 0;
      } else if (type === 'val') {
        prod.descuentos[0] = 0;
      }
    }
    this.calculateChanges(prod);
  }

  /**
  * Calcula la retención basada en un valor de UVT (Unidad de Valor Tributario) y el subtotal.
  * Si el subtotal es mayor que 27 veces el valor de la UVT, aplica una retención del 2.5%.
  * @param uvt - El valor de la UVT a utilizar para el cálculo.
  * @returns Un valor booleano que indica si se aplica o no la retención.
  */
  calculateRetention(): void {
    if (this.retencionCheck && (this.subTotal > (this.uvt * 27))) {
      this.retention = this.subTotal * 0.025;
    } else {
      this.retention = 0;
    }
  }

  /**
  * Elimina un producto de la lista de productos y actualiza los totales de la factura.
  * @param index - El índice del producto a eliminar de la lista.
  */
  deleteProduct(index: number): void {
    this.lstProducts.splice(index, 1);
    this.calculateInvoiceTotals();
  }

  /**
   * Guarda la factura con la información de los productos, descuentos, impuestos y otros detalles relevantes.
   * Llama al método `loadFactureInfo` para cargar los datos necesarios y luego crea un objeto `FactureV` para enviarlo a la función `saveInvoice`.
   */
  saveFacture() {
    this.loadFactureInfo();
    const factureS: FactureV = {
      entId: this.enterpriseSelected?.id,
      thId: this.supplierS?.thId,
      factCode: 0,
      factObservations: this.nota, //Modificar cuando se agregue campo en la vista
      descounts: this.descuentoTotal, //Modificar cuando se agregue campo en la vista
      factureType: this.factureType,
      factProducts: this.lstProductsSend,
      factSubtotals: this.subTotal,
      facSalesTax: this.taxTotal,
      facWithholdingSource: this.retention
    };

    this.saveInvoice(factureS);
  }

  /**
   * Guarda la factura, generando un archivo PDF y descargándolo en el navegador.
   * Luego de guardar, limpia los datos de la factura y muestra un mensaje de éxito o error.
   * @param facture - Los datos de la factura a guardar, incluidos los productos, descuentos, impuestos, etc.
   */
  async saveInvoice(facture: any) {
    this.isSavingPdf = true;
    this.saleService.saveInvoice(facture).subscribe(
      (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;

        const contentDisposition = blob.type;
        const fileName = this.extractFileName(contentDisposition);

        //Para borrar datos de factura
        this.supplierS = undefined;
        this.supplierSCopy = undefined;
        this.lstProducts = [];
        this.lstProductsSend = [];
        this.showInfoThird = false;
        this.showInfoProducts = false;
        this.changeSupplierS = false;
        this.subTotal = 0;
        this.taxTotal = 0;
        this.retention = 0;
        this.total = 0;
        this.nota = "";
        this.descuentoVal = 0;
        this.descuentoPorc = 0;
        this.descuentoTotal = 0;

        link.setAttribute('download', fileName || 'facture.pdf');
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
        this.isSavingPdf = false;

        this.messageService.add({
          severity: 'success',
          summary: 'Creación exitosa',
          detail: 'Se ha creado la factura con éxito!',
          life: 5000
        });
      },
      (error) => {
        this.isSavingPdf = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Ha ocurrido un error al crear la factura.',
          life: 5000
        });
      }
    );
  }

  /**
 * Carga la información de la factura, transformando los productos en un formato adecuado para el envío.
 * Calcula el descuento total de cada producto y su subtotal, teniendo en cuenta el IVA.
 */
  loadFactureInfo() {
    const descuento = 0;
    this.lstProductsSend = this.lstProducts.map(prod => ({

      productId: prod.id,
      amount: prod.amount,
      description: prod.description,
      vat: prod.IVA / 100,
      descount: this.calculateDescountTotal(prod),
      code: prod.name,
      unitPrice: prod.cost,
      subtotal: (prod.cost * prod.amount * (1 + prod.IVA / 100))
    }));
  }

  /**
  * Extrae el nombre del archivo desde el encabezado 'Content-Disposition' de la respuesta HTTP.
  * @param contentDisposition - El valor del encabezado 'Content-Disposition' que contiene el nombre del archivo.
  * @returns El nombre del archivo extraído o null si no se encuentra.
  */
  private extractFileName(contentDisposition: string): string | null {
    const matches = /filename="(.+)"/.exec(contentDisposition);
    return matches && matches[1] ? matches[1] : null;
  }

  /**
   * Calcula el descuento total de un producto, ya sea en porcentaje o en valor fijo.
   * Si el descuento es en valor fijo, calcula el porcentaje correspondiente sobre el precio total del producto.
   * @param product - El producto cuyo descuento total se va a calcular.
   * @returns El descuento total calculado, truncado a dos decimales.
   */
  calculateDescountTotal(product: ProductToSale): Number {
    if (product.descuentos[1] != 0) {
      const priceTotal = product.cost * product.amount;
      const discount = 100 * product.descuentos[1] / priceTotal;
      return Math.floor(discount * 100) / 100; // Trunca a dos decimales
    }
    return Math.floor(product.descuentos[0] * 100) / 100; // Trunca a dos decimales
  }

  /**
   * Genera una vista previa de la factura en formato PDF y la abre en una nueva ventana.
   * Si no se encuentra una factura, muestra un mensaje de error. Si la vista previa se genera con éxito, se muestra una notificación.
   */
  async generatePdfPreview() {

    this.loadFactureInfo();

    const previewFacture: FactureV = {
      entId: this.enterpriseSelected?.id,
      thId: this.supplierS?.thId,
      factCode: 0,
      factureType: this.factureType,
      descounts: this.descuentoTotal,
      factObservations: this.nota,
      factProducts: this.lstProductsSend,
      factSubtotals: this.subTotal,
      facSalesTax: this.taxTotal,
      facWithholdingSource: this.retention
    };


    if (!previewFacture) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No hay factura disponible para mostrar.',
        life: 5000
      });
      return;
    }
    this.isLoadingPdfPreview = true;
    this.saleService.generateInvoicePreview(previewFacture).subscribe(
      (blob) => {
        const url = window.URL.createObjectURL(blob);
        window.open(url);
        this.isLoadingPdfPreview = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Visualización exitosa',
          detail: 'Se ha generado la vista previa de la factura.',
          life: 5000
        });
      },
      (error) => {
        this.isLoadingPdfPreview = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Ha ocurrido un error al generar la vista previa de la factura.',
          life: 5000
        });
      }
    );
  }


  // En SaleInvoiceCreationComponent

  selectProducts() {
    this.ref = this.dialogService.open(SaleInvoiceSelectedProductsComponent, {
      header: 'Seleccionar Productos',
      width: '70%',
      contentStyle: { "max-height": "80vh", "overflow": "auto" },
      baseZIndex: 10000,
      data: {
        entId: this.enterpriseSelected?.id,
        products: this.lstProducts
      }
    });

    this.dialogSubscription = this.ref.onClose.subscribe((selectedProducts: any[]) => {
      if (selectedProducts) {
        this.lstProducts = selectedProducts.map(prodFromDialog => {
          const existingProduct = this.lstProducts.find(p => p.id === prodFromDialog.id);

          return {
            ...prodFromDialog, // Copiamos todas las propiedades del producto del diálogo

            // --- ¡CORRECCIÓN CLAVE! ---
            // Mapeamos 'cost' a 'price' para usarlo en la factura
            price: prodFromDialog.cost,

            // Manejo de valores existentes o por defecto
            amount: existingProduct?.amount || 1,
            descuentos: existingProduct?.descuentos || [0, 0],
            IVA: existingProduct?.IVA ?? prodFromDialog.taxPercentage ?? 0,

            // Propiedades calculadas se resetean
            IvaValor: 0,
            totalValue: 0
          };
        });

        this.getUnitOfMeasureForId(this.lstProducts);
        this.calculateInvoiceTotals();
      }
    });
  }

  /**
   * Calcula el subtotal de UNA LÍNEA de producto (después de aplicar descuentos).
   * Esta es la nueva función base para los cálculos.
   */
  calculateLineSubtotal(prod: ProductToSale): number {
    // Usamos 'price' que ahora existe en nuestro objeto
    const price = prod.cost || 0;
    const amount = prod.amount || 0;
    const discountPerc = prod.descuentos?.[0] || 0;
    const discountVal = prod.descuentos?.[1] || 0;

    if (amount === 0) return 0;

    const totalBeforeDiscount = price * amount;
    const totalDiscount = (totalBeforeDiscount * (discountPerc / 100)) + discountVal;

    return totalBeforeDiscount - totalDiscount;
  }

  /**
   * Método principal llamado desde el HTML.
   * Orquesta todos los cálculos cuando un valor cambia.
   */
  calculateChanges(prod: ProductToSale): void {
    // 1. Recalcula el valor del IVA para la línea modificada
    const lineSubtotal = this.calculateLineSubtotal(prod);
    prod.IvaValor = lineSubtotal * ((prod.IVA || 0) / 100);

    // 2. Recalcula TODOS los totales de la factura
    this.calculateInvoiceTotals();
  }
}
