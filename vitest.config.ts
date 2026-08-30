import yaml from '@rollup/plugin-yaml'
import type { PluginOption } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [yaml() as PluginOption],
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
})
