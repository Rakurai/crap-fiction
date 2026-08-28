import yaml from '@rollup/plugin-yaml'
import type { PluginOption } from 'vite'
import { defineConfig } from 'vitest/config'

const ON_SCREEN = 'tests/**/*.onScreen.test.{ts,tsx}'

export default defineConfig({
  plugins: [yaml() as PluginOption],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'onScreen',
          include: [ON_SCREEN],
          environment: 'jsdom',
          setupFiles: ['tests/support/domSetup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'rules',
          include: ['tests/**/*.test.{ts,tsx}'],
          exclude: [ON_SCREEN],
          environment: 'node',
        },
      },
    ],
  },
})
