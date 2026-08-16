import { browser, defineBackground } from '#imports';
import { captureHtml } from '@/archive';
import { captureFullPage, toRasterImage } from '@/capture';
import { withDebugger } from '@/debugger-session';
import { captureMarkdown } from '@/markdown';
import { registerHandlers } from '@/messaging';
import { imageToPdf } from '@/pdf';
import { captureProgress, lastMarkdown, lastRunAt, settings as settingsItem, type ExportFormat } from '@/storage';

/**
 * The MV3 service worker. Read this before adding anything to it.
 *
 * This is not a persistent page. Chrome terminates it after roughly 30 seconds
 * of inactivity and restarts it when the next event arrives, so the body of
 * `main()` runs many times across a browsing session. Three consequences:
 *
 * - **No module-level state.** A variable declared above this comment is wiped
 *   on every restart. Persist through `@/storage` instead.
 * - **No long timers.** `setTimeout` / `setInterval` beyond the idle window
 *   never fire; use `browser.alarms`, which needs the `alarms` permission.
 * - **Register listeners synchronously**, at the top level of `main()`. A
 *   listener added after an `await` can be registered too late to catch the
 *   very event that woke the worker.
 *
 * This worker owns the capture run because nothing else can: the popup that
 * starts it is destroyed on blur, and a full-page capture takes seconds (§E2).
 * The run itself keeps the worker alive — it is continuously awaiting extension
 * APIs, which is activity — but that is a property to verify rather than assume
 * on a very long page.
 */
export default defineBackground(() => {
  registerHandlers({
    ping: async () => {
      const at = Date.now();

      await lastRunAt.setValue(at);

      return { pong: true, at };
    },

    capture: async (message) => {
      try {
        return await runCapture(message.format);
      } catch (error: unknown) {
        await finishBadge('!');
        await captureProgress.setValue({ running: false, fraction: 0 });

        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
  });
});

/** Pages the extension must refuse rather than capture. */
const UNCAPTURABLE = /^(chrome|chrome-extension|edge|about|devtools|view-source):/i;

/** Capture the active tab and hand the file to the downloads shelf. */
async function runCapture(format: ExportFormat) {
  const [ tab ] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id == null || tab.windowId == null) throw new Error('No active tab');

  const currentSettings = await settingsItem.getValue();

  // Refusing browser and extension pages is not tidiness — the Markdown viewer
  // becomes active after an export and would otherwise be captured as a
  // screenshot of itself, inheriting its filename as the "page title".
  if (UNCAPTURABLE.test(tab.url ?? '')) {
    throw new Error('Switch to the page you want to export — this is a browser page.');
  }

  const tabId = tab.id;

  await captureProgress.setValue({ running: true, fraction: 0 });
  await browser.action.setBadgeText({ text: '…' });

  // One attached session covers whichever export was asked for — the screenshot
  // resizes the viewport and paints; the archive runs its serializer in the
  // page. Both need the debugger, neither should own it.
  const { blob, height } = await withDebugger(tabId, async () => {
    if (format === 'html') return { blob: await captureHtml(tabId), height: 0 };

    if (format === 'md') {
      const text = await captureMarkdown(tabId);

      // Stored before the file is written, because the viewer tab reads storage
      // rather than the download — see `entrypoints/viewer/CLAUDE.md`.
      await lastMarkdown.setValue(text);

      return { blob: new Blob([ text ], { type: 'text/markdown' }), height: 0 };
    }

    const captured = await captureFullPage(tabId);

    // PNG ships Chrome's own bytes untouched. Only the PDF pays for a decode.
    const encoded = format === 'pdf' ? await imageToPdf(await toRasterImage(captured)) : captured.png;

    return { blob: encoded, height: Math.round(captured.cssHeight) };
  });

  const downloadId = await browser.downloads.download({
    url: await toDataUrl(blob),
    filename: fileNameFor(tab.title, format),
    saveAs: false
  });

  await captureProgress.setValue({ running: false, fraction: 1 });
  await finishBadge('');

  if (!currentSettings.openAfterDownload) {
    return { ok: true, captured: height, requested: height };
  }

  // Markdown opens in the extension's own viewer — Chrome renders a `.md` file
  // as plain text, which is not what "open the Markdown" means. Every other
  // format the browser can display itself.
  //
  // Every result takes focus. Capturing from the focused viewer is refused
  // rather than looped — it is a `chrome-extension:` page, which
  // `UNCAPTURABLE` rejects.
  if (format === 'md') {
    await browser.tabs.create({ url: browser.runtime.getURL('/viewer.html') });
  } else {
    await openWhenComplete(downloadId);
  }

  return { ok: true, captured: height, requested: height };
}

/**
 * Encode the file as a `data:` URL for `downloads.download`.
 *
 * `URL.createObjectURL` does not exist in an extension service worker — it is
 * withheld because a worker that is torn down without revoking leaks the blob.
 * The documented alternatives are a data URL, capped at 64MB, or an offscreen
 * document, which costs the `offscreen` permission and a second context to
 * keep alive. The cap is comfortably above a realistic page, so this takes the
 * cheaper one.
 *
 * The chunking is not decoration: `String.fromCharCode(...bytes)` spreads every
 * byte as an argument and overflows the call stack somewhere in the low
 * hundreds of thousands, which a small test image never reaches.
 */
async function toDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunk = 0x8000;
  let binary = '';

  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }

  return `data:${blob.type};base64,${btoa(binary)}`;
}

/**
 * Wait for a download to land, then open the saved file in a new tab.
 *
 * The listener is registered here rather than at the top of `main()` — the
 * exception to §E1, and a narrow one. That rule exists so a listener is in
 * place before the event that woke the worker arrives; this one waits on an
 * event the worker itself just caused, and it removes itself, so a permanent
 * listener would have to re-derive which download it was looking at.
 *
 * **Opening needs "Allow access to file URLs" on the extension**, which only
 * the user can grant from `chrome://extensions`. Without it the tab is refused,
 * and that is not worth failing the export over — the file is already saved.
 * The timeout is the same reasoning: a download that never reports `complete`
 * leaves the worker holding a promise forever.
 */
async function openWhenComplete(downloadId: number): Promise<void> {
  const settled = await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => finish(false), 15_000);

    const finish = (ok: boolean): void => {
      clearTimeout(timer);
      browser.downloads.onChanged.removeListener(onChanged);
      resolve(ok);
    };

    function onChanged(delta: { id: number; state?: { current?: string } }): void {
      if (delta.id !== downloadId) return;
      if (delta.state?.current === 'complete') finish(true);
      if (delta.state?.current === 'interrupted') finish(false);
    }

    browser.downloads.onChanged.addListener(onChanged);
  });

  if (!settled) return;

  try {
    const [ item ] = await browser.downloads.search({ id: downloadId });
    if (!item?.filename) return;

    // A path is not a URL: spaces and non-ASCII in a page title survive into the
    // filename and have to be escaped, or the tab opens on a truncated path.
    //
    // Select the result immediately. The next export targets the active tab, so
    // the user returns to the source page before choosing another format.
    await browser.tabs.create({
      url: `file://${item.filename.split('/').map(encodeURIComponent).join('/')}`,
      active: true
    });
  } catch {
    // No file-URL access, or the file moved. The download itself still stands.
  }
}

/** Clear or set the toolbar badge, tolerating the action being unavailable. */
async function finishBadge(text: string): Promise<void> {
  try {
    await browser.action.setBadgeText({ text });
  } catch {
    // The action is gone — the window closed mid-run. Nothing to report to.
  }
}

/** A filename from the page title, stripped to what every filesystem accepts. */
function fileNameFor(title: string | undefined, format: ExportFormat): string {
  const stem = (title ?? 'page')
    // A tab showing a local file is titled with that file's name, so exporting
    // one would otherwise stack a second extension and a second timestamp onto
    // the first. Dropping a trailing extension keeps the name readable even
    // when the source really was a downloaded file.
    .replace(/\.(png|pdf|html?|md|jpe?g|webp|txt)$/i, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
    .toLowerCase() || 'page';

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

  return `${stem}-${stamp}.${format}`;
}
