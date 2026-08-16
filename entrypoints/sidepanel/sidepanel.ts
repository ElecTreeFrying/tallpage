import { Component } from '@angular/core';
import { browser } from '#imports';
import { createPngPathClipboard } from '@/png-path';
import { captureProgress as captureProgressItem } from '@/storage';
import { storageSignal } from '@/storage-signal';
import { imports, viewProviders } from './config';

/**
 * The long-lived surface. Unlike the popup it survives tab navigation and loses
 * nothing to a focus change, which is why anything conversational, streaming or
 * stateful belongs here rather than in the popup.
 *
 * Chromium only. WXT maps this entrypoint to `side_panel` for Chrome and to
 * `sidebar_action` for Firefox; the programmatic `sidePanel.open()` call in the
 * popup has no Firefox equivalent.
 */
@Component({
  selector: 'tp-sidepanel',
  templateUrl: './sidepanel.html',
  styleUrl: './sidepanel.css',
  host: { class: 'c-sidepanel' },
  imports, viewProviders
})
export class Sidepanel {

  protected readonly progress = storageSignal(captureProgressItem);

  protected readonly pngClipboard = createPngPathClipboard(this.progress);

  protected openOptions(): void {
    void browser.runtime.openOptionsPage();
  }

}
