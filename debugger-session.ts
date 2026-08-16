import { browser } from '#imports';

/**
 * One attached DevTools Protocol session, released whatever happens.
 *
 * Every export needs the debugger — visual capture resizes the viewport and
 * paints, while HTML and Markdown run serializers in the page — so the attach
 * belongs to none of the producers and sits here instead.
 *
 * **The `finally` is the whole point of the module.** A session left attached
 * keeps Chrome's "started debugging this browser" bar on screen with no way for
 * the user to dismiss it, and blocks DevTools from opening on that tab until
 * the browser restarts. There is no recovery path from inside the extension, so
 * the release cannot be conditional on the work succeeding.
 */

/** The DevTools Protocol version to attach with. */
const PROTOCOL_VERSION = '1.3';

export async function withDebugger<T>(tabId: number, run: () => Promise<T>): Promise<T> {
  await browser.debugger.attach({ tabId }, PROTOCOL_VERSION);

  try {
    await browser.debugger.sendCommand({ tabId }, 'Page.enable');

    return await run();
  } finally {
    // Detaching can itself throw — the tab may have been closed mid-run — and
    // that must not replace the real error with a misleading one.
    try {
      await browser.debugger.detach({ tabId });
    } catch {
      // The session is gone either way, which is the outcome this wanted.
    }
  }
}
