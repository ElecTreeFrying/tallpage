import { defineConfig } from 'wxt';
import angular from '@analogjs/vite-plugin-angular';

/**
 * Directories the Angular compiler is allowed to touch.
 *
 * This is the load-bearing part of the Angular-on-WXT setup. Angular is not an
 * official WXT framework module, so it arrives as an ordinary Vite plugin — and
 * left alone that plugin compiles every file in the project, including the
 * background service worker. That worker must stay plain TypeScript: it is an
 * extension-platform entrypoint, not an Angular surface.
 *
 * Add a directory here when it needs Angular templates, and add the same path
 * to `include` in tsconfig.app.json. The two lists are one decision recorded
 * twice; they drift silently if only one is edited.
 */
const ANGULAR_DIRS = [
  '/entrypoints/popup/',
  '/entrypoints/options/',
  '/entrypoints/sidepanel/',
  '/entrypoints/viewer/'
];

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'Tallpage',
    description: 'Export the current webpage, top to bottom, as PNG, PDF, HTML, or Markdown.',
    minimum_chrome_version: '116',

    // Keep this minimal. Chrome Web Store policy, enforced since 2026-08-01,
    // requires everything requested to be strictly necessary for the stated
    // purpose — add a permission when a feature needs it, never upfront.
    //
    // `debugger` is the expensive one and it is deliberate. Chrome exposes no
    // other renderer-level full-page capture API: `tabs.captureVisibleTab` sees
    // only the viewport, so the alternative is scrolling and stitching frames
    // by hand, which guesses at sticky positioning, scroll-triggered reveals,
    // lazy images and late-injected chrome. Resizing the emulated viewport and
    // asking `Page.captureScreenshot` for one paint avoids those heuristics.
    //
    // Know what it costs before touching it: `debugger` CANNOT be an optional
    // permission, it warns "Read and change all your data on all websites" at
    // install, it shows an undismissable banner while attached, and it can
    // make review deeper and slower.
    //
    // `activeTab` stays because the toolbar click is what exposes the tab's
    // title, which names the downloaded file.
    permissions: [ 'storage', 'activeTab', 'downloads', 'debugger' ],

    // Still empty, and it stays that way — nothing here needs a host pattern.
    host_permissions: []
  },

  hooks: {
    /**
     * Keep `CLAUDE.md` out of the shipped package.
     *
     * `public/` is copied verbatim, so the docs §P3 requires in every active
     * directory would otherwise be bundled into `.output/` and uploaded to the
     * store with the extension. Nothing warns about it — the build succeeds and
     * the files are simply there, which is why §S2 says to read the built
     * output rather than the config.
     */
    'build:publicAssets': (_wxt, files) => {
      const kept = files.filter((file) => !file.relativeDest.endsWith('CLAUDE.md'));

      // The hook mutates the array it is given; returning a new one is ignored.
      files.length = 0;
      files.push(...kept);
    }
  },

  vite: () => ({
    resolve: {
      // Angular ships ESM and UMD builds; prefer ESM so the bundle tree-shakes.
      mainFields: [ 'module' ]
    },
    plugins: [
      angular({
        tsconfig: 'tsconfig.app.json',
        transformFilter: (_code: string, id: string) => {
          const path = id.replace(/\\/g, '/');

          return ANGULAR_DIRS.some((dir) => path.includes(dir));
        }
      })
    ]
  })
});
