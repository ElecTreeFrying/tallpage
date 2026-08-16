import { describe, it, expect, beforeEach } from 'vitest';
import { browser } from '#imports';
import { withDebugger } from '@/debugger-session';

/**
 * This module is one `finally`, and that `finally` is the product decision: a
 * session left attached pins Chrome's "started debugging this browser" bar on
 * screen with no way for the user to dismiss it, and blocks DevTools on that tab
 * until the browser restarts. There is no recovery path from inside the
 * extension, so every failure route is asserted rather than the happy one only.
 */

interface Stub {

  /** Attach, command and detach calls in the order they were made. */
  events: string[];

}

function stubDebugger(options: { failCommand?: string; failDetach?: boolean } = {}): Stub {
  const events: string[] = [];

  const attach = async (_target: unknown, version: string): Promise<void> => {
    events.push(`attach:${version}`);
  };

  const sendCommand = async (_target: unknown, method: string): Promise<unknown> => {
    events.push(`send:${method}`);
    if (options.failCommand === method) throw new Error(`${method} refused`);

    return undefined;
  };

  const detach = async (): Promise<void> => {
    events.push('detach');
    if (options.failDetach) throw new Error('No debugger is attached to this target');
  };

  // `browser.debugger` is outside the in-memory fake, so it is supplied here.
  browser.debugger = { attach, sendCommand, detach } as unknown as typeof browser.debugger;

  return { events };
}

describe('withDebugger', () => {

  beforeEach(() => {
    stubDebugger();
  });

  it('attaches at protocol 1.3, enables the page, then detaches', async () => {
    const stub = stubDebugger();

    await withDebugger(7, async () => 'done');

    expect(stub.events).toEqual([ 'attach:1.3', 'send:Page.enable', 'detach' ]);
  });

  it('returns what the run returned', async () => {
    await expect(withDebugger(7, async () => ({ bytes: 12 }))).resolves.toEqual({ bytes: 12 });
  });

  it('runs the work after the session is live, never before', async () => {
    const stub = stubDebugger();

    await withDebugger(7, async () => {
      stub.events.push('run');

      return null;
    });

    expect(stub.events).toEqual([ 'attach:1.3', 'send:Page.enable', 'run', 'detach' ]);
  });

  it('detaches when the run throws, and surfaces the run’s own error', async () => {
    const stub = stubDebugger();

    await expect(withDebugger(7, async () => {
      throw new Error('Canvas ceiling exceeded');
    })).rejects.toThrow('Canvas ceiling exceeded');

    expect(stub.events).toEqual([ 'attach:1.3', 'send:Page.enable', 'detach' ]);
  });

  it('detaches when enabling the page fails', async () => {
    const stub = stubDebugger({ failCommand: 'Page.enable' });

    await expect(withDebugger(7, async () => 'unreachable')).rejects.toThrow('Page.enable refused');

    expect(stub.events).toEqual([ 'attach:1.3', 'send:Page.enable', 'detach' ]);
  });

  it('does not let a failing detach replace the error that actually mattered', async () => {
    // Detaching throws when the tab was closed mid-run, which is precisely when
    // the run has already failed for a reason worth reporting. Reporting "no
    // debugger is attached" instead would send anyone debugging this the wrong
    // way entirely.
    stubDebugger({ failDetach: true });

    await expect(withDebugger(7, async () => {
      throw new Error('Page.captureScreenshot timed out');
    })).rejects.toThrow('Page.captureScreenshot timed out');
  });

  it('does not fail a completed run because the detach threw', async () => {
    stubDebugger({ failDetach: true });

    await expect(withDebugger(7, async () => 'captured')).resolves.toBe('captured');
  });

  it('does not attempt the run when attaching fails', async () => {
    const events: string[] = [];

    browser.debugger = {
      attach: async (): Promise<void> => {
        throw new Error('Another debugger is already attached');
      },
      sendCommand: async (): Promise<unknown> => undefined,
      detach: async (): Promise<void> => {
        events.push('detach');
      }
    } as unknown as typeof browser.debugger;

    await expect(withDebugger(7, async () => {
      events.push('run');

      return null;
    })).rejects.toThrow('Another debugger is already attached');

    // The attach never succeeded, so there is no session to release.
    expect(events).toEqual([]);
  });

});
