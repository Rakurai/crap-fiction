import { z } from 'zod'
import { readSettingsSection, writeSettingsSection } from '../store/index.js'
import type { CallSiteDescriptor } from './callSites.js'
import { requireCallSite } from './callSites.js'

const assignmentsSchema = z.record(z.string(), z.string().min(1))

/**
 * SPEC "Files": model assignment is a property of the author's machine
 * rather than of any story, so it lives in `settings.yaml` beside the
 * workspace path and the theme. It is author-editable data, re-read at the
 * moment a call is compiled rather than cached from startup — reassigning a
 * participant and asking the room again is the diagnostic loop the design
 * depends on, and holding it in memory would cost a restart per experiment.
 */
export function getAssignment(dataRoot: string, site: string): string | undefined {
  return readSettingsSection(dataRoot, 'modelAssignments', assignmentsSchema)?.[site]
}

export function listAssignments(dataRoot: string): ReadonlyMap<string, string> {
  return new Map(Object.entries(readSettingsSection(dataRoot, 'modelAssignments', assignmentsSchema) ?? {}))
}

/**
 * SPEC "Transport": a model is assigned one call site per request, never as
 * a read-modify-write over every other assignment, so an author pointing one
 * participant at a different model cannot lose one they did not touch. `site`
 * is checked against the roster here, at the seam that knows call sites,
 * rather than by the route that calls this.
 */
export async function setAssignment(
  dataRoot: string,
  sites: readonly CallSiteDescriptor[],
  site: string,
  model: string,
): Promise<void> {
  requireCallSite(sites, site)
  await writeSettingsSection(dataRoot, 'modelAssignments', { [site]: model })
}
