import react from '@vitejs/plugin-react'
import devServer, { defaultOptions } from '@hono/vite-dev-server'
import { defineConfig, type UserConfig } from 'vite'
import { loadEnv } from './src/server/env.js'

/**
 * Vite serving the client with a Hono application inside it (SPEC
 * "Deployment"). The entry is a parameter because there is a second studio —
 * the one answering from the fixture model implementation, named by
 * `vite.fixture.config.ts` — and everything else about how a studio is served
 * is the same for both. Stated once here so the two cannot drift.
 */
export function studioConfig(entry: string): UserConfig {
  const env = loadEnv()
  return {
    plugins: [
      react(),
      devServer({
        entry,
        // The client's own HTML shell is Vite's to serve, as are the typeface
        // files the token layer names — the default excludes cover source and
        // stylesheets but no binary asset, so a font request would otherwise
        // reach the Hono application and come back a 404. Everything else not
        // excluded is a candidate for a Hono route.
        exclude: [...defaultOptions.exclude, /^\/$/, /\.woff2$/],
      }),
    ],
    server: {
      // SPEC "Local exposure": the namespace the deployment container supplies
      // is the boundary; binding every interface here is what makes the
      // published-loopback bind in the container's docker-compose reachable.
      host: true,
      port: env.port,
      strictPort: true,
    },
  }
}

export default defineConfig(studioConfig('src/server/index.ts'))
