import { describe, it, expect, beforeEach } from 'vitest';
import { browser } from '#imports';
import { captureHtml } from '@/archive';

/**
 * `serializeDocument` runs inside the page and is unreachable from here — it is
 * stringified through `Runtime.evaluate`, and it needs a DOM to do anything at
 * all. What is provable at this boundary is the call it is made through, and one
 * flag on that call is the difference between an archive and the string
 * "[object Promise]".
 */

interface Evaluation {

  expression: string;

  awaitPromise?: boolean;

  returnByValue?: boolean;

}

interface Stub {

  evaluations: Evaluation[];

}

function stubDebugger(reply: unknown): Stub {
  const evaluations: Evaluation[] = [];

  const sendCommand = async (_target: unknown, method: string, params?: Record<string, unknown>): Promise<unknown> => {
    if (method === 'Runtime.evaluate') {
      evaluations.push(params as unknown as Evaluation);

      return reply;
    }

    return undefined;
  };

  browser.debugger = {
    attach: async (): Promise<void> => undefined,
    detach: async (): Promise<void> => undefined,
    sendCommand
  } as unknown as typeof browser.debugger;

  return { evaluations };
}

describe('captureHtml', () => {

  beforeEach(() => {
    stubDebugger({ result: { value: '<!DOCTYPE html>\n<html></html>' } });
  });

  it('awaits the serializer’s promise rather than returning the promise itself', async () => {
    // The serializer is async because it fetches every stylesheet and image.
    // Without `awaitPromise` the protocol hands back the pending promise object
    // and the saved file is the literal text "[object Promise]" — a complete
    // failure that still produces a downloadable file of plausible size.
    const stub = stubDebugger({ result: { value: '<!DOCTYPE html>' } });

    await captureHtml(1);

    expect(stub.evaluations[0]).toMatchObject({ awaitPromise: true, returnByValue: true });
  });

  it('passes the size limit into the serializer instead of closing over it', async () => {
    // The function is re-parsed inside the page, so anything it does not receive
    // as an argument is a ReferenceError at run time.
    const stub = stubDebugger({ result: { value: '' } });

    await captureHtml(1);

    expect(stub.evaluations[0]?.expression).toMatch(/\)\(8000000\)$/);
  });

  it('returns the serialized document as an HTML blob', async () => {
    stubDebugger({ result: { value: '<!DOCTYPE html>\n<html><body>hi</body></html>' } });

    const blob = await captureHtml(1);

    expect(blob.type).toBe('text/html');
    await expect(blob.text()).resolves.toBe('<!DOCTYPE html>\n<html><body>hi</body></html>');
  });

  it('raises the page’s own exception text when the serializer throws', async () => {
    stubDebugger({ exceptionDetails: { text: 'Uncaught SecurityError' } });

    await expect(captureHtml(1)).rejects.toThrow('Uncaught SecurityError');
  });

  it('still fails loudly when the exception carries no text', async () => {
    stubDebugger({ exceptionDetails: {} });

    await expect(captureHtml(1)).rejects.toThrow('Page serialization failed');
  });

  it('produces an empty document rather than the word undefined', async () => {
    stubDebugger({ result: {} });

    await expect((await captureHtml(1)).text()).resolves.toBe('');
  });

});
