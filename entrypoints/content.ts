import { defineContentScript } from '#imports';
import { settings } from '@/storage';

/**
 * Runs inside the page. Plain TypeScript, never Angular — this file is injected
 * into every matched page and has no business carrying a framework runtime
 * (`wxt.config.ts` enforces that boundary through `transformFilter`).
 *
 * Two things that routinely surprise people:
 *
 * - **`matches` is a real gate.** The script is injected only into the URLs
 *   listed here, and each pattern needs a matching `host_permissions` entry in
 *   `wxt.config.ts` before it runs on a published build.
 * - **It runs in an ISOLATED world by default** — same DOM as the page, but a
 *   separate JS heap, so the page's own globals are invisible. `world: 'MAIN'`
 *   shares the page's heap at the cost of the page being able to see and tamper
 *   with this code.
 *
 * `ctx` is WXT's invalidation guard: on a single-page app a content script can
 * outlive the page it was injected into, and `ctx.addEventListener`,
 * `ctx.setTimeout` and `ctx.onInvalidated` clean themselves up instead of
 * leaking. Prefer them over the globals.
 */
export default defineContentScript({
  matches: [ '<all_urls>' ],
  runAt: 'document_idle',

  async main(_ctx) {
    const current = await settings.getValue();
    if (!current.enabled) return;

    // Feature code goes here.
  }
});
