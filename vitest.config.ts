import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

// WxtVitest wires up three things automatically:
//   1. `browser.*` is polyfilled in-memory by @webext-core/fake-browser,
//      so storage/messaging work in tests without hand-rolled mocks.
//   2. WXT's auto-imports resolve the same way they do at build time.
//   3. Vite config + path aliases (@/, @@/) come from wxt.config.ts.
export default defineConfig({
  plugins: [ WxtVitest() ],

  test: {
    /**
     * The other half of the naming decision in `tests/CLAUDE.md`.
     *
     * §P1 bans dot-type suffixes, so a test is named for the module it proves —
     * `tests/pdf.ts` proves `pdf.ts`. Vitest's default `include` matches only
     * `*.test.*` and `*.spec.*`, so a suffix-free name is invisible to it: with
     * this line missing the runner reports "No test files found" and, because
     * the script passes `--passWithNoTests`, still exits 0. A whole suite goes
     * unrun and the gate stays green.
     *
     * The glob is flat on purpose — `tests/CLAUDE.md` keeps the directory flat,
     * and a `**` here would quietly permit the nesting that rule declines.
     */
    include: [ 'tests/*.ts' ]
  }
});
