import type { fetchCallSites as fetchCallSitesFn } from './callSitesClient.js'
import { useLoaded } from './load.js'

export type RosterViewModel = Readonly<{
  settled: boolean
  displayName: (participantId: string) => string
  handle: (participantId: string) => string | undefined
}>

export function useRoster(fetchCallSites: typeof fetchCallSitesFn): RosterViewModel {
  const [sites] = useLoaded(fetchCallSites, [])
  const named = sites.kind === 'ready' ? sites.value : []

  return {
    settled: sites.kind !== 'loading',
    displayName: (participantId) => named.find((site) => site.site === participantId)?.displayName ?? participantId,
    handle: (participantId) => named.find((site) => site.site === participantId)?.handle ?? undefined,
  }
}
