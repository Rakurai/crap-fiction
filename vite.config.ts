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
      // The client's own HTML shell is Vite's to serve; everything else
      // not otherwise excluded is a candidate for a Hono route.
      exclude: [...defaultOptions.exclude, /^\/$/],
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
