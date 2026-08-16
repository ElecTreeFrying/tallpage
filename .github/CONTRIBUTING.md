# Contributing

Thanks for wanting to help. Bug reports, feature requests, and pull requests are all
welcome.

## Before you start

- **Open an issue first** for anything beyond a small fix. Full-page capture has sharp
  browser, privacy, and permission constraints, so agreeing on the shape before writing
  code saves rework.
- Read the project [`README.md`](../README.md), especially the capture design,
  permissions, export differences, and accepted browser behavior.
- If a change affects what page data Tallpage handles, where it is stored, or when it can
  contact a website, update [`PRIVACY.md`](../PRIVACY.md) in the same pull request.

## Setup

```bash
npm install
npm run dev
```

`npm run dev` launches a fresh Chrome profile with Tallpage loaded and hot reload enabled.
Use that profile for manual testing; it keeps extension state separate from your normal
browser profile.

## The commands that matter

```bash
npm run format:check  # Prettier check
npm run compile       # TypeScript type gate
npm test              # Vitest suite
npm run build         # production Chrome MV3 build
npm run zip           # Chrome Web Store ZIP under .output/
```

## Before you open a PR

1. All five commands above pass.
2. User-facing behavior is verified in the temporary Chrome profile.
3. `README.md` reflects changes to behavior, permissions, or accepted limits.
4. `PRIVACY.md` reflects every change to data handling or network behavior.

## Code style and platform constraints

- **LF line endings** are enforced by `.gitattributes`.
- Run `npm run format` rather than formatting TypeScript, HTML, CSS, Markdown, or YAML by
  hand.
- Keep TypeScript strict and Angular zoneless; do not weaken compiler settings to make a
  change pass.
- Treat every manifest permission as a review cost. Add one only with the feature that
  requires it and document why it is necessary.
- Do not introduce remotely hosted executable code, telemetry, analytics, or persistent
  website host permissions.

## Reporting bugs

Use the issue templates and provide a public page that reproduces the problem when it is
safe to do so. Never upload an export containing private account, payment, health, or other
sensitive information.

For **security** problems, do not open an issue — see [`SECURITY.md`](SECURITY.md).
