import { browser } from '#imports';

/**
 * The page as one portable HTML snapshot.
 *
 * A screenshot is pixels; this is the document. Stylesheets, images and CSS
 * assets are pulled in and rewritten as `data:` URIs when the page allows it.
 * A resource that is cross-origin without CORS or too large keeps its absolute
 * URL, so the archive remains useful without pretending every site can be made
 * completely standalone from page context.
 * That difference matters on anything client-rendered: the served HTML is a
 * shell, and the DOM is the page.
 *
 * **Scripts and automatic navigation are stripped on purpose.** An archive that
 * re-runs its own JavaScript is not an archive — it re-fetches, re-renders, and
 * usually erases the state that was worth saving. Links remain links, and a
 * resource that could not be embedded may still reach its original host when
 * the file opens.
 *
 * The serializer below runs inside the page through `Runtime.evaluate`, so it
 * is stringified and re-parsed there and must close over nothing from this
 * module. Everything it needs is declared inside it.
 */

/** A resource past this size is left as a live URL rather than inlined. */
const MAX_INLINE_BYTES = 8_000_000;

/**
 * Walk the live DOM and return a standalone HTML document.
 *
 * Runs in the page. Every failure path is deliberately soft: a resource that
 * cannot be fetched — cross-origin without CORS, expired, too large — keeps its
 * absolute URL instead of aborting the export. A partly-inlined archive is
 * worth far more than none.
 */
async function serializeDocument(maxBytes: number): Promise<string> {
  const absolute = (url: string, base: string): string => {
    try {
      return new URL(url, base).href;
    } catch {
      return url;
    }
  };

  const fetchBlob = async (url: string): Promise<Blob | null> => {
    if (!url || url.startsWith('data:') || url.startsWith('blob:')) return null;

    try {
      const response = await fetch(url, { credentials: 'same-origin' });
      if (!response.ok) return null;

      const blob = await response.blob();

      return blob.size > maxBytes ? null : blob;
    } catch {
      return null;
    }
  };

  const toDataUrl = async (url: string): Promise<string | null> => {
    const blob = await fetchBlob(url);
    if (!blob) return null;

    return new Promise<string | null>((resolve) => {
      const reader = new FileReader();

      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  };

  const fetchText = async (url: string): Promise<string | null> => {
    const blob = await fetchBlob(url);

    return blob ? blob.text() : null;
  };

  /** Rewrite every `url()` inside a stylesheet, resolved against that sheet's own address. */
  const inlineCssUrls = async (css: string, base: string): Promise<string> => {
    const pattern = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
    const seen = new Map<string, string>();

    for (const match of Array.from(css.matchAll(pattern))) {
      const raw = match[2];
      if (!raw || raw.startsWith('data:') || seen.has(raw)) continue;

      const resolved = absolute(raw, base);
      seen.set(raw, (await toDataUrl(resolved)) ?? resolved);
    }

    return css.replace(pattern, (whole, _quote: string, raw: string) => {
      const replacement = seen.get(raw);

      return replacement ? `url("${replacement}")` : whole;
    });
  };

  const clone = document.documentElement.cloneNode(true) as HTMLElement;

  for (const script of Array.from(clone.querySelectorAll('script'))) script.remove();
  for (const frame of Array.from(clone.querySelectorAll('iframe, frame, object, embed'))) frame.remove();

  for (const meta of Array.from(clone.querySelectorAll<HTMLMetaElement>('meta[http-equiv]'))) {
    const directive = (meta.getAttribute('http-equiv') ?? '').toLowerCase();
    if (directive === 'content-security-policy' || directive === 'refresh') meta.remove();
  }

  for (const element of Array.from(clone.querySelectorAll<HTMLElement>('*'))) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();

      if (name.startsWith('on')) element.removeAttribute(attribute.name);
      if (name === 'autoplay' || name === 'formaction' || name === 'ping') element.removeAttribute(attribute.name);
      if ([ 'href', 'src', 'action', 'formaction', 'xlink:href' ].includes(name) && /^javascript:/i.test(value)) {
        element.removeAttribute(attribute.name);
      }
    }
  }

  for (const form of Array.from(clone.querySelectorAll('form'))) {
    form.setAttribute('action', 'about:blank');
    form.setAttribute('method', 'get');
    form.removeAttribute('target');
  }

  // `<link rel="preload">`, `<link rel="modulepreload">` and friends only point
  // at things the archive no longer needs, and a dead preload logs an error on
  // open. Stylesheets are handled below; the rest go.
  for (const link of Array.from(clone.querySelectorAll<HTMLLinkElement>('link'))) {
    const rel = (link.getAttribute('rel') ?? '').toLowerCase();
    if (!rel.includes('stylesheet') && !rel.includes('icon')) link.remove();
  }

  for (const link of Array.from(clone.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"]'))) {
    const href = absolute(link.getAttribute('href') ?? '', document.baseURI);
    const css = await fetchText(href);

    if (css === null) {
      link.setAttribute('href', href);
      continue;
    }

    const style = document.createElement('style');
    style.textContent = await inlineCssUrls(css, href);
    link.replaceWith(style);
  }

  for (const style of Array.from(clone.querySelectorAll('style'))) {
    style.textContent = await inlineCssUrls(style.textContent ?? '', document.baseURI);
  }

  // Paired by index against the LIVE document, because `currentSrc` is the only
  // way to know which candidate a `srcset` actually resolved to — the clone has
  // the attribute but never picked from it.
  const liveImages = Array.from(document.querySelectorAll('img'));
  const clonedImages = Array.from(clone.querySelectorAll('img'));

  for (let index = 0; index < clonedImages.length; index += 1) {
    const cloned = clonedImages[index]!;
    const live = liveImages[index];
    const chosen = live?.currentSrc || cloned.getAttribute('src') || '';

    cloned.removeAttribute('srcset');
    cloned.removeAttribute('loading');

    if (!chosen || chosen.startsWith('data:')) continue;

    const resolved = absolute(chosen, document.baseURI);
    cloned.setAttribute('src', (await toDataUrl(resolved)) ?? resolved);
  }

  // With `src` pinned to what was displayed, a surviving `<source>` would let
  // the browser re-choose a candidate that is no longer inlined.
  for (const source of Array.from(clone.querySelectorAll('picture source'))) source.remove();

  // Last resort for anything still relative — a link, a media source, an
  // attribute nobody thought to rewrite.
  const head = clone.querySelector('head');
  if (head) {
    const base = document.createElement('base');
    base.setAttribute('href', document.baseURI);
    head.prepend(base);
  }

  return `<!DOCTYPE html>\n${clone.outerHTML}`;
}

/**
 * Serialize the page of `tabId`, assuming the debugger is already attached.
 *
 * `awaitPromise` is what makes the async serializer usable — without it the
 * protocol returns the pending promise object and the archive is the string
 * "[object Promise]".
 */
export async function captureHtml(tabId: number): Promise<Blob> {
  const result = await browser.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
    expression: `(${serializeDocument.toString()})(${MAX_INLINE_BYTES})`,
    awaitPromise: true,
    returnByValue: true
  }) as { result?: { value?: string }; exceptionDetails?: { text?: string } };

  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? 'Page serialization failed');

  return new Blob([ result.result?.value ?? '' ], { type: 'text/html' });
}
