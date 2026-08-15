import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

// WxtVitest wires up three things automatically:
//   1. `browser.*` is polyfilled in-memory by @webext-core/fake-browser,
//      so storage/messaging work in tests without hand-rolled mocks.
//   2. WXT's auto-imports resolve the same way they do at build time.
//   3. Vite config + path aliases (@/, @@/) come from wxt.config.ts.
export default defineConfig({
  plugins: [WxtVitest()],
});
