import { Component } from '@angular/core';
import { DEFAULT_SETTINGS, settings as settingsItem } from '@/storage';
import { storageSignal } from '@/storage-signal';
import { imports, viewProviders } from './config';

/**
 * The full-page settings surface, opened from `browser.runtime.openOptionsPage()`
 * or the extension's entry in `chrome://extensions`.
 *
 * It owns persisted export behaviour. Every control writes the one settings
 * item rather than holding a surface-local copy.
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

  protected async onOpenAfterDownloadChange(event: Event): Promise<void> {
    const openAfterDownload = (event.target as HTMLInputElement).checked;

    await settingsItem.setValue({ ...(this.settings() ?? DEFAULT_SETTINGS), openAfterDownload });
  }

}
