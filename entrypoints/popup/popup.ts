import { Component, signal } from '@angular/core';
import { browser } from '#imports';
import { sendMessage } from '@/messaging';
import { DEFAULT_SETTINGS, settings as settingsItem } from '@/storage';
import { storageSignal } from '@/storage-signal';
import { imports, viewProviders } from './config';

/**
 * The shortest-lived surface. Chrome destroys the popup the moment it loses
 * focus, taking any in-flight work with it, so it reads state and starts work
 * elsewhere — it never owns a long-running job.
 */
@Component({
  selector: 'bs-popup',
  templateUrl: './popup.html',
  styleUrl: './popup.css',
  host: { class: 'c-popup' },
  imports, viewProviders
})
export class Popup {

  protected readonly settings = storageSignal(settingsItem);

  protected readonly pong = signal('');

  protected async onToggle(event: Event): Promise<void> {
    const enabled = (event.target as HTMLInputElement).checked;

    await settingsItem.setValue({ ...(this.settings() ?? DEFAULT_SETTINGS), enabled });
  }

  protected async ping(): Promise<void> {
    const reply = await sendMessage({ type: 'ping' });

    this.pong.set(new Date(reply.at).toLocaleTimeString());
  }

  protected async openSidePanel(): Promise<void> {
    const [ tab ] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId == null) return;

    // Chrome requires this to run inside the user gesture, so it stays in the
    // click handler — routed through the background script the gesture is lost
    // and the call is rejected.
    await browser.sidePanel.open({ windowId: tab.windowId });
    window.close();
  }

  protected openOptions(): void {
    void browser.runtime.openOptionsPage();
  }

}
