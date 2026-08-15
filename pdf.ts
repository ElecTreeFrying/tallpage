/**
 * A single-page PDF wrapping one raster image. No dependencies.
 *
 * `pdf-lib` and `jsPDF` are the conventional answer and are declined here. A PDF
 * holding one image is a handful of objects over a documented format, and the
 * only part that genuinely needs a library is compression — which the platform
 * supplies as `CompressionStream`.
 *
 * The format detail that makes this work: PDF's `/FlateDecode` filter expects
 * zlib-wrapped deflate (RFC 1950), and `CompressionStream('deflate')` emits
 * exactly that. `'deflate-raw'` is the unwrapped RFC 1951 variant and produces a
 * file every reader rejects — the two names read as though the plain one were
 * the raw one, which is the trap.
 *
 * The image is stored as raw `/DeviceRGB` samples, so the uncompressed buffer is
 * three bytes per pixel and is held whole before compression. That is the
 * memory cost of a lossless PDF; `/DCTDecode` with JPEG bytes embedded verbatim
 * is the cheaper filter if it ever matters.
 */

/** 72 PostScript points per inch over 96 CSS pixels per inch. */
const POINTS_PER_CSS_PIXEL = 72 / 96;

/** PDF wants ASCII; every structural chunk is written through this. */
const encoder = new TextEncoder();

export interface RasterImage {

  /** Pixel width of the sample data. */
  width: number;

  /** Pixel height of the sample data. */
  height: number;

  /** Packed RGB, three bytes per pixel, row-major from the top-left. */
  rgb: Uint8Array;

  /** CSS pixels the raster represents — `width` divided by the device pixel ratio. */
  cssWidth: number;

  /** CSS pixels the raster represents — `height` divided by the device pixel ratio. */
  cssHeight: number;

}

/**
 * zlib-wrapped deflate, straight from the platform.
 *
 * Baseline widely available since May 2023. Verified against the WHATWG
 * Compression Streams specification rather than recalled: `'deflate'` is
 * RFC 1950, `'deflate-raw'` is RFC 1951.
 */
async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const compressed = new Blob([ bytes as BlobPart ]).stream().pipeThrough(new CompressionStream('deflate'));

  return new Uint8Array(await new Response(compressed).arrayBuffer());
}

/** PDF numbers carry no trailing zeros; `1.50` and `1.5` are the same token but the shorter one is conventional. */
function num(value: number): string {
  return String(Number(value.toFixed(3)));
}

/** Cross-reference entries are fixed at twenty bytes — ten digits, five digits, a flag, and a two-byte terminator. */
function xrefEntry(offset: number): string {
  return `${String(offset).padStart(10, '0')} 00000 n \n`;
}

/**
 * Write the image as a one-page PDF sized to the raster's CSS dimensions.
 *
 * The page is the image and nothing else — no margins, no scaling to a paper
 * size. A screenshot is a photograph of the page, so the PDF's job is to carry
 * it at its natural size rather than fit it to A4.
 */
export async function imageToPdf(image: RasterImage): Promise<Blob> {
  const samples = await deflate(image.rgb);

  const pageWidth = num(image.cssWidth * POINTS_PER_CSS_PIXEL);
  const pageHeight = num(image.cssHeight * POINTS_PER_CSS_PIXEL);

  // `cm` scales the unit image square to the page box; PDF's origin is
  // bottom-left, and a full-page placement means the image never needs
  // flipping — the transform maps it corner to corner either way.
  const content = encoder.encode(`q ${pageWidth} 0 0 ${pageHeight} 0 0 cm /Im0 Do Q\n`);

  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;

  const put = (chunk: Uint8Array | string): void => {
    const bytes = typeof chunk === 'string' ? encoder.encode(chunk) : chunk;

    parts.push(bytes);
    length += bytes.length;
  };

  const beginObject = (): void => {
    offsets.push(length);
  };

  // A comment of bytes above 127 on line two is what tells a transfer agent
  // this file is binary. Omitting it is how a PDF survives a naive text-mode
  // copy with its image quietly corrupted.
  put('%PDF-1.7\n');
  put(new Uint8Array([ 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a ]));

  beginObject();
  put('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  beginObject();
  put('2 0 obj\n<< /Type /Pages /Kids [ 3 0 R ] /Count 1 >>\nendobj\n');

  beginObject();
  put(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [ 0 0 ${pageWidth} ${pageHeight} ] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`);

  beginObject();
  put(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${samples.length} >>\nstream\n`);
  put(samples);
  put('\nendstream\nendobj\n');

  beginObject();
  put(`5 0 obj\n<< /Length ${content.length} >>\nstream\n`);
  put(content);
  put('\nendstream\nendobj\n');

  const xrefOffset = length;

  put(`xref\n0 ${offsets.length + 1}\n`);
  put('0000000000 65535 f \n');
  for (const offset of offsets) put(xrefEntry(offset));

  put(`trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return new Blob(parts as BlobPart[], { type: 'application/pdf' });
}
