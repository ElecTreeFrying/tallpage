import { describe, it, expect, beforeEach } from 'vitest';
import { browser } from '#imports';
import { captureFullPage } from '@/capture';

/**
 * The engine's correctness is a claim about the *order and shape* of its
 * protocol commands, which is exactly what a stub can hold to account.
 *
 * The mechanism is `Emulation.setDeviceMetricsOverride` resizing the viewport to
 * the document before a single paint. `captureBeyondViewport: true` is the
 * plausible-looking alternative that tiles one screenful down the whole image,
 * and the difference between the two is invisible in any type or build check —
 * it shows up as a wrong PNG.
 */

interface Size {

  width: number;

  height: number;

}

interface LayoutReply {

  cssContentSize?: Size;

  contentSize?: Size;

}

interface Sent {

  method: string;

  params: Record<string, unknown>;

}

interface Stub {

  sent: Sent[];

  methods: () => string[];

  paramsOf: (method: string) => Record<string, unknown>;

}

const SHOT = 'png-bytes';

function stubDebugger(options: { metrics?: LayoutReply[]; ratio?: number; failScreenshot?: boolean } = {}): Stub {
  const metrics = options.metrics ?? [ { cssContentSize: { width: 800, height: 600 } } ];
  const sent: Sent[] = [];
  let measured = 0;

  const sendCommand = async (_target: unknown, method: string, params?: Record<string, unknown>): Promise<unknown> => {
    sent.push({ method, params: params ?? {} });

    if (method === 'Page.getLayoutMetrics') {
      const reply = metrics[Math.min(measured, metrics.length - 1)];
      measured += 1;

      return reply;
    }

    if (method === 'Runtime.evaluate') return { result: { value: options.ratio ?? 1 } };

    if (method === 'Page.captureScreenshot') {
      if (options.failScreenshot) throw new Error('Unable to capture screenshot');

      return { data: btoa(SHOT) };
    }

    return undefined;
  };

  browser.debugger = {
    attach: async (): Promise<void> => undefined,
    detach: async (): Promise<void> => undefined,
    sendCommand
  } as unknown as typeof browser.debugger;

  return {
    sent,
    methods: () => sent.map((entry) => entry.method),
    paramsOf: (method) => {
      const found = sent.find((entry) => entry.method === method);
      if (!found) throw new Error(`${method} was never sent`);

      return found.params;
    }
  };
}

describe('captureFullPage', () => {

  beforeEach(() => {
    stubDebugger();
  });

  it('resizes the emulated viewport to the document before painting', async () => {
    const stub = stubDebugger({ metrics: [ { cssContentSize: { width: 1024, height: 7200 } } ] });

    await captureFullPage(1);

    const methods = stub.methods();
    expect(methods.indexOf('Emulation.setDeviceMetricsOverride')).toBeLessThan(methods.indexOf('Page.captureScreenshot'));
    expect(stub.paramsOf('Emulation.setDeviceMetricsOverride')).toMatchObject({ width: 1024, height: 7200, mobile: false });
  });

  it('does not ask for pixels beyond the viewport', async () => {
    // `captureBeyondViewport: true` without the resize is the documented wrong
    // turn: the compositor repeats the one viewport it has and tiles the same
    // screenful down the image.
    const stub = stubDebugger();

    await captureFullPage(1);

    const screenshot = stub.paramsOf('Page.captureScreenshot');
    expect(screenshot).toMatchObject({ format: 'png', captureBeyondViewport: false });
    expect(screenshot).not.toHaveProperty('clip');
  });

  it('clears the viewport override once the capture is done', async () => {
    const stub = stubDebugger();

    await captureFullPage(1);

    expect(stub.methods()).toContain('Emulation.clearDeviceMetricsOverride');
  });

  it('clears the viewport override even when the capture fails', async () => {
    // A page left under an override renders at the wrong size for as long as
    // the tab lives, which the user sees and cannot explain.
    const stub = stubDebugger({ failScreenshot: true });

    await expect(captureFullPage(1)).rejects.toThrow('Unable to capture screenshot');

    expect(stub.methods()).toContain('Emulation.clearDeviceMetricsOverride');
  });

  it('re-measures after the resize and applies the settled height before capturing', async () => {
    // Laying out at full height can change the document's own height — a
    // responsive breakpoint, or content that reflows once it stops being
    // clipped. The second reading is the one that matches what gets painted.
    const stub = stubDebugger({
      metrics: [ { cssContentSize: { width: 800, height: 600 } }, { cssContentSize: { width: 800, height: 2400 } } ]
    });

    const captured = await captureFullPage(1);

    const resizes = stub.sent.filter((entry) => entry.method === 'Emulation.setDeviceMetricsOverride');
    expect(resizes).toHaveLength(2);
    expect(resizes[1]?.params).toMatchObject({ width: 800, height: 2400 });
    expect(stub.methods().lastIndexOf('Emulation.setDeviceMetricsOverride')).toBeLessThan(stub.methods().indexOf('Page.captureScreenshot'));
    expect(captured.cssHeight).toBe(2400);
  });

  it('keeps a retina page retina when it fits inside the limit', async () => {
    const stub = stubDebugger({ metrics: [ { cssContentSize: { width: 800, height: 600 } } ], ratio: 2 });

    await captureFullPage(1);

    expect(stub.paramsOf('Emulation.setDeviceMetricsOverride')).toMatchObject({ deviceScaleFactor: 2 });
  });

  it('reduces the scale rather than cropping a page past the screenshot limit', async () => {
    // Chrome refuses a screenshot over 16384px on either axis. Coming back whole
    // and softer is the opposite trade to coming back crisp and truncated.
    const stub = stubDebugger({ metrics: [ { cssContentSize: { width: 1000, height: 20_000 } } ], ratio: 2 });

    await captureFullPage(1);

    const scale = stub.paramsOf('Emulation.setDeviceMetricsOverride')['deviceScaleFactor'] as number;
    expect(scale).toBeCloseTo(16_384 / 20_000, 6);
    expect(20_000 * scale).toBeLessThanOrEqual(16_384);
  });

  it('prefers the CSS-pixel metric over the legacy one', async () => {
    const stub = stubDebugger({
      metrics: [ { cssContentSize: { width: 800, height: 600 }, contentSize: { width: 1600, height: 1200 } } ]
    });

    await captureFullPage(1);

    expect(stub.paramsOf('Emulation.setDeviceMetricsOverride')).toMatchObject({ width: 800, height: 600 });
  });

  it('falls back to the legacy metric when the CSS one is absent', async () => {
    const stub = stubDebugger({ metrics: [ { contentSize: { width: 640, height: 480 } } ] });

    await captureFullPage(1);

    expect(stub.paramsOf('Emulation.setDeviceMetricsOverride')).toMatchObject({ width: 640, height: 480 });
  });

  it('returns the renderer’s PNG bytes untouched', async () => {
    // The PNG export downloads exactly these bytes. Anything that decodes and
    // re-encodes here would put a canvas — and its size ceiling — back in the
    // path this engine exists to keep out of it.
    stubDebugger();

    const captured = await captureFullPage(1);

    expect(captured.png.type).toBe('image/png');
    await expect(captured.png.text()).resolves.toBe(SHOT);
  });

});
