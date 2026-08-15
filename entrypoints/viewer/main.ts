import { provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import '@/assets/base.css';
import { Viewer } from './viewer';

/**
 * Zoneless, like every surface here. This one renders once from a storage read
 * and then sits still, so a change-detection zone would patch every async
 * global to watch a page that never changes again.
 */
bootstrapApplication(Viewer, {
  providers: [ provideZonelessChangeDetection(), provideBrowserGlobalErrorListeners() ]
}).catch((error: unknown) => console.error(error));
