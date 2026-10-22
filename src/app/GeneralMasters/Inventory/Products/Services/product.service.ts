import { HttpClient, HttpResponse, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../../../environments/environment';
import { Observable, of, switchMap, combineLatest, map, forkJoin, catchError, throwError } from 'rxjs';
import { Product, ProductList, Page } from '../Models/Product';
import { UnitOfMeasureService } from '../../MeasurementUnits/Services/unit-of-measure.service';
import { CategoryService } from '../../Category/Services/category.service';
import { ProductTypeService } from '../../ProductTypes/Services/product-type.service';


let API_URL = environment.API_URL;
@Injectable({
  providedIn: 'root',
})
export class ProductService {
  constructor(
    private readonly http: HttpClient,
    private readonly unitOfMeasureService: UnitOfMeasureService,
    private readonly categoryService: CategoryService,
    private readonly productTypeService: ProductTypeService
  ) {}

  getProducts(enterpriseId: string, numPage?: number, size?: number, sortField: string = 'name', sortOrder: string = 'asc', search?: string): Observable<Page<ProductList>> {
    let params: any = { enterpriseId };
    if (numPage !== undefined) params.numPage = numPage;  // Usar 'numPage' como en terceros
    if (size !== undefined) params.size = size;
    params.sortField = sortField;
    params.sortOrder = sortOrder;
    if (search) params.search = search;

    return this.http.get<Page<Product>>(`${API_URL}products/findAll`, { params }).pipe(
      switchMap((page: Page<Product>) => this.transformProductsPage(page, enterpriseId)),
      catchError(err => {
        console.error('Error al obtener productos:', err);
        return of(this.createEmptyPage());
      })
    );
  }

  
  getActiveProducts(enterpriseId: string): Observable<Page<ProductList>> {
    let params: any = { enterpriseId };
    return this.http.get<Page<Product>>(`${API_URL}products/findActivate`, { params }).pipe(
      switchMap((page: Page<Product>) => this.transformProductsPage(page, enterpriseId)),
      catchError(err => {
        return of(this.createEmptyPage());
      })
    );
  }

  /**
   * Transforma una página de productos agregando información relacionada
   */
  private transformProductsPage(page: Page<Product>, enterpriseId: string): Observable<Page<ProductList>> {
    // Recopilar IDs únicos
    const ids = this.collectRelatedIds(page.content);

    // Obtener datos relacionados en paralelo
    return combineLatest([
      this.getRelatedData(ids.unitOfMeasureIds, 'unitOfMeasure', enterpriseId),
      this.getRelatedData(ids.categoryIds, 'category', enterpriseId),
      this.getRelatedData(ids.productTypeIds, 'productType', enterpriseId)
    ]).pipe(
      map(([unitOfMeasures, categories, productTypes]) => {
        // Crear mapas
        const maps = this.createLookupMaps(unitOfMeasures, categories, productTypes);

        // Transformar productos
        const transformedProducts = page.content.map(product =>
          this.transformProduct(product, maps)
        );

        // El monolito devuelve la página en formato clásico de Spring (totalElements en la raíz);
        // el front espera el anidado `page: {...}`. Se normaliza para soportar ambos.
        const classic = page as any;
        return {
          ...page,
          content: transformedProducts,
          page: page.page ?? {
            size: classic.size ?? 10,
            number: classic.number ?? 0,
            totalElements: classic.totalElements ?? transformedProducts.length,
            totalPages: classic.totalPages ?? 0,
          },
        };
      })
    );
  }

  /**
   * Recopila IDs únicos de elementos relacionados
   */
  private collectRelatedIds(products: Product[]): {
    unitOfMeasureIds: Set<number>,
    categoryIds: Set<number>,
    productTypeIds: Set<number>
  } {
    const unitOfMeasureIds = new Set<number>();
    const categoryIds = new Set<number>();
    const productTypeIds = new Set<number>();

    products.forEach(product => {
      if (product.unitOfMeasureId) unitOfMeasureIds.add(product.unitOfMeasureId);
      if (product.categoryId) categoryIds.add(product.categoryId);
      if (product.productTypeId) productTypeIds.add(product.productTypeId);
    });

    return { unitOfMeasureIds, categoryIds, productTypeIds };
  }

  /**
   * Obtiene datos relacionados por tipo
   */
  private getRelatedData(ids: Set<number>, type: string, enterpriseId: string): Observable<any[]> {
    if (ids.size === 0) return of([]);

    const queries = Array.from(ids).map(id => {
      let observable: Observable<any>;

      switch (type) {
        case 'unitOfMeasure':
          observable = this.unitOfMeasureService.getUnitOfMeasuresId(id.toString(), enterpriseId);
          break;
        case 'category':
          observable = this.categoryService.getCategoryById(id.toString(), enterpriseId);
          break;
        case 'productType':
          observable = this.productTypeService.getProductTypeById(id.toString(), enterpriseId);
          break;
        default:
          return of(null);
      }

      return observable.pipe(
        catchError(err => {
          console.warn(`Error al obtener ${type} ${id}:`, err);
          return of(null);
        })
      );
    });

    return forkJoin(queries).pipe(
      map(results => results.filter(result => result !== null)),
      catchError(err => {
        console.warn(`Error en forkJoin para ${type}:`, err);
        return of([]);
      })
    );
  }

  
  /**
   * Crea mapas de búsqueda
   */
  private createLookupMaps(unitOfMeasures: any[], categories: any[], productTypes: any[]) {
    // Asegurar que todos los arrays sean válidos
    const safeUnitOfMeasures = Array.isArray(unitOfMeasures) ? unitOfMeasures : [];
    const safeCategories = Array.isArray(categories) ? categories : [];
    const safeProductTypes = Array.isArray(productTypes) ? productTypes : [];

    return {
      unitOfMeasure: new Map(safeUnitOfMeasures.map(item => [item.id, item])),
      category: new Map(safeCategories.map(item => [item.id, item])),
      productType: new Map(safeProductTypes.map(item => [item.id, item])),
    };
  }

  /**
   * Transforma un producto individual
   */
  private transformProduct(product: Product, maps: any): ProductList {
    const productType = product.productType || maps.productType.get(product.productTypeId);
    const unitOfMeasure = maps.unitOfMeasure.get(product.unitOfMeasureId);
    const category = maps.category.get(product.categoryId);

    return {
      ...product,
      unitOfMeasureName: unitOfMeasure?.name || 'N/A',
      categoryName: category?.name || 'N/A',
      productType: productType || null,
      productTypeName: productType?.name || 'N/A',
      state: typeof product.state === 'boolean' ? product.state : product.state === 'true'
    } as ProductList;
  }


  /**
   * Crea una página vacía para errores
   */
  private createEmptyPage(): Page<ProductList> {
    return {
      content: [],
      page: {
        totalElements: 0,
        totalPages: 0,
        size: 10,
        number: 0
      }
    };
  }

  createProduct(product: Product): Observable<Product> {
    const url = `${environment.API_URL}products/create`;
    return this.http.post<Product>(url, product);
  }

  updateProduct(id: number, productData: Product): Observable<Product> {
    const url = `${API_URL}products/update/${id}`;
    return this.http.put<Product>(url, productData);
  }

  getProductById(id: number, enterpriseId: string): Observable<Product> {
    const url = `${environment.API_URL}products/findById/${id}/${enterpriseId}`;
    return this.http.get<Product>(url);
  }

  deleteProduct(id: number, enterpriseId: string): Observable<Product> {
    const url = `${API_URL}products/delete/${id}/${enterpriseId}`;
    return this.http.delete<Product>(url);
  }

  changeProductState(id: number, enterpriseId: string): Observable<void> {
    const url = `${API_URL}products/changeState/${id}/${enterpriseId}`;
    return this.http.put<void>(url, {});
  }

  downloadTemplate(entId: string): Observable<HttpResponse<Blob>> {
    let params = new HttpParams().set('entId', entId);
    return this.http.get(`${API_URL}products/template/excel`, {
      params,
      responseType: 'blob',
      observe: 'response'
    }).pipe(
      catchError((error) => {
        return throwError(() => new Error('Error al descargar la plantilla de productos'));
      })
    );
  }

  /**
   * Inicia una importación asíncrona de productos desde un archivo Excel.
   * @param entId - El ID de la entidad.
   * @param file - El archivo Excel a importar.
   * @returns Un observable con el jobId para hacer seguimiento de la importación.
   */
  importProductsAsync(entId: string, file: File): Observable<{ jobId: string; message: string; status: string }> {
    const formData = new FormData();
    formData.append('entId', entId);
    formData.append('excelFile', file);

    return this.http.post<{ jobId: string; message: string; status: string }>(
      `${API_URL}products/import/excel`,
      formData
    ).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtiene el estado de una importación asíncrona.
   * @param jobId - El ID del trabajo de importación.
   * @returns Un observable con el estado de la importación.
   */
  getImportStatus(jobId: string): Observable<any> {
    return this.http.get(`${API_URL}products/import/status/${jobId}`).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => error);
      })
    );
  }

  /**
   * Inicia una exportación asíncrona de productos.
   * @param entId - El ID de la entidad.
   * @param companyName - Nombre opcional de la empresa para el archivo.
   * @param status - Estado del filtro (true=activos, false=inactivos, undefined=todos).
   * @returns Un observable con el jobId para hacer seguimiento de la exportación.
   */
  exportProductsAsync(entId: string, companyName?: string, status?: boolean): Observable<{ jobId: string; message: string; status: string }> {
    const params = new URLSearchParams();
    params.set('entId', entId);

    if (status !== undefined && status !== null) {
      params.set('status', status.toString());
    }

    if (companyName && companyName.trim()) {
      params.set('companyName', companyName.trim());
    }

    const url = `${API_URL}products/export/excel?${params.toString()}`;

    return this.http.get<{ jobId: string; message: string; status: string }>(url).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtiene el estado de una exportación asíncrona.
   * @param jobId - El ID del trabajo de exportación.
   * @returns Un observable con el estado de la exportación.
   */
  getExportStatus(jobId: string): Observable<any> {
    return this.http.get(`${API_URL}products/export/status/${jobId}`).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => error);
      })
    );
  }

  /**
   * Descarga el archivo generado de una exportación completada.
   * @param jobId - El ID del trabajo de exportación.
   * @returns Un observable con la respuesta HTTP que contiene el blob del archivo.
   */
  downloadExportFile(jobId: string): Observable<HttpResponse<Blob>> {
    return this.http.get(`${API_URL}products/export/download/${jobId}`, {
      responseType: 'blob',
      observe: 'response'
    }).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => error);
      })
    );
  }
}