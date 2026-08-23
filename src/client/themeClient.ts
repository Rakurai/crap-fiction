import { z } from 'zod'
import { themeSchema, type Theme } from '../shared/theme.js'
import { requestJson, type RequestResult } from './request.js'

const themeStateSchema = z.object({ theme: themeSchema.nullable() })
const themeSetSchema = z.object({ theme: themeSchema })

export function fetchTheme(signal?: AbortSignal): Promise<RequestResult<{ theme: Theme | null }>> {
  return requestJson('/theme', themeStateSchema, { signal: signal ?? null })
}

export function chooseTheme(theme: Theme, signal?: AbortSignal): Promise<RequestResult<{ theme: Theme }>> {
  return requestJson('/theme', themeSetSchema, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ theme }),
    signal: signal ?? null,
  })
}
