import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '@/entrypoints/viewer/render';

/**
 * The renderer's input comes from an arbitrary web page, so it is hostile by
 * definition. Angular's sanitizer is a second gate behind this one, which is
 * exactly why this gate is asserted on its own: a defect here is invisible for
 * as long as the gate behind it holds, and becomes exploitable the moment that
 * binding changes.
 */

describe('renderMarkdown', () => {

  describe('escaping and link safety', () => {

    it('escapes markup in prose instead of emitting it', async () => {
      const html = renderMarkdown('<script>alert(1)</script>');

      expect(html).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
      expect(html).not.toContain('<script>');
    });

    it('escapes quotes, which would otherwise break out of an attribute', () => {
      expect(renderMarkdown('He said "hi"')).toBe('<p>He said &quot;hi&quot;</p>');
    });

    it('drops a javascript: link but keeps the text it was wrapping', () => {
      // Deleting the label too would silently remove page content, so the
      // renderer degrades the link rather than the sentence.
      const html = renderMarkdown('[click](javascript:alert)');

      expect(html).toBe('<p>click</p>');
      expect(html).not.toContain('javascript:');
    });

    it('keeps an http link and marks it safe to open', () => {
      expect(renderMarkdown('[Docs](https://example.com/a)')).toBe(
        '<p><a href="https://example.com/a" target="_blank" rel="noopener noreferrer">Docs</a></p>'
      );
    });

    it('keeps a mailto link', () => {
      expect(renderMarkdown('[Mail](mailto:a@b.co)')).toContain('href="mailto:a@b.co"');
    });

    it('inlines a data:image but refuses any other data URL', () => {
      expect(renderMarkdown('![dot](data:image/png;base64,AAA)')).toContain('<img src="data:image/png;base64,AAA"');

      // A rejected image falls through to the link rule, which drops the target
      // and keeps the label — so the URL never reaches the document at all. The
      // leftover `!` is the visible cost of that second pass.
      expect(renderMarkdown('![x](data:text/html;base64,AAA)')).toBe('<p>!x</p>');
    });

    it('renders an image with its alt text and lazy loading', () => {
      expect(renderMarkdown('![A cat](https://example.com/c.png)')).toBe(
        '<p><img src="https://example.com/c.png" alt="A cat" loading="lazy" /></p>'
      );
    });

    it('escapes markup inside a fenced code block', () => {
      expect(renderMarkdown('```\n<script>x</script>\n```')).toBe('<pre><code>&lt;script&gt;x&lt;/script&gt;</code></pre>');
    });

    it('does not let a backslash escape smuggle a tag through', () => {
      // Unescaping runs last, after the text is already HTML-escaped, so a
      // backslash can never end up guarding a real angle bracket.
      expect(renderMarkdown('\\<script\\>')).not.toContain('<script>');
    });

  });

  describe('block structure', () => {

    it('renders each heading level', () => {
      expect(renderMarkdown('# One')).toBe('<h1>One</h1>');
      expect(renderMarkdown('### Three')).toBe('<h3>Three</h3>');
      expect(renderMarkdown('###### Six')).toBe('<h6>Six</h6>');
    });

    it('renders a horizontal rule', () => {
      expect(renderMarkdown('---')).toBe('<hr />');
    });

    it('renders a blockquote', () => {
      expect(renderMarkdown('> quoted')).toBe('<blockquote>quoted</blockquote>');
    });

    it('joins wrapped lines into one paragraph and splits on a blank line', () => {
      expect(renderMarkdown('one\ntwo\n\nthree')).toBe('<p>one two</p>\n<p>three</p>');
    });

    it('renders an unordered list', () => {
      expect(renderMarkdown('- one\n- two')).toBe('<ul>\n<li>one</li>\n<li>two</li>\n</ul>');
    });

    it('closes one list before opening a list of the other kind', () => {
      expect(renderMarkdown('- bullet\n1. number')).toBe('<ul>\n<li>bullet</li>\n</ul>\n<ol>\n<li>number</li>\n</ol>');
    });

    it('renders a table when the delimiter row follows the header', () => {
      expect(renderMarkdown('| a | b |\n| --- | --- |\n| c | d |')).toBe(
        '<table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>c</td><td>d</td></tr></tbody></table>'
      );
    });

    it('leaves a paragraph that merely contains pipes alone', () => {
      const html = renderMarkdown('a | b | c');

      expect(html).toBe('<p>a | b | c</p>');
      expect(html).not.toContain('<table>');
    });

  });

  describe('inline formatting', () => {

    it('renders strong, emphasis and strikethrough', () => {
      expect(renderMarkdown('**bold**')).toBe('<p><strong>bold</strong></p>');
      expect(renderMarkdown('*soft*')).toBe('<p><em>soft</em></p>');
      expect(renderMarkdown('~~gone~~')).toBe('<p><del>gone</del></p>');
    });

    it('keeps markup syntax literal inside a code span', () => {
      // Lifting code spans out before anything else runs is what makes this
      // hold; it is also the reason the whole file rests on a placeholder.
      expect(renderMarkdown('Use `[not](a-link)` here')).toBe('<p>Use <code>[not](a-link)</code> here</p>');
    });

    it('turns a hard line break into a br', () => {
      expect(renderMarkdown('one  \ntwo')).toContain('<br />');
    });

    it('preserves a bare number in prose', () => {
      // The code-span placeholder is NUL-delimited so an ordinary number can
      // never be mistaken for a stored code span.
      expect(renderMarkdown('Chapter 3 begins')).toBe('<p>Chapter 3 begins</p>');
    });

  });

});
