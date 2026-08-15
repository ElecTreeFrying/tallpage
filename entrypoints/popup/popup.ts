import { Component, computed, signal } from '@angular/core';
import { browser } from '#imports';
import { sendMessage } from '@/messaging';
import { captureProgress as captureProgressItem, type ExportFormat } from '@/storage';
import { storageSignal } from '@/storage-signal';
import { imports, viewProviders } from './config';

/**
 * The shortest-lived surface. Chrome destroys the popup the moment it loses
 * focus, taking any in-flight work with it, so it reads state and starts work
 * elsewhere — it never owns a long-running job.
 *
 * A capture runs for seconds, far longer than this surface is guaranteed to
 * live. The click sends one message and the service worker owns the run from
 * there: if the popup survives to the end it reports the outcome, and if it is
 * dismissed mid-run the download still lands. Progress is read from storage
 * rather than held here for the same reason — the popup may be opened again
 * while a run it did not start is still going.
 */
@Component({
  selector: 'tp-popup',
  templateUrl: './popup.html',
  styleUrl: './popup.css',
  host: { class: 'c-popup' },
  imports, viewProviders
})
export class Popup {

  private readonly progress = storageSignal(captureProgressItem);

  protected readonly busy = signal(false);

  protected readonly outcome = signal('');

  protected readonly status = computed(() => {
    const current = this.progress();
    if (current?.running) return `Capturing… ${Math.round(current.fraction * 100)}%`;

    return this.outcome();
  });

  protected async download(format: ExportFormat): Promise<void> {
    this.busy.set(true);
    this.outcome.set('');

    const reply = await sendMessage({ type: 'capture', format });

    this.busy.set(false);

    if (!reply.ok) {
      this.outcome.set(reply.error ?? 'Capture failed.');

      return;
    }

    // A short capture is reported rather than passed off as complete: the page
    // was taller than a canvas can hold, and the file is real but partial.
    if (reply.captured != null && reply.requested != null && reply.captured < reply.requested) {
      this.outcome.set(`Saved ${reply.captured}px of ${reply.requested}px — the rest is past the canvas limit.`);

      return;
    }

    // The worker opens the saved file in a new tab, which takes focus and
    // destroys this popup anyway. Closing first keeps that from looking like a
    // crash.
    window.close();
  }

  protected openOptions(): void {
    void browser.runtime.openOptionsPage();
  }

}
