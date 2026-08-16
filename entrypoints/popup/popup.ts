import { Component, computed, signal, type OnInit } from '@angular/core';
import { browser } from '#imports';
import { sendMessage, type CaptureReply } from '@/messaging';
import { createPngPathClipboard } from '@/png-path';
import { captureProgress as captureProgressItem, type ExportFormat } from '@/storage';
import { storageSignal } from '@/storage-signal';
import { imports, viewProviders } from './config';

const UNCAPTURABLE = /^(chrome|chrome-extension|edge|about|devtools|view-source):/i;

interface PageInfo {

  capturable: boolean;

  problem: string;

  title: string;

  url: string;

  windowId: number;

}

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
export class Popup implements OnInit {

  private readonly progress = storageSignal(captureProgressItem);

  protected readonly pngClipboard = createPngPathClipboard(this.progress);

  private readonly submitting = signal(false);

  protected readonly busy = computed(() => this.submitting() || this.progress()?.state === 'running');

  protected readonly outcome = signal('');

  protected readonly page = signal<PageInfo | null>(null);

  protected readonly canDownload = computed(() => this.page()?.capturable ?? false);

  protected readonly status = computed(() => {
    const current = this.progress();
    if (current?.state === 'running') return current.message;

    return this.outcome();
  });

  ngOnInit(): void {
    void this.loadPage();
  }

  private async loadPage(): Promise<void> {
    try {
      const [ tab ] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      const url = tab.url ?? '';
      const capturable = !UNCAPTURABLE.test(url);

      this.page.set({
        capturable,
        problem: capturable
          ? ''
          : 'Browser and extension pages cannot be exported. Switch to a regular webpage and reopen Tallpage.',
        title: tab.title?.trim() || 'Untitled page',
        url,
        windowId: tab.windowId
      });
    } catch {
      // The action can open on a browser-owned page whose details are withheld;
      // keep the worker's own guard authoritative if the target changes later.
      this.page.set({
        capturable: false,
        problem: 'Tallpage cannot read this page. Switch to a regular webpage and reopen Tallpage.',
        title: 'Page unavailable',
        url: '',
        windowId: -1
      });
    }
  }

  protected async download(format: ExportFormat): Promise<void> {
    this.submitting.set(true);
    this.outcome.set('');

    // `sendMessage` rejects outright when no receiver answers — the worker
    // failed to start, or the extension was reloaded while this popup was open.
    // Without this the rejection escapes, `busy` is never cleared, and every
    // button stays disabled behind a popup that says nothing about why.
    let reply: CaptureReply;
    try {
      reply = await sendMessage({ type: 'capture', format });
    } catch (error: unknown) {
      this.submitting.set(false);
      this.outcome.set(error instanceof Error ? error.message : 'The extension did not respond.');

      return;
    }

    this.submitting.set(false);

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

    // A successful export is complete whether the optional result tab opens or
    // not. Close the short-lived surface rather than leaving stale status up.
    window.close();
  }

  protected openOptions(): void {
    void browser.runtime.openOptionsPage();
  }

  protected openSidepanel(): void {
    const windowId = this.page()?.windowId;
    if (windowId == null || windowId < 0) {
      this.outcome.set('Tallpage could not open the progress panel for this window.');

      return;
    }

    // Chrome requires the call to remain inside the click's user gesture. Do
    // not insert an await before `open()` or route this through the worker.
    void browser.sidePanel.open({ windowId }).catch((error: unknown) => {
      this.outcome.set(error instanceof Error ? error.message : 'The progress panel did not open.');
    });
  }

}
