import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from '../Services/loading.service';

/**
 * Interceptor global de carga: cuenta cada petición HTTP en vuelo para que el
 * overlay global (app-loading-overlay) cubra la UI y evite envíos duplicados.
 * Se registra DESPUÉS de authInterceptor en app.config.ts.
 */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loading = inject(LoadingService);
  const requestId = loading.requestStarted();
  return next(req).pipe(finalize(() => loading.requestFinished(requestId)));
};
