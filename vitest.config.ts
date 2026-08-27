import yaml from '@rollup/plugin-yaml'
import type { PluginOption } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [yaml() as PluginOption],
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
