import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig, inject, isDevMode, provideAppInitializer, provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { DateAdapter, MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { MatIconRegistry } from '@angular/material/icon';
import { provideRouter, TitleStrategy, withComponentInputBinding } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { routes } from './app.routes';
import { DEFAULT_LANG, SUPPORTED_LANGS, savedLang } from './core/i18n/i18n-state';
import { I18nService } from './core/i18n/i18n.service';
import { LocaleDateAdapter, TranslatedTitleStrategy, TranslocoHttpLoader } from './core/i18n/transloco.config';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { PreferencesService } from './core/services/preferences.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideTransloco({
      config: {
        availableLangs: SUPPORTED_LANGS,
        defaultLang: DEFAULT_LANG,
        fallbackLang: DEFAULT_LANG,
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
        missingHandler: { logMissingKey: isDevMode(), useFallbackTranslation: true },
      },
      loader: TranslocoHttpLoader,
    }),
    provideNativeDateAdapter(),
    { provide: DateAdapter, useClass: LocaleDateAdapter },
    { provide: MAT_DATE_LOCALE, useFactory: savedLang },
    { provide: TitleStrategy, useClass: TranslatedTitleStrategy },
    { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { appearance: 'outline' } },
    provideAppInitializer(() => {
      inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
      inject(PreferencesService); // aplica o tema salvo
      // carrega o idioma salvo (ou pt-BR) antes da primeira renderização
      return inject(I18nService).use(savedLang());
    }),
  ],
};
