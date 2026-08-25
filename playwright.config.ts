import { mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from '@playwright/test'

/**
 * The browser suite runs the studio the way the author runs it — Vite serving
 * the client with the Hono application inside it — and nothing here reads
 * `.env`. The ports and the data roots are the suite's own and are stated
 * rather than inherited, for two reasons: a run must not write into the
 * author's work, and it must not fight the studio they already have open.
 *
 * Two studios, because the suite has two kinds of journey. The arrangement
 * journey walks the deployment the author runs, whose model runtime is a URL
 * nothing is listening on — that journey contacts no model. The other three
 * need a round to settle and an application to return prose, so they answer
 * from the fixture model implementation: a second entry, served identically,
 * reached only by naming `vite.fixture.config.ts`. Neither studio can become
 * the other, which is the point of there being two.
 */
const PORT = 5273
const FIXTURE_PORT = 5274

/**
 * A run starts from nothing, so each journey walks the path a first run walks:
 * no settings file, no workspace, no pieces. The directories are left behind
 * after a run rather than cleaned up, because a failed journey is diagnosed by
 * looking at what did and did not reach disk.
 */
function emptyDataRoot(name: string): string {
  const dir = path.join(import.meta.dirname, 'test-results', name)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  return dir
}

const DATA_ROOT = emptyDataRoot('studio-data-root')
const FIXTURE_DATA_ROOT = emptyDataRoot('studio-fixture-data-root')

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
  },
  // Which studio a journey belongs to is stated here rather than read out of a
  // file name: a journey names no port and no data root of its own.
  projects: [
    {
      name: 'arrangement',
      testMatch: '**/arrangement.spec.ts',
      use: { baseURL: `http://127.0.0.1:${PORT}` },
    },
    {
      name: 'fixture',
      testIgnore: '**/arrangement.spec.ts',
      use: { baseURL: `http://127.0.0.1:${FIXTURE_PORT}` },
    },
  ],
  webServer: [
    {
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
        // The arrangement journey contacts no model: no call site is assigned
        // one, which is the state a first run is in anyway. The URL is required
        // to parse and is never reached.
        STUDIO_MODEL_RUNTIME_URL: `ws://127.0.0.1:${PORT + 100}`,
        STUDIO_LOG_LEVEL: 'silent',
      },
    },
    {
      command: 'npm run dev:fixture',
      url: `http://127.0.0.1:${FIXTURE_PORT}/workspace`,
      reuseExistingServer: false,
      env: {
        STUDIO_DATA_ROOT: FIXTURE_DATA_ROOT,
        STUDIO_PORT: String(FIXTURE_PORT),
        // Read like every other STUDIO_* variable and never reached: this studio
        // answers from the fixture implementation, which contacts nothing.
        STUDIO_MODEL_RUNTIME_URL: `ws://127.0.0.1:${FIXTURE_PORT + 100}`,
        STUDIO_LOG_LEVEL: 'silent',
      },
    },
  ],
})
