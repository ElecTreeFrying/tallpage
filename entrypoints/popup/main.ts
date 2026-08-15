import { provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import '@/assets/base.css';
import './document.css';
import { Popup } from './popup';

/**
 * Zoneless is a deliberate call, not a fashion. Zone.js monkey-patches every
 * async global to know when to re-render — payload plus patching cost, in a
 * surface that opens and closes in under a second. Signals give Angular the
 * same knowledge for free, so the zone earns nothing here.
 */
bootstrapApplication(Popup, {
  providers: [ provideZonelessChangeDetection(), provideBrowserGlobalErrorListeners() ]
}).catch((error: unknown) => console.error(error));
