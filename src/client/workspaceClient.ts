import { z } from 'zod'
import { RequestFailure, requestJson } from './request.js'

const workspaceStateSchema = z.object({ workspace: z.string().nullable() })
const workspaceSetSchema = z.object({ workspace: z.string() })

export async function fetchWorkspace(signal?: AbortSignal): Promise<string | null> {
  const data = await requestJson('/workspace', workspaceStateSchema, { signal: signal ?? null })
  return data.workspace
}

export type ChooseWorkspaceResult = { readonly ok: true; readonly workspace: string } | { readonly ok: false; readonly message: string }

export async function chooseWorkspace(candidate: string, signal?: AbortSignal): Promise<ChooseWorkspaceResult> {
  try {
    const data = await requestJson('/workspace', workspaceSetSchema, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspace: candidate }),
      signal: signal ?? null,
    })
    return { ok: true, workspace: data.workspace }
  } catch (err) {
    if (err instanceof RequestFailure) {
      return { ok: false, message: err.message }
    }
    throw err
  }
}
