import type { ApiResponse } from '../server/envelope.js'
import type { CallSiteAssignmentView } from '../server/model/callSites.js'
import type { RuntimeStatus } from '../server/model/types.js'

export class CallSitesRequestFailure extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CallSitesRequestFailure'
  }
}

async function unwrap<T>(response: Response): Promise<T> {
  const body = (await response.json()) as ApiResponse<T>
  if (!body.success) {
    throw new CallSitesRequestFailure(body.error.message)
  }
  return body.data
}

export async function fetchCallSites(): Promise<readonly CallSiteAssignmentView[]> {
  const res = await fetch('/call-sites')
  return unwrap<readonly CallSiteAssignmentView[]>(res)
}

export async function fetchRuntimeStatus(): Promise<RuntimeStatus> {
  const res = await fetch('/models')
  return unwrap<RuntimeStatus>(res)
}

export type AssignModelResult = { readonly ok: true; readonly assignment: string } | { readonly ok: false; readonly message: string }

export async function assignModel(site: string, model: string): Promise<AssignModelResult> {
  const res = await fetch(`/call-sites/${encodeURIComponent(site)}/assignment`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model }),
  })
  try {
    const data = await unwrap<{ site: string; assignment: string }>(res)
    return { ok: true, assignment: data.assignment }
  } catch (err) {
    if (err instanceof CallSitesRequestFailure) {
      return { ok: false, message: err.message }
    }
    throw err
  }
}
