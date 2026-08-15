import { Component } from '@angular/core';
import { DEFAULT_SETTINGS, settings as settingsItem } from '@/storage';
import { storageSignal } from '@/storage-signal';
import { imports, viewProviders } from './config';

/**
 * The full-page settings surface, opened from `browser.runtime.openOptionsPage()`
 * or the extension's entry in `chrome://extensions`.
 *
 * It deliberately renders the same toggle the popup does. Both read one storage
 * key rather than each holding a copy, so a change in either is visible in the
 * other without a reload — the property worth preserving as surfaces are added.
 */
@Component({
  selector: 'tp-options',
  templateUrl: './options.html',
  styleUrl: './options.css',
  host: { class: 'c-options' },
  imports, viewProviders
})
export class Options {

  protected readonly settings = storageSignal(settingsItem);

  protected async onToggle(event: Event): Promise<void> {
    const enabled = (event.target as HTMLInputElement).checked;

    await settingsItem.setValue({ ...(this.settings() ?? DEFAULT_SETTINGS), enabled });
  }

}
