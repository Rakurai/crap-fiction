import { z } from 'zod'
import { callSiteAssignmentViewSchema, type CallSiteAssignmentView } from '../shared/callSiteViews.js'
import { runtimeStatusSchema, type RuntimeStatus } from '../shared/runtimeStatus.js'
import { RequestFailure, requestJson } from './request.js'

export async function fetchCallSites(signal?: AbortSignal): Promise<readonly CallSiteAssignmentView[]> {
  return requestJson('/call-sites', z.array(callSiteAssignmentViewSchema).readonly(), { signal: signal ?? null })
}

export async function fetchRuntimeStatus(signal?: AbortSignal): Promise<RuntimeStatus> {
  return requestJson('/models', runtimeStatusSchema, { signal: signal ?? null })
}

const assignmentResultSchema = z.object({ site: z.string(), assignment: z.string() })

export type AssignModelResult = { readonly ok: true; readonly assignment: string } | { readonly ok: false; readonly message: string }

export async function assignModel(site: string, model: string, signal?: AbortSignal): Promise<AssignModelResult> {
  try {
    const data = await requestJson(`/call-sites/${encodeURIComponent(site)}/assignment`, assignmentResultSchema, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model }),
      signal: signal ?? null,
    })
    return { ok: true, assignment: data.assignment }
  } catch (err) {
    if (err instanceof RequestFailure) {
      return { ok: false, message: err.message }
    }
    throw err
  }
}
