import { z } from 'zod'
import type { CallSiteAssignmentView } from '../../shared/callSiteViews.js'
import { readSettingsSection, type SettingsStore } from '../store/index.js'
import type { CallSiteDescriptor } from './callSites.js'
import { requireCallSite, withAssignments } from './callSites.js'

const assignmentsSchema = z.record(z.string(), z.string().min(1))

export function getAssignment(dataRoot: string, site: string): string | undefined {
  return readSettingsSection(dataRoot, 'modelAssignments', assignmentsSchema)?.[site]
}

export function listAssignments(dataRoot: string): ReadonlyMap<string, string> {
  return new Map(Object.entries(readSettingsSection(dataRoot, 'modelAssignments', assignmentsSchema) ?? {}))
}

export async function setAssignment(
  settings: SettingsStore,
  dataRoot: string,
  sites: readonly CallSiteDescriptor[],
  site: string,
  model: string,
): Promise<void> {
  requireCallSite(sites, site)
  await settings.writeSection(dataRoot, 'modelAssignments', { [site]: model }, assignmentsSchema)
}

export class CallSiteAssignments {
  readonly #dataRoot: string
  readonly #sites: readonly CallSiteDescriptor[]
  readonly #settings: SettingsStore

  constructor(dataRoot: string, sites: readonly CallSiteDescriptor[], settings: SettingsStore) {
    this.#dataRoot = dataRoot
    this.#sites = sites
    this.#settings = settings
  }

  list(): readonly CallSiteAssignmentView[] {
    return withAssignments(this.#sites, listAssignments(this.#dataRoot))
  }

  async assign(site: string, model: string): Promise<void> {
    await setAssignment(this.#settings, this.#dataRoot, this.#sites, site, model)
  }
}
