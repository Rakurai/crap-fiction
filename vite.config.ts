import { readFileSync } from 'node:fs'
import path from 'node:path'
import { parse } from 'yaml'
import react from '@vitejs/plugin-react'
import yaml from '@rollup/plugin-yaml'
import devServer, { defaultOptions } from '@hono/vite-dev-server'
import { defineConfig, type PluginOption, type UserConfig } from 'vite'
import { loadEnv } from './src/server/env.js'
import { validateConfig } from './src/shared/config.js'

const CONFIG_PATH = path.join(import.meta.dirname, 'config.yaml')

export function studioConfig(entry: string): UserConfig {
  const env = loadEnv()
  validateConfig(parse(readFileSync(CONFIG_PATH, 'utf8')), CONFIG_PATH)
  return {
    plugins: [
      yaml() as PluginOption,
      react(),
      devServer({
        entry,
        // The client's own HTML shell is Vite's to serve, as are the typeface
        // files the token layer names — the default excludes cover source and
        // stylesheets but no binary asset, so a font request would otherwise
        // reach the Hono application and come back a 404. Everything else not
        // excluded is a candidate for a Hono route.
        exclude: [...defaultOptions.exclude, /^\/$/, /\.woff2$/, /\.yaml($|\?)/],
      }),
    ],
    server: {
      host: true,
      port: env.port,
      strictPort: true,
    },
  }
}

export default defineConfig(studioConfig('src/server/index.ts'))
