# Changelog

All notable changes to Tallpage are documented here.

## [0.1.0] — 2026-08-17

Initial public release.

### Added

- Export the selected webpage from top to bottom as PNG, PDF, HTML, or Markdown.
- Capture PNG and PDF in one Chrome renderer pass rather than scrolling and stitching.
- Save PNG as Chrome's original bytes and PDF as a single-page visual snapshot.
- Save the current DOM as portable, inert HTML with accessible assets embedded where
  possible.
- Convert readable page content into Markdown and open it in Tallpage's built-in viewer.
- Show active-page context and explicit format choices in the toolbar popup.
- Keep export progress and the latest result visible in the side panel.
- Optionally open completed downloads in a focused tab; download-only mode is available in
  Options.
- Scale very tall or wide visual exports to preserve the complete page instead of cropping.
- Copy a completed PNG's absolute local path from the popup or side panel for local tools
  such as Codex and Claude Code.
- Privacy-policy and Chrome Web Store release documentation.
- A tracked, paste-ready Chrome Web Store description.
- Public contribution, security, issue, pull-request, funding, ownership, and CI files.
- Chrome Web Store screenshots and promotional artwork.
- An MIT license and a self-contained public repository README.
- Repeatable format, type, unit-test, production-build, and package release gates.

### Changed

- Refreshed the toolbar icon and listing artwork.
- Kept maintainer-only publishing notes and local project context out of the public
  repository.

### Security and privacy

- Processing stays on the device; Tallpage has no analytics, advertising, tracking,
  developer server, or remotely hosted code.
- No persistent host permissions or content script.
- HTML exports remove scripts, frames, inline event handlers, active forms, and automatic
  redirects.
- The debugger connection is limited to the selected tab and detached after success or
  failure.

[0.1.0]: https://github.com/ElecTreeFrying/tallpage/releases/tag/v0.1.0
