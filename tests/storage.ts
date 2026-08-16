import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { settings, captureProgress, lastMarkdown, DEFAULT_SETTINGS } from '@/storage';

/**
 * The service worker keeps no state, so every claim about what the extension
 * remembers is a claim about this module.
 *
 * The migration is the case worth the most here. A missing one fails in exactly
 * one direction — fine on a fresh install, broken for everyone who already had
 * the extension — so it is invisible to any check that starts from empty
 * storage, which is every other test in this file.
 */

describe('storage', () => {

  beforeEach(() => {
    fakeBrowser.reset();
  });

  describe('settings', () => {

    it('falls back to the defaults on a profile that has never stored them', async () => {
      await expect(settings.getValue()).resolves.toEqual(DEFAULT_SETTINGS);
      expect(DEFAULT_SETTINGS).toEqual({ openAfterDownload: true });
    });

    it('round-trips a stored value', async () => {
      await settings.setValue({ openAfterDownload: false });

      await expect(settings.getValue()).resolves.toEqual({ openAfterDownload: false });
    });

    it('keeps settings in local storage, which survives a browser restart', async () => {
      await settings.setValue({ openAfterDownload: true });

      await expect(fakeBrowser.storage.local.get('settings')).resolves.toEqual({
        settings: { openAfterDownload: true }
      });
      await expect(fakeBrowser.storage.session.get('settings')).resolves.toEqual({});
    });

    it('migrates a v1 record forward and drops retired fields', async () => {
      // A v1 record predates `openAfterDownload` and carries no version
      // metadata, so the library reads it as v1. Seeded through the raw area
      // rather than the item, because the item is what is under test.
      await fakeBrowser.storage.local.set({ settings: { enabled: false } });

      await settings.migrate();

      await expect(settings.getValue()).resolves.toEqual({ openAfterDownload: true });
    });

    it('stamps the new version so the migration does not run twice', async () => {
      await fakeBrowser.storage.local.set({ settings: { enabled: false } });

      await settings.migrate();

      await expect(settings.getMeta()).resolves.toEqual({ v: 4 });
    });

    it('leaves a record already at the current version untouched', async () => {
      await fakeBrowser.storage.local.set({ settings: { openAfterDownload: false }, settings$: { v: 4 } });

      await settings.migrate();

      await expect(settings.getValue()).resolves.toEqual({ openAfterDownload: false });
    });

  });

  describe('session-scoped items', () => {

    it('reports no capture running before anything has started one', async () => {
      await expect(captureProgress.getValue()).resolves.toEqual({
        state: 'idle',
        format: null,
        title: '',
        url: '',
        fileName: '',
        message: ''
      });
    });

    it('keeps progress in session storage, which the worker restart does not outlive', async () => {
      await captureProgress.setValue({
        state: 'running',
        format: 'png',
        title: 'A page',
        url: 'https://example.com/',
        fileName: 'a-page.png',
        message: 'Exporting PNG…'
      });

      await expect(fakeBrowser.storage.session.get('capture-progress')).resolves.toEqual({
        'capture-progress': {
          state: 'running',
          format: 'png',
          title: 'A page',
          url: 'https://example.com/',
          fileName: 'a-page.png',
          message: 'Exporting PNG…'
        }
      });
      await expect(fakeBrowser.storage.local.get('capture-progress')).resolves.toEqual({});
    });

    it('keeps the last Markdown export out of local storage', async () => {
      // `local:` would leave the full text of the last page read on disk
      // indefinitely, which is a privacy cost the viewer does not need to pay.
      await lastMarkdown.setValue('# Captured\n');

      await expect(fakeBrowser.storage.session.get('last-markdown')).resolves.toEqual({
        'last-markdown': '# Captured\n'
      });
      await expect(fakeBrowser.storage.local.get('last-markdown')).resolves.toEqual({});
    });

    it('defaults the ephemeral items to empty rather than undefined', async () => {
      await expect(lastMarkdown.getValue()).resolves.toBe('');
    });

  });

});
