import { mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from '@playwright/test'

/**
 * The browser suite runs the studio the way the author runs it — Vite serving
 * the client with the Hono application inside it (SPEC "Deployment") — and
 * nothing here reads `.env`. The port and the data root are the suite's own and
 * are stated rather than inherited, for two reasons: a run must not write into
 * the author's work, and it must not fight the studio they already have open.
 */
const PORT = 5273
const DATA_ROOT = path.join(import.meta.dirname, 'test-results', 'studio-data-root')

/**
 * A run starts from nothing, so the journey walks the path a first run walks:
 * no settings file, no workspace, no pieces. The directory is left behind after
 * a run rather than cleaned up, because a failed journey is diagnosed by
 * looking at what did and did not reach disk.
 */
rmSync(DATA_ROOT, { recursive: true, force: true })
mkdirSync(DATA_ROOT, { recursive: true })

export default defineConfig({
  // Which runner takes a file follows from its name, not its directory: `.spec`
  // is a journey through a browser and `.test` is everything else, and
  // `vitest.config.ts` claims the second set by the same rule. A browser test
  // written anywhere under `tests/` is therefore reached by this suite, and no
  // file is claimed twice or by neither.
  testDir: 'tests',
  testMatch: '**/*.spec.ts',
  reporter: 'list',
  // One studio, one data root, one author: the suite is serial by construction,
  // and two journeys creating pieces in the same workspace at once would be
  // proving something no author does.
  workers: 1,
  use: {
    // The browser is the one already installed on the author's machine rather
    // than a pinned build downloaded into a cache: there is one author, one
    // machine, and the browser they write in is the browser worth proving
    // against.
    channel: 'chrome',
    baseURL: `http://127.0.0.1:${PORT}`,
  },
  webServer: {
    command: 'npm run dev',
    // The same request the container's healthcheck makes: it answers whether or
    // not a workspace is configured, and contacts no model.
    url: `http://127.0.0.1:${PORT}/workspace`,
    // Never an already-running studio — that one is pointed at the author's own
    // data root, and this suite creates pieces and writes drafts.
    reuseExistingServer: false,
    env: {
      STUDIO_DATA_ROOT: DATA_ROOT,
      STUDIO_PORT: String(PORT),
      // The journey contacts no model: no call site is assigned one, which is
      // the state a first run is in anyway. The URL is required to parse and is
      // never reached.
      STUDIO_MODEL_RUNTIME_URL: `ws://127.0.0.1:${PORT + 1}`,
      STUDIO_LOG_LEVEL: 'silent',
    },
  },
})
