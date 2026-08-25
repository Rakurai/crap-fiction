import { z } from 'zod'
import { modeSummarySchema, type ModeSummary } from '../shared/modeViews.js'
import { requestJson, type RequestResult } from './request.js'

export function fetchModes(signal?: AbortSignal): Promise<RequestResult<readonly ModeSummary[]>> {
  return requestJson('/modes', z.array(modeSummarySchema).readonly(), { signal: signal ?? null })
}
