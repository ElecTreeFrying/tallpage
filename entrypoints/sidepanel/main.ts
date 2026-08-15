import { provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import '@/assets/base.css';
import { Sidepanel } from './sidepanel';

bootstrapApplication(Sidepanel, {
  providers: [ provideZonelessChangeDetection(), provideBrowserGlobalErrorListeners() ]
}).catch((error: unknown) => console.error(error));
