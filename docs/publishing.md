# Publishing Tallpage

The release specification for the first Chrome Web Store version. The implementation and
store claims must pass every local gate below; account, legal, and submission actions remain
owner-controlled.

## Release decision

| Field          | Value                                                                                   |
| -------------- | --------------------------------------------------------------------------------------- |
| Version        | `0.1.0`                                                                                 |
| Browser        | Google Chrome, Manifest V3                                                              |
| Minimum Chrome | 116 — the popup uses the user-gesture-gated `sidePanel.open()` API                      |
| Visibility     | Public                                                                                  |
| Price          | Free                                                                                    |
| Category       | Productivity                                                                            |
| Language       | English                                                                                 |
| Publisher      | `WinterNova5`                                                                           |
| EEA status     | Non-trader — reassess before any commercial or professional use                         |
| Single purpose | Export the user-selected current webpage, top to bottom, as PNG, PDF, HTML, or Markdown |

## Legal gate before going operational

Do not upload or publish the extension until both documented constraints have been cleared:

1. Confirm with the Ausländerbehörde or qualified German immigration counsel that the planned
   activity is allowed under the current residence status, which presently says self-employed
   activity is not permitted.
2. Obtain ECT's written approval before beginning the side activity because the employment
   contract requires it for activity touching IT or electronic data processing.

This is a release gate, not legal advice. Building, testing, and preparing this submission do
not themselves publish or monetize the extension.

## Store copy

### Name

Tallpage

### Short description

Export the current webpage, top to bottom, as PNG, PDF, HTML, or Markdown.

### Detailed description

Tallpage exports the webpage you choose from top to bottom in one click.

- PNG — a lossless visual capture from Chrome's renderer.
- PDF — the same full-page visual in a single-page PDF.
- HTML — a current-DOM snapshot with accessible resources embedded when the page allows.
- Markdown — readable page content without navigation or visual chrome.

Tallpage reads the selected page's title, URL, pixels, or content only after you choose an
export format. Processing stays on your device. It has no analytics, ads, developer server,
or persistent host permissions. Export progress remains available in the side panel after the
popup closes, and an option controls whether completed downloads also open in a new tab.

Chrome-owned pages and other protected browser URLs cannot be exported. Very tall visual
captures are scaled down rather than cropped. Some cross-origin or oversized resources in an
HTML snapshot can retain their original URLs and may need the network when the saved file is
opened.

### Support statement

No account or sign-in is required. Support and privacy questions use the support email on the
listing.

## Permission justifications

| Permission  | Store justification                                                                                                                                                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activeTab` | Reads the title and URL of the current tab after the user opens Tallpage, so the selected page can be identified and the downloaded file named. It grants no persistent site access.                                                                                                  |
| `debugger`  | Temporarily attaches Chrome DevTools Protocol to the user-selected tab to measure the full document, request one full-page renderer capture, or serialize the current DOM. Tallpage detaches after success or failure. Chrome provides no other renderer-level full-page capture API. |
| `downloads` | Saves the PNG, PDF, HTML, or Markdown file the user explicitly requested and optionally opens it after Chrome reports the download complete.                                                                                                                                          |
| `storage`   | Stores the open-after-download preference locally and short-lived export status plus the latest Markdown preview in session storage.                                                                                                                                                  |
| `sidePanel` | Shows ongoing export status and the current or most recent export summary after the popup closes.                                                                                                                                                                                     |

`host_permissions` is empty. No permission is optional because every requested permission is
used by a visible part of the single export purpose.

## Privacy questionnaire

Use the conservative disclosure — local processing still counts as handling user data.

| Dashboard question                                                   | Answer                                                                                                                         |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Website content                                                      | Yes — pixels, text, DOM, styles, images, and resource URLs from the selected page are processed to create the export           |
| Web history                                                          | Yes — the selected page's title and URL are read and held in session status                                                    |
| Authentication, financial, health, personal communications, location | No — Tallpage does not target or use these categories, though a selected webpage could visibly contain them                    |
| Data sold or transferred                                             | No                                                                                                                             |
| Data used outside the single purpose                                 | No                                                                                                                             |
| Data used for credit or lending                                      | No                                                                                                                             |
| Remotely hosted code                                                 | No — `Runtime.evaluate` receives Tallpage's bundled first-party serializer source; no executable code is fetched from a server |
| Privacy policy                                                       | After this change reaches `main`, use `https://github.com/ElecTreeFrying/tallpage/blob/main/PRIVACY.md`                        |

The policy and listing must stay consistent with the implementation: no analytics, remote
code, ads, or Tallpage server may be added without reopening these disclosures.

## Reviewer instructions

1. Install the extension; no account or test credentials are needed.
2. Open a regular HTTPS webpage, select Tallpage in the toolbar, and choose each format.
3. The Chrome debugger warning/banner is expected only while an export is active and clears
   after Tallpage detaches.
4. Use **Progress panel** in the popup to verify live and most-recent export status.
5. Open **Options** and toggle whether completed downloads open in a new tab.
6. File-URL access is not needed to create a download. If it is disabled, PNG, PDF, and HTML
   remain saved but their optional result tab may not open; Markdown uses Tallpage's own
   viewer and does not need file-URL access.
7. Verify protected URLs such as `chrome://extensions` show disabled export actions.

## Local release gates

```bash
npm run format:check
npm run compile
npm test
npm run build
npm run zip
```

Then inspect the generated manifest and ZIP contents. The package must contain the four
Angular surface chunks, the background worker, only intended icons/assets, no `CLAUDE.md`, no
source maps, no secrets, and no broad host permission.

## Store assets

| Asset            | Requirement                            | Repository source                          |
| ---------------- | -------------------------------------- | ------------------------------------------ |
| Store icon       | 128×128 PNG with roughly 96×96 artwork | `public/icon/128.png`, included in the ZIP |
| Screenshot       | At least one, 1280×800 preferred       | `store/`                                   |
| Small promo tile | 440×280 PNG                            | `store/small-promo-tile-440x280.png`       |
| Marquee          | 1400×560 PNG, optional                 | `store/marquee-1400x560.png`               |

Screenshots must show the actual release build, use square corners and no padding, and match
the functionality uploaded in the ZIP. Follow
[`verify-a-release-build-in-chrome.md`](../.claude/playbooks/verify-a-release-build-in-chrome.md)
for the isolated-profile smoke test and screenshot sequence.

## Owner-controlled submission checklist

- [ ] Clear the legal gate above.
- [x] Finish Chrome Web Store developer registration, its one-time fee, and Google Account
      two-step verification.
- [x] Complete the required trader/non-trader declaration. The current declaration is
      non-trader for a free, noncommercial release; reassess it before any monetization or other
      professional use.
- [x] Choose the public developer display name and verify the support email.
- [ ] Confirm the repository privacy-policy URL above is public after the release change reaches
      `main`, then enter that exact URL in the dashboard.
- [ ] Have the public policy/contact presentation checked for any additional German or EU privacy
      and imprint requirements; the repository policy is drafted for Chrome Web Store fields, not
      as jurisdiction-specific legal advice.
- [ ] Upload the ZIP and listing assets, paste the copy and justifications above, and complete
      the privacy questionnaire.
- [ ] Review the permission warning and draft listing without publishing.
- [ ] Submit for review only after a final smoke test of the exact uploaded ZIP.

## Live policy sources

Recheck these first-party pages immediately before submission because dashboard fields and
review policy can change independently of this repository:

- [Publish in the Chrome Web Store](https://developer.chrome.com/docs/webstore/publish/)
- [Fill out the privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
- [Chrome Web Store user-data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [Chrome Web Store review process](https://developer.chrome.com/docs/webstore/review-process)
- [Supply listing images](https://developer.chrome.com/docs/webstore/images)
- [Trader verification FAQ](https://developer.chrome.com/docs/webstore/program-policies/trader-verification-faq)
