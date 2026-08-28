import { mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from '@playwright/test'

const PORT = 5273
const FIXTURE_PORT = 5274

const RUNNER_OUTPUT = path.join(import.meta.dirname, 'test-results', 'runner')

function emptyDataRoot(name: string): string {
  const dir = path.join(import.meta.dirname, 'test-results', name)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  return dir
}

const DATA_ROOT = emptyDataRoot('studio-data-root')
const FIXTURE_DATA_ROOT = emptyDataRoot('studio-fixture-data-root')

export default defineConfig({
  testDir: 'tests',
  testMatch: '**/*.spec.ts',
  outputDir: RUNNER_OUTPUT,
  reporter: 'list',
  workers: 1,
  use: {
    channel: 'chrome',
  },
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
      url: `http://127.0.0.1:${PORT}/workspace`,
      reuseExistingServer: false,
      env: {
        STUDIO_DATA_ROOT: DATA_ROOT,
        STUDIO_PORT: String(PORT),
        // The arrangement journey contacts no model: no call site is assigned
        // one, which is the state a first run is in anyway. The URL is required
        // to parse and is never reached.
        STUDIO_MODEL_RUNTIME_URL: `ws://127.0.0.1:${PORT + 100}`,
        STUDIO_LOG_LEVEL: 'silent',
        STUDIO_TRACE: 'off',
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
        STUDIO_TRACE: 'off',
      },
    },
  ],
})
