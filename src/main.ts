import { provideZoneChangeDetection } from "@angular/core";
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { appConfig } from './app/app.config';

// FASE 1.2 - Carrito UX - 2026-05-15
// Se centraliza el bootstrap en appConfig para que los interceptores
// (auth, sanitization, browser-compat) se registren una sola vez.
registerLocaleData(localeEs, 'es');

bootstrapApplication(AppComponent, {...appConfig, providers: [provideZoneChangeDetection(), ...appConfig.providers]}).catch(() => {
  // Error silencioso en producción
});
