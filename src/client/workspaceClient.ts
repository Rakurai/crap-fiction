import type { ApiResponse } from '../server/envelope.js'

export class WorkspaceRequestFailure extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkspaceRequestFailure'
  }
}

async function unwrap<T>(response: Response): Promise<T> {
  const body = (await response.json()) as ApiResponse<T>
  if (!body.success) {
    throw new WorkspaceRequestFailure(body.error.message)
  }
  return body.data
}

export async function fetchWorkspace(): Promise<string | null> {
  const res = await fetch('/workspace')
  const data = await unwrap<{ workspace: string | null }>(res)
  return data.workspace
}

export type ChooseWorkspaceResult = { ok: true; workspace: string } | { ok: false; message: string }

export async function chooseWorkspace(candidate: string): Promise<ChooseWorkspaceResult> {
  const res = await fetch('/workspace', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspace: candidate }),
  })
  try {
    const data = await unwrap<{ workspace: string }>(res)
    return { ok: true, workspace: data.workspace }
  } catch (err) {
    if (err instanceof WorkspaceRequestFailure) {
      return { ok: false, message: err.message }
    }
    throw err
  }
}
