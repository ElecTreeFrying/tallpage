import { defineConfig } from 'wxt';
import angular from '@analogjs/vite-plugin-angular';

/**
 * Directories the Angular compiler is allowed to touch.
 *
 * This is the load-bearing part of the Angular-on-WXT setup. Angular is not an
 * official WXT framework module, so it arrives as an ordinary Vite plugin — and
 * left alone that plugin compiles every file in the project, including the
 * background service worker and the content script. Both must stay plain
 * TypeScript: the content script is injected into every matched page and has no
 * business carrying an Angular runtime.
 *
 * Add a directory here when it needs Angular templates, and add the same path
 * to `include` in tsconfig.app.json. The two lists are one decision recorded
 * twice; they drift silently if only one is edited.
 */
const ANGULAR_DIRS = [
  '/entrypoints/popup/',
  '/entrypoints/options/',
  '/entrypoints/sidepanel/'
];

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'Blank Slate',
    description: 'Blank-slate Chrome extension. Rename me.',

    // Keep this minimal. Chrome Web Store policy, enforced since 2026-08-01,
    // requires everything requested to be strictly necessary for the stated
    // purpose — add a permission when a feature needs it, never upfront.
    permissions: [ 'storage' ],

    // Hosts the content script may touch. Narrow this to real hosts before
    // shipping; `<all_urls>` triggers a markedly slower store review.
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
