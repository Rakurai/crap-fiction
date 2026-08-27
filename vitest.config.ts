import { defineConfig } from 'vitest/config'

/**
 * The runner selects the environment by matching the directories the tests are
 * already grouped into, rather than a per-file `@vitest-environment` pragma:
 * `tests/client` holds the surfaces and the state behind them, which React needs
 * a browser for, and everything else — the server, the shared code, the studio
 * stood up whole, the boundary checks — runs in `node`.
 */
export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'client',
          include: ['tests/client/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['tests/client/setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'node',
          include: ['tests/**/*.test.{ts,tsx}'],
          exclude: ['tests/client/**'],
          environment: 'node',
        },
      },
    ],
  },
})
