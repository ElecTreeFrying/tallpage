import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { sendMessage, registerHandlers } from '@/messaging';
import type { Message } from '@/messaging';
import type { ExportFormat } from '@/storage';

/**
 * The protocol's whole purpose is that a reply comes back, so these go through a
 * real send rather than calling a handler directly.
 *
 * The failure being guarded against is invisible to the type checker: a listener
 * that does not hold the channel open resolves the sender's promise to
 * `undefined`, and every signature on both sides still agrees. Only a round trip
 * catches it.
 */

describe('registerHandlers', () => {

  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('routes a message to its handler and returns the reply', async () => {
    registerHandlers({
      ping: () => ({ pong: true, at: 1 }),
      capture: () => ({ ok: true })
    });

    await expect(sendMessage({ type: 'ping' })).resolves.toEqual({ pong: true, at: 1 });
  });

  it('waits for an asynchronous handler and replies with what it resolved to', async () => {
    // The capture handler is asynchronous in production — it attaches the
    // debugger and paints a whole page. The listener must return a literal
    // `true` while that promise settles, or the reply channel closes early.
    registerHandlers({
      ping: () => ({ pong: true, at: 1 }),
      capture: async () => {
        await Promise.resolve();

        return { ok: true, captured: 4096, requested: 4096 };
      }
    });

    await expect(sendMessage({ type: 'capture', format: 'png' })).resolves.toEqual({
      ok: true,
      captured: 4096,
      requested: 4096
    });
  });

  it('carries the payload through to the handler', async () => {
    const formats: ExportFormat[] = [];

    registerHandlers({
      ping: () => ({ pong: true, at: 1 }),
      capture: (message) => {
        formats.push(message.format);

        return { ok: true };
      }
    });

    await sendMessage({ type: 'capture', format: 'md' });
    await sendMessage({ type: 'capture', format: 'html' });

    expect(formats).toEqual([ 'md', 'html' ]);
  });

  it('reports a failure the caller can act on rather than throwing', async () => {
    // The popup closes on click, so a rejected promise would have nowhere to
    // land. A failure has to arrive as a value.
    registerHandlers({
      ping: () => ({ pong: true, at: 1 }),
      capture: () => ({ ok: false, error: 'Browser pages cannot be captured' })
    });

    await expect(sendMessage({ type: 'capture', format: 'png' })).resolves.toEqual({
      ok: false,
      error: 'Browser pages cannot be captured'
    });
  });

  it('reports a short capture without calling it a failure', async () => {
    registerHandlers({
      ping: () => ({ pong: true, at: 1 }),
      capture: () => ({ ok: true, captured: 32_767, requested: 51_200 })
    });

    const reply = await sendMessage({ type: 'capture', format: 'pdf' });

    expect(reply.ok).toBe(true);
    expect(reply.captured).toBeLessThan(reply.requested ?? 0);
  });

  it('passes the sender through to the handler', async () => {
    const capture = vi.fn(() => ({ ok: true }));

    registerHandlers({
      ping: () => ({ pong: true, at: 1 }),
      capture
    });

    await fakeBrowser.runtime.onMessage.trigger({ type: 'capture', format: 'png' }, { id: 'sender' }, () => undefined);

    expect(capture).toHaveBeenCalledWith({ type: 'capture', format: 'png' }, { id: 'sender' });
  });

  it('ignores a name it does not know instead of failing the listener', async () => {
    const capture = vi.fn(() => ({ ok: true }));

    registerHandlers({
      ping: () => ({ pong: true, at: 1 }),
      capture
    });

    // A surface left over from an older build may still send a name this one
    // dropped. Returning undefined releases the channel; throwing here would
    // take the listener down for every other message too.
    await expect(fakeBrowser.runtime.sendMessage({ type: 'retired' } as unknown as Message)).resolves.toBeUndefined();
    expect(capture).not.toHaveBeenCalled();
  });

});
