<!--
Thanks for contributing! Nothing here is mandatory — delete any section that
doesn't apply. The checklist exists to catch the things CI can't.
-->

## What this changes

<!-- One or two sentences. What behavior is different after this PR? -->

## Why

<!-- The problem being solved. Link an issue with "Closes #123" if there is one. -->

## How to verify

<!--
Give the exact browser steps and expected export. Include a public test page when
it is safe to do so; never attach an export containing sensitive information.
-->

---

## Checklist

- [ ] `npm run format:check` passes.
- [ ] `npm run compile` passes.
- [ ] `npm test` passes.
- [ ] `npm run build` and `npm run zip` pass.
- [ ] User-facing changes were smoke-tested in Chrome using the generated MV3 build.
- [ ] Behavior or permission changes are reflected in `README.md`.
- [ ] Data-handling or network changes are reflected in `PRIVACY.md`.
- [ ] No remotely hosted executable code, telemetry, analytics, or unnecessary permission
      was introduced.
- [ ] No AI attribution appears in the commits or this description — no
      `Co-Authored-By: Claude`, no "Generated with", no 🤖.
- [ ] Line endings are LF (enforced by `.gitattributes`).
