import devServer, { defaultOptions } from '@hono/vite-dev-server'
import { expect, test } from '@playwright/test'
import { createServer, type ViteDevServer } from 'vite'
import { SSE_EVENT_NAMES } from '../../src/server/sse.js'

/**
 * The browser half of the SSE transport proof in tests/server/sseTransport.test.ts:
 * the same fixture route, reached by a real EventSource in a real page,
 * rather than by a raw fetch read loop.
 */
let server: ViteDevServer
let baseUrl: string

test.beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: process.cwd(),
    logLevel: 'silent',
    plugins: [
      devServer({
        entry: 'tests/fixtures/sseProofApp.ts',
        exclude: [...defaultOptions.exclude, /^\/$/],
      }),
    ],
    server: { port: 0, host: '127.0.0.1' },
  })
  await server.listen()
  const address = server.httpServer?.address()
  if (address === null || typeof address === 'string' || address === undefined) {
    throw new Error('dev server did not bind to a TCP port')
  }
  baseUrl = `http://127.0.0.1:${address.port}`
})

test.afterAll(async () => {
  await server.close()
})

test('the closed SSE event set reaches a browser', async ({ page }) => {
  await page.goto(baseUrl)

  const receivedNames = await page.evaluate(async (url) => {
    return new Promise<string[]>((resolve, reject) => {
      const names: string[] = []
      const source = new EventSource(url)
      const timeout = setTimeout(() => reject(new Error('timed out waiting for events')), 5000)

      const eventNames = [
        'round.opened',
        'participant.state',
        'participant.settled',
        'round.closed',
        'error',
      ]
      for (const name of eventNames) {
        source.addEventListener(name, () => {
          names.push(name)
          if (names.length === eventNames.length) {
            clearTimeout(timeout)
            source.close()
            resolve(names)
          }
        })
      }
    })
  }, `${baseUrl}/sse-proof`)

  expect(receivedNames).toEqual([...SSE_EVENT_NAMES])
})
