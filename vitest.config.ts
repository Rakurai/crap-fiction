import { defineConfig } from 'vitest/config'

/**
 * The environment follows from the directory rather than a per-file
 * `@vitest-environment` pragma: `tests/client/dom` holds the client surfaces
 * that need a browser, and everything else — the server, the shared code,
 * the pure client reducers, the boundary checks — runs in `node`.
 */
export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'client-dom',
          include: ['tests/client/dom/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
        },
      },
      {
        extends: true,
        test: {
          name: 'node',
          include: ['tests/**/*.test.{ts,tsx}'],
          exclude: ['tests/client/dom/**'],
          environment: 'node',
        },
      },
    ],
  },
})
