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

/**
 * What a capture is written out as.
 *
 * PNG and PDF are the same pixels — PDF wraps the raster. HTML is a different
 * artefact entirely: the live DOM saved as one self-contained document, with
 * text that is still text.
 */
export type ExportFormat = 'png' | 'pdf' | 'html' | 'md';

export interface Settings {

  enabled: boolean;

  format: ExportFormat;

}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  format: 'png'
};

/**
 * Bump `version` whenever the shape of `Settings` changes and add the matching
 * migration. Skipping that is the usual cause of an extension that works on a
 * fresh install and throws for everyone who already had it.
 */
export const settings = storage.defineItem<Settings>('local:settings', {
  fallback: DEFAULT_SETTINGS,
  version: 2,
  migrations: {
    2: (previous: Partial<Settings>): Settings => ({ ...DEFAULT_SETTINGS, ...previous })
  }
});

/** Ephemeral by design — the right home for anything that must not outlive the browser session. */
export const lastRunAt = storage.defineItem<number | null>('session:last-run-at', {
  fallback: null
});

export interface CaptureProgress {

  running: boolean;

  /** 0–1. Meaningless while `running` is false. */
  fraction: number;

}

/**
 * How far the current capture has got.
 *
 * Session-scoped rather than local because a half-finished run is worthless
 * after a browser restart. It lives in storage at all — rather than a variable
 * in the worker — because the worker is torn down when idle and a UI opened
 * mid-run has nowhere else to read from (§E1).
 */
export const captureProgress = storage.defineItem<CaptureProgress>('session:capture-progress', {
  fallback: { running: false, fraction: 0 }
});

/**
 * The most recent Markdown export, for `entrypoints/viewer/` to render.
 *
 * The viewer reads this rather than the `.md` that was just downloaded, so it
 * does not depend on "Allow access to file URLs" — a setting only the user can
 * grant, whose absence would otherwise show an empty page.
 *
 * Session-scoped for two reasons: a rendered export is worthless after a
 * browser restart, and `local:` would keep the full text of the last page read
 * on disk indefinitely.
 */
export const lastMarkdown = storage.defineItem<string>('session:last-markdown', {
  fallback: ''
});
