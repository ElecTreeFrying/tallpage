import { Component, computed, ViewEncapsulation } from '@angular/core';
import { lastMarkdown as lastMarkdownItem } from '@/storage';
import { storageSignal } from '@/storage-signal';
import { imports, viewProviders } from './config';
import { renderMarkdown } from './render';

/**
 * Renders the last Markdown export.
 *
 * It reads storage rather than the file that was just downloaded, so it does
 * not depend on "Allow access to file URLs" — a setting only the user can grant
 * and whose absence would otherwise show an empty page.
 *
 * `[innerHTML]` in the template is deliberate and load-bearing: the Markdown
 * comes from an arbitrary web page, and Angular's sanitizer is the second gate
 * behind `render.ts`'s own escaping. Never replace it with a
 * `bypassSecurityTrust*` call.
 */
@Component({
  selector: 'tp-viewer',
  templateUrl: './viewer.html',
  styleUrl: './viewer.css',
  host: { class: 'c-viewer' },
  imports, viewProviders,
  // Emulated encapsulation stamps `_ngcontent` attributes onto the template's
  // elements and rewrites every selector to require one. Markdown arrives here
  // through `[innerHTML]`, so none of it carries that attribute and every rule
  // under `.doc` misses — the measure applies and nothing inside it does.
  // §C1 bans `::ng-deep` and names this as the route: turn encapsulation off,
  // and namespace every rule under the root class so nothing leaks. Each
  // selector in `viewer.css` starts with `.doc` for exactly that reason.
  encapsulation: ViewEncapsulation.None
})
export class Viewer {

  private readonly markdown = storageSignal(lastMarkdownItem);

  /** `null` until the first storage read resolves — which is not the same as empty. */
  protected readonly pending = computed(() => this.markdown() === null);

  protected readonly rendered = computed(() => {
    const source = this.markdown();

    return source ? renderMarkdown(source) : '';
  });

}
