import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { provideRouter, withHashLocation } from '@angular/router';
import Aura from '@primeng/themes/aura';
import { APP_INITIALIZER } from '@angular/core';
import { routes } from './app.routes';
import { AuthService } from './Core/auth/services/auth.service';
import { initializeAuthFactory } from './Core/auth/factory/auth.factory';
import { provideHttpClient } from '@angular/common/http';
import { authInterceptor } from './Core/Interceptors/auth.interceptor';
import { withInterceptors } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { PRIMENG_SPANISH_TRANSLATION } from './Shared/config/primeng-spanish.translation';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideAnimationsAsync(),
    provideRouter(routes, withHashLocation()),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: '.my-app-dark',
        },
      },
      translation: PRIMENG_SPANISH_TRANSLATION,
    }),
    AuthService,
    {
      provide: APP_INITIALIZER,
      useFactory: initializeAuthFactory,
      deps: [AuthService],
      multi: true,
    },
    provideHttpClient(withInterceptors([authInterceptor])),
    MessageService,
  ],
};
