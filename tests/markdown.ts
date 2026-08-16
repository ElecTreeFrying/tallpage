import { describe, it, expect, beforeEach } from 'vitest';
import { browser } from '#imports';
import { captureMarkdown } from '@/markdown';

/**
 * As with `archive.ts`, the converter itself runs in the page and cannot be
 * imported. The boundary still carries a real invariant: the three tag lists are
 * *arguments*, because a function that is stringified and re-parsed elsewhere
 * cannot close over anything in this module.
 */

interface Evaluation {

  expression: string;

  returnByValue?: boolean;

}

function stubDebugger(reply: unknown): Evaluation[] {
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

  return evaluations;
}

describe('captureMarkdown', () => {

  beforeEach(() => {
    stubDebugger({ result: { value: '' } });
  });

  it('returns the converted document', async () => {
    stubDebugger({ result: { value: '# Title\n\nBody\n' } });

    await expect(captureMarkdown(1)).resolves.toBe('# Title\n\nBody\n');
  });

  it('asks for the value itself, not a remote object handle', async () => {
    const evaluations = stubDebugger({ result: { value: '' } });

    await captureMarkdown(1);

    expect(evaluations[0]).toMatchObject({ returnByValue: true });
  });

  it('passes all three tag lists in as arguments', async () => {
    const evaluations = stubDebugger({ result: { value: '' } });

    await captureMarkdown(1);

    const expression = evaluations[0]?.expression ?? '';

    // One token from each list. The allowlist of inline tags is the load-bearing
    // one: a fixed block list would flatten every custom element a framework
    // renders, so it must reach the page intact.
    expect(expression).toContain('"SCRIPT STYLE NOSCRIPT');
    expect(expression).toContain('"A SPAN STRONG');
    expect(expression).toContain('"ADDRESS ARTICLE');
  });

  it('invokes the converter immediately rather than merely defining it', async () => {
    const evaluations = stubDebugger({ result: { value: '' } });

    await captureMarkdown(1);

    expect(evaluations[0]?.expression.startsWith('(')).toBe(true);
    expect(evaluations[0]?.expression.endsWith(')')).toBe(true);
  });

  it('raises the page’s own exception text when the converter throws', async () => {
    stubDebugger({ exceptionDetails: { text: 'Uncaught TypeError' } });

    await expect(captureMarkdown(1)).rejects.toThrow('Uncaught TypeError');
  });

  it('still fails loudly when the exception carries no text', async () => {
    stubDebugger({ exceptionDetails: {} });

    await expect(captureMarkdown(1)).rejects.toThrow('Markdown conversion failed');
  });

  it('returns an empty document rather than undefined', async () => {
    stubDebugger({ result: {} });

    await expect(captureMarkdown(1)).resolves.toBe('');
  });

});
