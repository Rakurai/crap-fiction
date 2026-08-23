import react from '@vitejs/plugin-react'
import devServer, { defaultOptions } from '@hono/vite-dev-server'
import { defineConfig } from 'vite'
import { loadEnv } from './src/server/env.js'

const env = loadEnv()

export default defineConfig({
  plugins: [
    react(),
    devServer({
      entry: 'src/server/index.ts',
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
})
