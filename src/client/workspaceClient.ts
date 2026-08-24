import { z } from 'zod'
import { requestJson, type RequestResult } from './request.js'

const workspaceStateSchema = z.object({ workspace: z.string().nullable() })
const workspaceSetSchema = z.object({ workspace: z.string() })

export function fetchWorkspace(signal?: AbortSignal): Promise<RequestResult<{ workspace: string | null }>> {
  return requestJson('/workspace', workspaceStateSchema, { signal: signal ?? null })
}

export function chooseWorkspace(candidate: string, signal?: AbortSignal): Promise<RequestResult<{ workspace: string }>> {
  return requestJson('/workspace', workspaceSetSchema, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspace: candidate }),
    signal: signal ?? null,
  })
}
