import { storage } from '#imports';

/**
 * Every persisted value the extension owns.
 *
 * The background script is an MV3 service worker: it is torn down after roughly
 * 30 seconds idle and restarted on the next event, so nothing held in a module
 * variable survives. Storage is the only place state can actually live, which
 * makes this module the extension's real memory rather than a convenience.
 *
 * Key prefixes select the backing area:
 *
 * | Prefix     | Lives                                        |
 * | ---------- | -------------------------------------------- |
 * | `local:`   | ~10MB, this device, survives restarts        |
 * | `session:` | in memory, cleared on browser close          |
 * | `sync:`    | ~100KB, synced across signed-in profiles     |
 * | `managed:` | read-only, set by enterprise policy          |
 */

export interface Settings {

  enabled: boolean;

}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true
};

/**
 * Bump `version` whenever the shape of `Settings` changes and add the matching
 * migration. Skipping that is the usual cause of an extension that works on a
 * fresh install and throws for everyone who already had it.
 */
export const settings = storage.defineItem<Settings>('local:settings', {
  fallback: DEFAULT_SETTINGS,
  version: 1,
  migrations: {
  }
});

/** Ephemeral by design — the right home for anything that must not outlive the browser session. */
export const lastRunAt = storage.defineItem<number | null>('session:last-run-at', {
  fallback: null
});
