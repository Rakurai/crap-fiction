import { z } from 'zod'
import { callSiteAssignmentViewSchema, type CallSiteAssignmentView } from '../shared/callSiteViews.js'
import { runtimeStatusSchema, type RuntimeStatus } from '../shared/runtimeStatus.js'
import { requestJson, type RequestResult } from './request.js'

export function fetchCallSites(signal?: AbortSignal): Promise<RequestResult<readonly CallSiteAssignmentView[]>> {
  return requestJson('/call-sites', z.array(callSiteAssignmentViewSchema).readonly(), { signal: signal ?? null })
}

export function fetchRuntimeStatus(signal?: AbortSignal): Promise<RequestResult<RuntimeStatus>> {
  return requestJson('/models', runtimeStatusSchema, { signal: signal ?? null })
}

const assignmentResultSchema = z.object({ site: z.string(), assignment: z.string() })

export function assignModel(
  site: string,
  model: string,
  signal?: AbortSignal,
): Promise<RequestResult<{ site: string; assignment: string }>> {
  return requestJson(`/call-sites/${encodeURIComponent(site)}/assignment`, assignmentResultSchema, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model }),
    signal: signal ?? null,
  })
}
