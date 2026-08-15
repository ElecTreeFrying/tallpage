import { browser } from '#imports';

/**
 * The page's readable content as Markdown.
 *
 * The third kind of artefact this extension produces. A screenshot is what the
 * page looks like, the HTML archive is what it *is*, and this is what it
 * **says** — structure kept, presentation discarded.
 *
 * That means it is lossy on purpose. Navigation, footers, scripts, styling and
 * anything not rendered are dropped; headings, emphasis, links, images, lists,
 * quotes, code and tables survive. The test is whether the result reads well,
 * not whether it round-trips.
 *
 * The converter runs inside the page through `Runtime.evaluate`, so it is
 * stringified and re-parsed there and must close over nothing from this module.
 *
 * **It is paired with `entrypoints/viewer/render.ts`.** That renderer implements
 * exactly the constructs this emits and no others. Adding syntax here without
 * adding it there produces a viewer that shows raw Markdown.
 */

/** Elements that never carry readable content. */
const IGNORED_TAGS = 'SCRIPT STYLE NOSCRIPT TEMPLATE SVG CANVAS IFRAME OBJECT VIDEO AUDIO MAP AREA LINK META HEAD';

/**
 * Tags that stay on one line.
 *
 * This is an **allowlist of inline tags**, not a list of block tags, and the
 * direction is the whole point. A fixed list of block tags flattens every custom
 * element a framework renders — `<app-hero>` is not `DIV`, so a converter that
 * only recognises `DIV` treats it as inline and collapses the headings inside it
 * into a run of text. Asking for `getComputedStyle().display` does not save it
 * either: an unknown element defaults to `inline`.
 */
const INLINE_TAGS =
  'A SPAN STRONG B EM I U S DEL INS CODE KBD SAMP VAR SUB SUP SMALL MARK ABBR CITE Q TIME BR IMG WBR BDI BDO DATA RUBY RT RP PICTURE SOURCE FONT LABEL BUTTON OUTPUT';

/** Tags whose presence anywhere inside an element proves that element wraps blocks. */
const BLOCK_TAGS =
  'ADDRESS ARTICLE ASIDE BLOCKQUOTE DD DETAILS DIALOG DIV DL DT FIELDSET FIGCAPTION FIGURE FOOTER FORM H1 H2 H3 H4 H5 H6 HEADER HGROUP HR LI MAIN NAV OL P PRE SECTION SUMMARY TABLE TBODY TD TFOOT TH THEAD TR UL';

/**
 * Walk the rendered DOM and return Markdown.
 *
 * Runs in the page.
 */
function serializeMarkdown(ignoredTags: string, inlineTags: string, blockTags: string): string {
  const ignored = new Set(ignoredTags.split(' '));
  const inlineOnly = new Set(inlineTags.split(' '));
  const blockNames = new Set(blockTags.split(' '));
  const blockSelector = blockTags.toLowerCase().split(' ').join(',');

  /**
   * Does this element start a new block?
   *
   * Two tests, because either alone leaves a hole:
   *
   * - **What it contains.** A custom element wrapping `<h2>` and `<p>` is a
   *   block container whatever it is called. Tag-name lists miss this entirely,
   *   which is how `<app-hero>` swallows the heading inside it.
   * - **What it renders as.** A custom element wrapping only text — a label, a
   *   value, a caption — contains no block descendants, yet lays out as a block
   *   because its component styles say `:host { display: block }`. Without this
   *   test, two adjacent ones concatenate with no space between them.
   *
   * Computed display cannot do the job on its own: an unknown element defaults
   * to `inline`, so the containment test is what catches a framework wrapper
   * nobody styled.
   */
  const startsBlock = (element: Element): boolean => {
    if (blockNames.has(element.tagName)) return true;
    if (element.querySelector(blockSelector) !== null) return true;

    const display = getComputedStyle(element).display;

    // `inline-flex` and `inline-grid` are excluded by construction — they start
    // with "inline", so none of these prefixes match them.
    return (
      display === 'block' ||
      display === 'flow-root' ||
      display === 'list-item' ||
      display.startsWith('flex') ||
      display.startsWith('grid') ||
      display.startsWith('table')
    );
  };

  const absolute = (url: string): string => {
    try {
      return new URL(url, document.baseURI).href;
    } catch {
      return url;
    }
  };

  // Only the characters that would otherwise start Markdown syntax. Escaping
  // more than this turns ordinary prose into a thicket of backslashes.
  const escapeText = (text: string): string => text.replace(/([\\`*_[\]<>])/g, '\\$1');

  const isHidden = (element: Element): boolean => {
    if (element.getAttribute('aria-hidden') === 'true') return true;

    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return true;

    // The screen-reader-only pattern: a 1px clipped box holding text meant for
    // assistive tech only — "(opens in a new tab)", "skip to content". It is
    // visible to `getComputedStyle` by every measure above, and copying it into
    // the prose is exactly the noise a reader does not want.
    const box = element.getBoundingClientRect();

    return box.width <= 1 && box.height <= 1 && style.overflow === 'hidden';
  };

  /** Everything that renders on one line: text, emphasis, links, images. */
  const inlineOf = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeText(node.nodeValue ?? '').replace(/\s+/g, ' ');
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const element = node as HTMLElement;
    if (ignored.has(element.tagName) || isHidden(element)) return '';

    const inner = Array.from(element.childNodes).map(inlineOf).join('');
    const trimmed = inner.trim();

    switch (element.tagName) {
      case 'BR':
        return '  \n';
      case 'STRONG':
      case 'B':
        return trimmed ? `**${trimmed}**` : '';
      case 'EM':
      case 'I':
        return trimmed ? `*${trimmed}*` : '';
      case 'DEL':
      case 'S':
        return trimmed ? `~~${trimmed}~~` : '';
      case 'CODE':
      case 'KBD':
      case 'SAMP':
        // Backticks inside an inline span would close the span early, and there
        // is no escape for them in Markdown — dropping them is the honest fix.
        return trimmed ? `\`${(element.textContent ?? '').replace(/`/g, '').trim()}\`` : '';
      case 'A': {
        const href = element.getAttribute('href');

        return href && trimmed && !href.startsWith('javascript:') ? `[${trimmed}](${absolute(href)})` : inner;
      }
      case 'IMG': {
        const src = (element as HTMLImageElement).currentSrc || element.getAttribute('src');

        return src ? `![${(element.getAttribute('alt') ?? '').replace(/[[\]]/g, '')}](${absolute(src)})` : '';
      }
      default:
        return inner;
    }
  };

  /** Children of a container, with inline runs collected into paragraphs. */
  const childrenOf = (element: Element, indent: string): string => {
    let out = '';
    let run = '';

    const flush = (): void => {
      const text = run.replace(/\s+/g, ' ').trim();
      if (text) out += `${indent}${text}\n\n`;
      run = '';
    };

    for (const child of Array.from(element.childNodes)) {
      const isBlock =
        child.nodeType === Node.ELEMENT_NODE &&
        !inlineOnly.has((child as Element).tagName) &&
        startsBlock(child as Element);

      if (isBlock) {
        flush();
        out += blockOf(child as HTMLElement, indent);
      } else {
        run += inlineOf(child);
      }
    }

    flush();

    return out;
  };

  const blockOf = (element: HTMLElement, indent: string): string => {
    if (ignored.has(element.tagName) || isHidden(element)) return '';

    const tag = element.tagName;

    // `role="heading"` is a real heading and is the only way to express one when
    // the visual level and the document outline disagree — common in component
    // libraries, where a card title looks like an h3 but must not be one.
    const ariaLevel = element.getAttribute('role') === 'heading' ? Number(element.getAttribute('aria-level') ?? 2) : 0;
    const level = /^H[1-6]$/.test(tag) ? Number(tag[1]) : ariaLevel;

    if (level >= 1 && level <= 6) {
      const text = inlineOf(element).replace(/\s+/g, ' ').trim();

      return text ? `${indent}${'#'.repeat(level)} ${text}\n\n` : '';
    }

    if (tag === 'HR') return `${indent}---\n\n`;

    if (tag === 'PRE') {
      const code = (element.textContent ?? '').replace(/\s+$/, '');

      return code ? `${indent}\`\`\`\n${code}\n${indent}\`\`\`\n\n` : '';
    }

    if (tag === 'BLOCKQUOTE') {
      const inner = childrenOf(element, '').replace(/\n+$/, '');
      if (!inner) return '';

      return `${inner.split('\n').map((line) => (line ? `${indent}> ${line}` : `${indent}>`)).join('\n')}\n\n`;
    }

    if (tag === 'UL' || tag === 'OL') {
      const ordered = tag === 'OL';
      let out = '';
      let index = 1;

      for (const item of Array.from(element.children)) {
        if (item.tagName !== 'LI' || isHidden(item)) continue;

        const body = childrenOf(item, '').trim();
        if (!body) continue;

        const [ first, ...rest ] = body.split('\n');
        const marker = ordered ? `${index}. ` : '- ';

        // Continuation lines indent to the marker's width so a nested list or a
        // second paragraph stays inside the item rather than ending it.
        out += `${indent}${marker}${first}\n`;
        out += rest.map((line) => (line ? `${indent}  ${line}\n` : '\n')).join('');
        index += 1;
      }

      return out ? `${out}\n` : '';
    }

    if (tag === 'TABLE') {
      const rows = Array.from(element.querySelectorAll('tr')).filter((row) => !isHidden(row));
      if (!rows.length) return '';

      const cellsOf = (row: Element): string[] =>
        Array.from(row.children).map((cell) => inlineOf(cell).replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|') || ' ');

      const header = cellsOf(rows[0]!);
      let out = `${indent}| ${header.join(' | ')} |\n${indent}| ${header.map(() => '---').join(' | ')} |\n`;

      for (const row of rows.slice(1)) out += `${indent}| ${cellsOf(row).join(' | ')} |\n`;

      return `${out}\n`;
    }

    return childrenOf(element, indent);
  };

  const root = document.querySelector('main, article, [role="main"]') ?? document.body;
  const title = (document.title || '').trim();

  const body = blockOf(root as HTMLElement, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const heading = title ? `# ${title}\n\n` : '';
  const source = `[${document.location.href}](${document.location.href})\n\n`;

  return `${heading}${source}${body}\n`;
}

/** Convert the page of `tabId`, assuming the debugger is already attached. */
export async function captureMarkdown(tabId: number): Promise<string> {
  const result = await browser.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
    expression: `(${serializeMarkdown.toString()})(${JSON.stringify(IGNORED_TAGS)}, ${JSON.stringify(INLINE_TAGS)}, ${JSON.stringify(BLOCK_TAGS)})`,
    returnByValue: true
  }) as { result?: { value?: string }; exceptionDetails?: { text?: string } };

  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? 'Markdown conversion failed');

  return result.result?.value ?? '';
}
