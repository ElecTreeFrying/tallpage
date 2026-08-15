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
 * The listener returns a promise rather than calling `sendResponse`. Chrome
 * reads a returned promise as "reply when this resolves"; the callback form
 * needs a bare `return true` to hold the channel open, and omitting it is the
 * classic cause of a message that never comes back.
 */
export function registerHandlers(handlers: Handlers): void {
  browser.runtime.onMessage.addListener((message: Message, sender: Browser.runtime.MessageSender) => {
    const handler = handlers[message.type];
    if (!handler) return;

    return Promise.resolve(handler(message as never, sender));
  });
}
