import { browser } from '#imports';
import type { RasterImage } from '@/pdf';

/**
 * Full-page capture through the DevTools Protocol.
 *
 * The emulated viewport is resized to the document, the page is given a moment
 * to lay out at that size, and Chrome's renderer paints it once. Nothing here
 * scrolls the page, stitches frames, or reasons about the page's behaviour —
 * which is the entire argument for it.
 *
 * **`captureBeyondViewport: true` is NOT the mechanism**, despite reading like
 * it. It asks for pixels past the viewport edge without telling the renderer
 * the viewport grew, so the compositor repeats the one viewport it has and
 * tiles the same screenful down the image. Resizing through
 * `Emulation.setDeviceMetricsOverride` first is what makes the layout real.
 *
 * **The rejected alternative was scroll-and-stitch** on `tabs.captureVisibleTab`,
 * and its cost is worth recording because it looks cheaper than it is. That API
 * sees only the viewport, so a full page means scrolling and compositing frames
 * by hand, and every page behaviour then becomes a problem to guess at:
 * `position: sticky` needs demoting to `static` while `fixed` needs `absolute`;
 * scroll-triggered reveals must be allowed to finish or they photograph at
 * `opacity: 0`; lazy images need a priming pass; chrome injected *after* the
 * preparation pass never gets demoted at all and repeats once per frame. Each
 * of those is a separate heuristic that fails on a different site. On top of it,
 * `MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND` is 2, so a long page took twelve
 * seconds to get all of that wrong.
 *
 * **What this costs instead** is the `debugger` permission: it cannot be made
 * optional, it warns "Read and change all your data on all websites" at install,
 * and Chrome paints an undismissable "started debugging this browser" bar for
 * the duration of the attach. That is a real price, paid once per capture, in
 * exchange for output that is correct on every page rather than most of them.
 */

/**
 * Chrome refuses a screenshot larger than this on either axis.
 *
 * The device scale factor is reduced rather than the page being cropped, so a
 * very long page comes back complete but less sharp — the opposite trade to
 * returning a crisp fragment of it.
 */
const MAX_SHOT_SIDE = 16_384;

/** Time for the page to re-lay-out after the viewport is resized to the document. */
const RELAYOUT_MS = 250;

interface LayoutMetrics {

  cssContentSize?: { width: number; height: number };

  contentSize?: { width: number; height: number };

}

export interface CapturedPage {

  /** PNG bytes exactly as Chrome's renderer produced them — never re-encoded. */
  png: Blob;

  /** Document width in CSS pixels. */
  cssWidth: number;

  /** Document height in CSS pixels. */
  cssHeight: number;

}

/**
 * Capture the entire document of `tabId`, assuming the debugger is attached.
 *
 * The session itself belongs to `debugger-session.ts`, because the HTML archive
 * needs one too.
 */
export async function captureFullPage(tabId: number): Promise<CapturedPage> {
  const size = await documentSize(tabId);
  const ratio = await devicePixelRatio(tabId);

  // Cap the scale so neither axis passes Chrome's screenshot limit. A tall page
  // comes back whole and softer rather than sharp and truncated.
  const scale = Math.min(ratio, MAX_SHOT_SIDE / Math.max(size.width, size.height, 1));

  // THE step that makes this work. `captureBeyondViewport` on its own asks for
  // pixels past the viewport edge without telling the renderer the viewport
  // grew — so the compositor repeats the one viewport it has, tiling the same
  // screenful down the whole image. Resizing the emulated viewport to the
  // document first means the page genuinely lays out at full height and there
  // is a single render to capture. This is what Puppeteer and Playwright do.
  await browser.debugger.sendCommand({ tabId }, 'Emulation.setDeviceMetricsOverride', {
    width: Math.ceil(size.width),
    height: Math.ceil(size.height),
    deviceScaleFactor: scale,
    mobile: false
  });

  try {
    await new Promise((resolve) => setTimeout(resolve, RELAYOUT_MS));

    // Re-measure: laying out at full height can change the document's own
    // height — a responsive breakpoint, or content that reflows once it is no
    // longer clipped. The second reading is the one that matches what will be
    // painted.
    const settled = await documentSize(tabId);

    const shot = await browser.debugger.sendCommand({ tabId }, 'Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
      clip: { x: 0, y: 0, width: settled.width, height: settled.height, scale }
    }) as { data: string };

    return { png: base64ToBlob(shot.data, 'image/png'), cssWidth: settled.width, cssHeight: settled.height };
  } finally {
    await browser.debugger.sendCommand({ tabId }, 'Emulation.clearDeviceMetricsOverride');
  }
}

/** The full document size in CSS pixels. */
async function documentSize(tabId: number): Promise<{ width: number; height: number }> {
  const metrics = await browser.debugger.sendCommand({ tabId }, 'Page.getLayoutMetrics') as LayoutMetrics;

  // `cssContentSize` is the modern field and is already in CSS pixels;
  // `contentSize` is the older one kept for older protocol builds.
  return metrics.cssContentSize ?? metrics.contentSize ?? { width: 0, height: 0 };
}

/** The page's own pixel ratio, so a retina capture stays retina. */
async function devicePixelRatio(tabId: number): Promise<number> {
  const result = await browser.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
    expression: 'window.devicePixelRatio',
    returnByValue: true
  }) as { result?: { value?: number } };

  return result.result?.value ?? 1;
}

/**
 * Decode the protocol's base64 payload without going through a data URL.
 *
 * The chunking matters at this size: `String.fromCharCode(...bytes)` spreads
 * every byte as a separate argument and overflows the call stack somewhere in
 * the low hundreds of thousands, which a small test page never reaches.
 */
function base64ToBlob(base64: string, type: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);

  return new Blob([ bytes as BlobPart ], { type });
}

/**
 * Re-read the captured PNG as packed RGB samples for the PDF path.
 *
 * Only the PDF needs this, and it is the expensive step in the pipeline: the
 * PNG is decoded to a bitmap, drawn to a canvas, read back as RGBA, and copied
 * down to RGB. The PNG export skips all of it and downloads Chrome's bytes
 * untouched.
 *
 * Chrome caps a canvas at 32,767px per side and 268,435,456px² of area, so a
 * page past either limit cannot be converted. That ceiling applies to the PDF
 * alone — a PNG of any height still works.
 */
export async function toRasterImage(captured: CapturedPage): Promise<RasterImage> {
  const bitmap = await createImageBitmap(captured.png);

  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('OffscreenCanvas 2d context unavailable');

    context.drawImage(bitmap, 0, 0);

    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    const rgb = new Uint8Array(bitmap.width * bitmap.height * 3);

    // The assertions are load-bearing rather than lazy: `noUncheckedIndexedAccess`
    // types every read as possibly-undefined, and a `?? 0` per channel would run
    // three times per pixel across tens of millions of them. The loop is bounded
    // by `pixels.length`, and an RGBA buffer's length is always a multiple of
    // four, so `source + 1` and `source + 2` are in range by construction.
    for (let source = 0, target = 0; source < pixels.length; source += 4, target += 3) {
      rgb[target] = pixels[source]!;
      rgb[target + 1] = pixels[source + 1]!;
      rgb[target + 2] = pixels[source + 2]!;
    }

    return {
      width: bitmap.width,
      height: bitmap.height,
      rgb,
      cssWidth: captured.cssWidth || bitmap.width,
      cssHeight: captured.cssHeight || bitmap.height
    };
  } finally {
    bitmap.close();
  }
}
