import { browser } from '#imports';
import type { Browser } from 'wxt/browser';

/**
 * The typed protocol between extension surfaces.
 *
 * `browser.runtime.sendMessage` is `any` in and `any` out, so a mistyped message
 * name fails silently at runtime instead of loudly at compile time. The two
 * types below close that: add a variant to `Message`, add its reply to
 * `MessageReplies`, and both ends are forced to agree.
 */

export type Message = { type: 'ping' };

export interface MessageReplies {

  ping: { pong: true; at: number };

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
