import { describe, it, expect } from 'vitest';
import { imageToPdf, type RasterImage } from '@/pdf';

/**
 * `pdf.ts` writes a PDF byte by byte, so the assertions here parse the file back
 * rather than compare it to a recorded blob. A hand-written cross-reference
 * table is the part that rots silently — every offset in it is a byte count, and
 * nothing in the type system objects when one drifts.
 */

/** Byte offsets and string indices agree only in a single-byte encoding. */
const latin1 = new TextDecoder('latin1');

function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`expected ${what}`);

  return value;
}

/** Deterministic and not uniform — a constant buffer would compress to nothing and hide a length bug. */
function rgbBytes(width: number, height: number): Uint8Array {
  const rgb = new Uint8Array(width * height * 3);

  for (let index = 0; index < rgb.length; index += 1) rgb[index] = (index * 7) % 256;

  return rgb;
}

function raster(overrides: Partial<RasterImage> = {}): RasterImage {
  const width = overrides.width ?? 8;
  const height = overrides.height ?? 4;

  return {
    width,
    height,
    rgb: overrides.rgb ?? rgbBytes(width, height),
    cssWidth: overrides.cssWidth ?? width,
    cssHeight: overrides.cssHeight ?? height
  };
}

async function bytesOf(image: RasterImage): Promise<Uint8Array> {
  return new Uint8Array(await (await imageToPdf(image)).arrayBuffer());
}

/** The counterpart of the writer's `deflate` — zlib-wrapped, per RFC 1950. */
async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([ bytes as BlobPart ]).stream().pipeThrough(new DecompressionStream('deflate'));

  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Every `/Key value` pair of the image XObject's dictionary. */
function imageDictionary(text: string): string {
  const start = text.indexOf('4 0 obj');

  return text.slice(start, text.indexOf('stream', start));
}

/** The raw, still-compressed sample bytes of object 4. */
function imageStream(bytes: Uint8Array, text: string): Uint8Array {
  const dictionary = imageDictionary(text);
  const length = Number(must(/\/Length (\d+)/.exec(dictionary), 'a /Length in the image dictionary')[1]);
  const start = text.indexOf('stream\n', text.indexOf('4 0 obj')) + 'stream\n'.length;

  return bytes.slice(start, start + length);
}

interface CrossReference {

  size: number;

  /** Byte offset of each object, in object-number order from 1. */
  offsets: number[];

  startxref: number;

}

function crossReference(text: string): CrossReference {
  const tableStart = text.lastIndexOf('\nxref\n') + 1;
  const header = must(/^xref\n0 (\d+)\n/.exec(text.slice(tableStart)), 'an xref header');
  const size = Number(header[1]);
  const entriesStart = tableStart + header[0].length;
  const offsets: number[] = [];

  // Entry zero is the free-list head; the objects themselves run from one.
  for (let index = 1; index < size; index += 1) {
    const entry = text.slice(entriesStart + index * 20, entriesStart + index * 20 + 20);
    offsets.push(Number(entry.slice(0, 10)));
  }

  return { size, offsets, startxref: Number(must(/startxref\n(\d+)\n/.exec(text), 'a startxref')[1]) };
}

describe('imageToPdf', () => {

  it('opens with the version header and the high-byte comment that marks the file binary', async () => {
    const bytes = await bytesOf(raster());

    expect(latin1.decode(bytes.slice(0, 9))).toBe('%PDF-1.7\n');

    // Without these four bytes above 127 on line two, a text-mode transfer is
    // free to rewrite the line endings and quietly corrupt the image stream.
    expect(Array.from(bytes.slice(9, 15))).toEqual([ 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a ]);
  });

  it('compresses the samples as zlib-wrapped deflate, not the raw variant', async () => {
    // The trap the writer documents: `CompressionStream('deflate')` is RFC 1950
    // and `'deflate-raw'` is RFC 1951, which reads backwards. A raw stream under
    // a /FlateDecode filter produces a file every reader rejects, and nothing
    // short of decompressing it notices.
    const image = raster();
    const bytes = await bytesOf(image);
    const text = latin1.decode(bytes);

    expect(imageDictionary(text)).toContain('/Filter /FlateDecode');
    await expect(inflate(imageStream(bytes, text))).resolves.toEqual(image.rgb);
  });

  it('declares a /Length matching the compressed bytes actually written', async () => {
    const bytes = await bytesOf(raster());
    const text = latin1.decode(bytes);
    const declared = Number(must(/\/Length (\d+)/.exec(imageDictionary(text)), 'a /Length')[1]);

    // `endstream` follows the samples after a single newline. A /Length longer
    // or shorter than the payload desynchronises every reader that trusts it.
    const start = text.indexOf('stream\n', text.indexOf('4 0 obj')) + 'stream\n'.length;
    expect(text.slice(start + declared, start + declared + 11)).toBe('\nendstream\n');
  });

  it('points every cross-reference entry at the object it names', async () => {
    const bytes = await bytesOf(raster());
    const text = latin1.decode(bytes);
    const xref = crossReference(text);

    expect(xref.size).toBe(6);
    expect(xref.offsets).toHaveLength(5);

    xref.offsets.forEach((offset, index) => {
      expect(latin1.decode(bytes.slice(offset, offset + `${index + 1} 0 obj`.length))).toBe(`${index + 1} 0 obj`);
    });
  });

  it('points startxref at the cross-reference table', async () => {
    const bytes = await bytesOf(raster());
    const text = latin1.decode(bytes);

    expect(latin1.decode(bytes.slice(crossReference(text).startxref, crossReference(text).startxref + 5))).toBe('xref\n');
  });

  it('declares a trailer /Size one past the object count', async () => {
    const text = latin1.decode(await bytesOf(raster()));

    expect(text).toContain('/Size 6');
    expect(text).toContain('/Root 1 0 R');
    expect(text.endsWith('%%EOF\n')).toBe(true);
  });

  it('sizes the page in points from the CSS dimensions, not the raster', async () => {
    // A retina capture is twice the raster for the same page. Sizing the page
    // from the sample count would halve every physical dimension.
    const text = latin1.decode(await bytesOf(raster({ width: 192, height: 96, cssWidth: 96, cssHeight: 48 })));

    expect(text).toContain('/MediaBox [ 0 0 72 36 ]');
    expect(imageDictionary(text)).toContain('/Width 192');
    expect(imageDictionary(text)).toContain('/Height 96');
  });

  it('writes numbers to three decimals with no trailing zeros', async () => {
    const text = latin1.decode(await bytesOf(raster({ cssWidth: 10.0001, cssHeight: 96 })));

    // 10.0001 CSS px is 7.500075pt, which rounds to 7.5 rather than "7.500";
    // 96 CSS px is exactly 72pt and must not appear as "72.000".
    expect(text).toContain('/MediaBox [ 0 0 7.5 72 ]');
  });

  it('describes the samples as 8-bit DeviceRGB', async () => {
    const dictionary = imageDictionary(latin1.decode(await bytesOf(raster())));

    expect(dictionary).toContain('/ColorSpace /DeviceRGB');
    expect(dictionary).toContain('/BitsPerComponent 8');
    expect(dictionary).toContain('/Subtype /Image');
  });

  it('draws the image across the whole page in one content stream', async () => {
    const text = latin1.decode(await bytesOf(raster({ cssWidth: 96, cssHeight: 48 })));

    // The `cm` operands are the page box, so the unit image square maps corner
    // to corner and never needs flipping for PDF's bottom-left origin.
    expect(text).toContain('q 72 0 0 36 0 0 cm /Im0 Do Q');
    expect(text).toContain('/XObject << /Im0 4 0 R >>');
  });

});
