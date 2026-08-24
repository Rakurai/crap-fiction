import { z } from 'zod'
import { readSettingsSection, writeSettingsSection } from '../store/index.js'
import type { CallSiteDescriptor } from './callSites.js'
import { requireCallSite } from './callSites.js'

const assignmentsSchema = z.record(z.string(), z.string().min(1))

export function getAssignment(dataRoot: string, site: string): string | undefined {
  return readSettingsSection(dataRoot, 'modelAssignments', assignmentsSchema)?.[site]
}

export function listAssignments(dataRoot: string): ReadonlyMap<string, string> {
  return new Map(Object.entries(readSettingsSection(dataRoot, 'modelAssignments', assignmentsSchema) ?? {}))
}

export async function setAssignment(
  dataRoot: string,
  sites: readonly CallSiteDescriptor[],
  site: string,
  model: string,
): Promise<void> {
  requireCallSite(sites, site)
  await writeSettingsSection(dataRoot, 'modelAssignments', { [site]: model })
}
