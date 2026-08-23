import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  // The browser is the one already installed on the author's machine rather
  // than a pinned build downloaded into a cache: there is one author, one
  // machine, and the browser they write in is the browser worth proving
  // against.
  use: { channel: 'chrome' },
})
