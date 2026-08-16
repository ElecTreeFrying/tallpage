import { browser } from '#imports';
import type { Browser } from 'wxt/browser';
import type { ExportFormat } from '@/storage';

/**
 * The typed protocol between extension surfaces.
 *
 * `browser.runtime.sendMessage` is `any` in and `any` out, so a mistyped message
 * name fails silently at runtime instead of loudly at compile time. The two
 * types below close that: add a variant to `Message`, add its reply to
 * `MessageReplies`, and both ends are forced to agree.
 */

export type Message =
  | { type: 'ping' }
  | { type: 'capture'; format: ExportFormat };

export interface MessageReplies {

  ping: { pong: true; at: number };

  capture: CaptureReply;

}

/**
 * The popup fires this and closes, so nothing is waiting for the reply on a
 * successful run — the toolbar badge and the download are the real feedback.
 * It is still typed and still returned, because a failure that resolves before
 * the popup dies is the one the user can actually be told about.
 */
export interface CaptureReply {

  ok: boolean;

  /** Present when `ok` is false. */
  error?: string;

  /** CSS pixels captured. Short of `requested` when the canvas cap bit. */
  captured?: number;

  /** CSS pixels the page reported. */
  requested?: number;

}

/** Send from any surface — popup, options, sidepanel or content script. */
export function sendMessage<T extends Message['type']>(message: Extract<Message, { type: T }>): Promise<MessageReplies[T]> {
  return browser.runtime.sendMessage(message) as Promise<MessageReplies[T]>;
}

type Handlers = {
  [K in Message['type']]: (message: Extract<Message, { type: K }>, sender: Browser.runtime.MessageSender) => MessageReplies[K] | Promise<MessageReplies[K]>;
};

/**
 * Register every handler in one call, from the background script.
 *
 * The listener calls `sendResponse` and returns the literal `true` that keeps
 * the channel open while an asynchronous handler settles. This is the stable
 * contract across supported Chromium versions. Returning the promise directly
 * starts at Chrome 148 and is still on a staged rollout, so it cannot be the
 * baseline yet.
 */
export function registerHandlers(handlers: Handlers): void {
  browser.runtime.onMessage.addListener((message: Message, sender: Browser.runtime.MessageSender, sendResponse) => {
    const handler = handlers[message.type];
    if (!handler) return;

    void Promise.resolve(handler(message as never, sender)).then(sendResponse);

    return true;
  });
}
