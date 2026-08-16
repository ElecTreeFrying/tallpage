# Tallpage

Exports the page you are on — **top to bottom, the whole document** — as PNG, PDF, HTML, or
Markdown. A Manifest V3 Chrome extension on **WXT + Angular**, with no third-party runtime
code in the capture path.

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
npm run format:check
npm run compile
npm test
npm run build
npm run zip
```

All five pass before a release package is considered ready. The test suite covers the shared
capture, archive, Markdown, PDF, messaging, storage, debugger-session, and viewer boundaries;
the Angular surfaces are verified in Chrome.

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
     ↓                                              wait, re-measure, correct once if changed
             →  Page.captureScreenshot            one render, no tiling
     ↓
             →  Emulation.clearDeviceMetricsOverride

HTML and Markdown take the other branch — no resize, no paint:
             →  Runtime.evaluate                  serialize the live DOM or
                                                  extract readable content
PNG  the protocol's bytes, untouched
PDF  decode → strip alpha → CompressionStream → pdf.ts
     ↓
             →  data: URL → chrome.downloads → debugger.detach
```

**There is no persistent content script.** Visual capture uses no scrolling, injected CSS,
or stitching. HTML and Markdown serializers execute only after the user chooses those
formats, through the already-attached DevTools Protocol session.

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
_"Read and change all your data on all websites"_ at install, and Chrome shows an
undismissable banner while attached. It can also make Chrome Web Store review deeper and
slower. That is the price of asking Chrome's renderer for a full-page result instead of
simulating one by scrolling and stitching.

Everything else stays minimal. `activeTab` reads the selected tab's title and URL,
`downloads` saves the requested file, `storage` keeps one preference and browser-session
status, and `sidePanel` provides progress after the popup closes. There are no persistent
host permissions.

## What's here

| Surface         | Lives                             | For                                     |
| --------------- | --------------------------------- | --------------------------------------- |
| `background.ts` | woken per event, killed when idle | the capture run — it outlives the popup |
| `popup/`        | destroyed on blur                 | the four download buttons               |
| `viewer/`       | an ordinary page, no manifest key | rendering the Markdown export           |
| `sidepanel/`    | survives navigation               | progress and latest export summary      |
| `options/`      | an ordinary page                  | settings                                |

Eight root modules are shared across them: `storage.ts` (persisted state), `messaging.ts` (the
typed cross-surface protocol), `storage-signal.ts` (binds a storage item to an Angular signal),
`debugger-session.ts` (one attached CDP session, always released), `capture.ts` (the screenshot
pipeline), `archive.ts` (the page as a portable HTML snapshot), `markdown.ts` (the page's
readable content as Markdown) and `pdf.ts` (a single-page PDF around one raster, with no
dependencies).

## The four exports

**PNG** — Chrome's own bytes, untouched. **PDF** — the same pixels in a hand-written PDF
wrapper; raster, so its text is not selectable. **HTML** — a different artefact entirely: the
live DOM saved with accessible stylesheets, images, and CSS assets inlined as `data:` URIs.
Text stays text and links stay links. Cross-origin resources without CORS and resources over
the inline limit retain their original URLs, so those parts may use the network when opened.

The HTML archive is serialized from the **current DOM**, not the original response — which is
the point on anything client-rendered, where the served HTML is a shell. Scripts are stripped:
an archive that re-runs its own JavaScript re-fetches and usually destroys the state that was
worth saving. Inline event handlers, embedded frames, and automatic redirects are also
removed. Same-origin resource requests can reuse that site's credentials; cross-origin
requests omit them.

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

## Publishing

[`docs/publishing.md`](docs/publishing.md) is the release specification: final store copy,
permission justifications, privacy questionnaire answers, reviewer steps, legal gate, asset
requirements, and owner-controlled submission checklist. [`PRIVACY.md`](PRIVACY.md) is the
policy to host at the public HTTPS URL entered in the Chrome Web Store dashboard.
