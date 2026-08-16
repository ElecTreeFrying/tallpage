import { computed, effect, signal, type Signal } from '@angular/core';
import { browser } from '#imports';
import type { CaptureProgress } from '@/storage';

export interface PngPathClipboard {

  readonly canCopy: Signal<boolean>;

  readonly loading: Signal<boolean>;

  readonly status: Signal<string>;

  copy(): void;

}

/**
 * Resolve the most recent completed PNG's local path for one UI surface.
 *
 * Call from an Angular injection context. The absolute path stays inside the
 * returned signals and disappears with their owning popup or side panel; only
 * Chrome's numeric download ID is persisted in session storage.
 */
export function createPngPathClipboard(progress: Signal<CaptureProgress | null>): PngPathClipboard {
  const path = signal('');
  const loading = signal(false);
  const status = signal('');

  effect((onCleanup) => {
    const current = progress();

    path.set('');
    loading.set(false);
    status.set('');

    if (current?.state !== 'saved' || current.format !== 'png' || current.downloadId == null) return;

    const controller = new AbortController();
    loading.set(true);
    onCleanup(() => controller.abort());

    void resolvePngPath(current.downloadId, controller.signal).then(
      (filename) => {
        if (controller.signal.aborted) return;

        path.set(filename);
        loading.set(false);
      },
      () => {
        if (controller.signal.aborted) return;

        loading.set(false);
        status.set('PNG path unavailable. Reopen Tallpage to retry.');
      }
    );
  });

  return {
    canCopy: computed(() => path() !== ''),
    loading: loading.asReadonly(),
    status: status.asReadonly(),
    copy: (): void => {
      const filename = path();

      if (!filename) {
        status.set('Export PNG first.');
        return;
      }

      status.set('');

      // Invoke writeText before yielding the click handler. Chromium accepts
      // the transient user gesture, so no clipboardWrite permission is needed.
      void navigator.clipboard.writeText(filename).then(
        () => status.set('PNG file path copied.'),
        () => status.set('Tallpage could not copy the PNG file path.')
      );
    }
  };
}

async function resolvePngPath(downloadId: number, abortSignal: AbortSignal): Promise<string> {
  await waitForDownload(downloadId, abortSignal);
  const [ item ] = await browser.downloads.search({ id: downloadId });

  if (abortSignal.aborted) throw new Error('PNG path lookup cancelled');
  if (!item?.filename || item.exists === false) throw new Error('Saved PNG not found');

  return item.filename;
}

function waitForDownload(downloadId: number, abortSignal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (error?: Error): void => {
      if (settled) return;

      settled = true;
      clearTimeout(timer);
      browser.downloads.onChanged.removeListener(onChanged);
      abortSignal.removeEventListener('abort', onAbort);

      if (error) reject(error);
      else resolve();
    };

    const onAbort = (): void => finish(new Error('PNG path lookup cancelled'));

    const onChanged = (delta: { id: number; state?: { current?: string } }): void => {
      if (delta.id !== downloadId) return;
      if (delta.state?.current === 'complete') finish();
      if (delta.state?.current === 'interrupted') finish(new Error('PNG download interrupted'));
    };

    const timer = setTimeout(
      () => finish(new Error('PNG download did not complete in time')),
      15_000
    );

    browser.downloads.onChanged.addListener(onChanged);
    abortSignal.addEventListener('abort', onAbort, { once: true });

    if (abortSignal.aborted) {
      onAbort();
      return;
    }

    // Search only after installing the listener. This closes the race where a
    // small download completes between an initial search and registration.
    void browser.downloads.search({ id: downloadId }).then(
      ([ item ]) => {
        if (!item) finish(new Error('PNG download not found'));
        else if (item.state === 'complete') finish();
        else if (item.state === 'interrupted') finish(new Error('PNG download interrupted'));
      },
      () => finish(new Error('PNG download lookup failed'))
    );
  });
}
