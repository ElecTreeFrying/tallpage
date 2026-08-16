# Tallpage

Downloads the page you are on — **top to bottom, the whole document** — as a PNG or a PDF.
A Manifest V3 browser extension on **WXT + Angular**, with no third-party runtime code in
the capture path.

Agent-facing rules live in [`CLAUDE.md`](CLAUDE.md) and [`.claude/`](.claude/CLAUDE.md);
what the product is and is not is [`.claude/spec/product.md`](.claude/spec/product.md).
This file is the human quickstart.

## Run it

```bash
npm install
npm run dev
```

`dev` builds to `.output/chrome-mv3/`, launches a fresh Chrome profile with the extension
already loaded, and hot-reloads on save.

To load a build by hand instead: `chrome://extensions` → enable **Developer mode** → **Load
unpacked** → select `.output/chrome-mv3/`.

## The gate

```bash
npm run compile    # tsc --noEmit
npm run build      # production build
```

Both pass, and the change is done. There are no unit tests yet — that is deliberate, and an
agent never adds one (see §P4).

## How the capture works

Chrome has no full-page capture API outside the DevTools Protocol, so this uses it:

```
popup click
     ↓
background   →  debugger.attach
     ↓
             →  Page.getLayoutMetrics             document size in CSS pixels
     ↓
             →  Emulation.setDeviceMetricsOverride  viewport := the whole document
     ↓                                              wait, then re-measure
             →  Page.captureScreenshot            one render, no tiling
     ↓
             →  Emulation.clearDeviceMetricsOverride

HTML takes the other branch — no resize, no paint:
             →  Runtime.evaluate                  serialize the live DOM,
                                                  inline every asset as data:
PNG  the protocol's bytes, untouched
PDF  decode → strip alpha → CompressionStream → pdf.ts
     ↓
             →  data: URL → chrome.downloads → debugger.detach
```

**Nothing runs inside the page.** No scrolling, no injected CSS, no stitching. That is the
entire argument for this engine, and it is why the output does not depend on how the page
behaves.

**Scroll-and-stitch on `tabs.captureVisibleTab` was tried and abandoned.** It sees only the
viewport, so a full page has to be assembled by hand — and every page behaviour becomes a
guess: `sticky` demotes to `static` while `fixed` demotes to `absolute`, scroll-triggered
reveals must be allowed to finish or they photograph at `opacity: 0`, lazy images need a
priming pass, and chrome injected _after_ the preparation pass repeats once per frame.
Each fails on a different site. It was also capped at **2 captures per second**.

## Permissions

```
debugger  activeTab  downloads  storage  sidePanel        host_permissions: []
```

**`debugger` is the expensive one and it is deliberate.** It cannot be made optional, it warns
_"Read and change all your data on all websites"_ at install, Chrome shows an undismissable
banner while attached, and it guarantees manual store review. That is the price of an engine
that is correct on every page rather than most of them.

Everything else stays minimal. `activeTab` is there only so the tab's title can name the file.

## What's here

| Surface         | Lives                             | For                                     |
| --------------- | --------------------------------- | --------------------------------------- |
| `background.ts` | woken per event, killed when idle | the capture run — it outlives the popup |
| `popup/`        | destroyed on blur                 | the four download buttons               |
| `viewer/`       | an ordinary page, no manifest key | rendering the Markdown export           |
| `sidepanel/`    | survives navigation               | progress and preview                    |
| `options/`      | an ordinary page                  | settings                                |

Eight root modules are shared across them: `storage.ts` (persisted state), `messaging.ts` (the
typed cross-surface protocol), `storage-signal.ts` (binds a storage item to an Angular signal),
`debugger-session.ts` (one attached CDP session, always released), `capture.ts` (the screenshot
pipeline), `archive.ts` (the page as one self-contained HTML file), `markdown.ts` (the page's
readable content as Markdown) and `pdf.ts` (a single-page PDF around one raster, with no
dependencies).

## The four exports

**PNG** — Chrome's own bytes, untouched. **PDF** — the same pixels in a hand-written PDF
wrapper; raster, so its text is not selectable. **HTML** — a different artefact entirely: the
live DOM saved as one self-contained file with stylesheets, images and CSS assets inlined as
`data:` URIs, so it opens with no network. Text stays text and links stay links.

The HTML archive is serialized from the **current DOM**, not the original response — which is
the point on anything client-rendered, where the served HTML is a shell. Scripts are stripped:
an archive that re-runs its own JavaScript re-fetches and usually destroys the state that was
worth saving.

**Markdown** — the page's readable content. Headings, emphasis, links, images, lists, quotes,
code and tables survive; navigation, chrome and styling are dropped. Lossy on purpose.

**The file is always downloaded and, by default, opens in a new active tab.** The options page
can turn opening off for download-only exports. Markdown opens in the extension's own
`viewer.html`, because Chrome renders a `.md` file as plain text — the viewer reads the export
from session storage, so it works regardless of file access. Every other format opens the
downloaded file directly, which needs _"Allow access to file URLs"_ on the extension (only you
can grant that, from `chrome://extensions`). Without it the file is still saved; only the tab
is skipped.

**The service worker is ephemeral.** Chrome kills it after ~30s idle, so no module-level
variable survives and no long `setTimeout` fires. State goes through `storage.ts`; timers go
through `browser.alarms`. It has no DOM either — which is why the PDF path decodes through
`createImageBitmap` and `OffscreenCanvas` rather than an `<img>`, and why the download goes
out as a `data:` URL (`URL.createObjectURL` does not exist there).

**Angular compiles four directories only** — the popup, options, side panel and viewer. The
background script stays plain TypeScript, enforced by `transformFilter` in `wxt.config.ts`.

## Before shipping

- Export the padded store-listing icon — 96×96 artwork on a 128×128 canvas. `public/icon/`
  is the real icon set now, but its `128.png` fills its canvas, which is right for the
  toolbar and wrong for the store grid.
- Keep `host_permissions` empty. `debugger` is the only broad permission and it is enough.
- Chrome Web Store policy since 2026-08-01 requires everything requested to be strictly
  necessary and disclosed upfront. This extension makes no network calls and collects
  nothing, which is what keeps that disclosure empty — and `debugger` will need a written
  justification at review regardless, since it triggers manual review every submission.
