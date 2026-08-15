import { defineBackground } from '#imports';
import { registerHandlers } from '@/messaging';
import { lastRunAt } from '@/storage';

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
 */
export default defineBackground(() => {
  registerHandlers({
    ping: async () => {
      const at = Date.now();

      await lastRunAt.setValue(at);

      return { pong: true, at };
    }
  });
});
