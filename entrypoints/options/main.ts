import { provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import '@/assets/base.css';
import { Options } from './options';

bootstrapApplication(Options, {
  providers: [ provideZonelessChangeDetection(), provideBrowserGlobalErrorListeners() ]
}).catch((error: unknown) => console.error(error));
