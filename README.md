# blank-slate

A Manifest V3 browser extension on **WXT + Angular**, with all five surfaces stubbed and no
product yet. Rename it when it becomes one.

Agent-facing rules live in [`CLAUDE.md`](CLAUDE.md) and
[`.claude/`](.claude/CLAUDE.md) — this file is the human quickstart.

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

## What's here

| Surface         | Lives                             | For                                    |
| --------------- | --------------------------------- | -------------------------------------- |
| `background.ts` | woken per event, killed when idle | anything that must survive a closed UI |
| `popup/`        | destroyed on blur                 | reading state, dispatching intent      |
| `sidepanel/`    | survives navigation               | anything stateful or long-running      |
| `options/`      | an ordinary page                  | settings                               |
| `content.ts`    | the page's lifetime               | reading or changing the page DOM       |

Three root modules are shared by all of them: `storage.ts` (persisted state), `messaging.ts`
(the typed cross-surface protocol) and `storage-signal.ts` (binds a storage item to an
Angular signal).

**The service worker is ephemeral.** Chrome kills it after ~30s idle, so no module-level
variable survives and no long `setTimeout` fires. State goes through `storage.ts`; timers go
through `browser.alarms`.

**Angular compiles three directories only** — the popup, options and side panel. The
background and content scripts stay plain TypeScript, enforced by `transformFilter` in
`wxt.config.ts`. A content script is injected into every matched page and must not carry a
framework runtime.

## Stack

|           |                                                           |
| --------- | --------------------------------------------------------- |
| Framework | WXT 0.21 (Vite 8)                                         |
| UI        | Angular 22, zoneless, via `@analogjs/vite-plugin-angular` |
| Language  | TypeScript 6.0 (pinned by Angular)                        |

Angular is not an officially supported WXT framework — the reasoning, the version
constraints and what would reverse the choice are in
[`.claude/decisions/0001`](.claude/decisions/0001-angular-through-a-vite-plugin.md).

## Before shipping

- Replace the placeholder icons in `public/icon/`.
- Narrow `content.ts`'s `matches` and the `host_permissions` list — `<all_urls>` is a slow
  store review.
- Request permissions only as features need them. Chrome Web Store policy since 2026-08-01
  requires everything requested to be strictly necessary for the stated purpose, disclosed
  upfront.
