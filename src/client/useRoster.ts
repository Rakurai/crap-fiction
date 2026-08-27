import type { fetchCallSites as fetchCallSitesFn } from './callSitesClient.js'
import { useLoaded } from './load.js'

export type ParticipantIdentity = Readonly<{
  displayName: string
  handle: string | undefined
  mark: string | null
  ordinal: number | null
}>

export type RosterViewModel = Readonly<{
  settled: boolean
  identify: (participantId: string) => ParticipantIdentity
}>

export function useRoster(fetchCallSites: typeof fetchCallSitesFn): RosterViewModel {
  const [sites] = useLoaded(fetchCallSites, [])
  const named = sites.kind === 'ready' ? sites.value : []

  return {
    settled: sites.kind !== 'loading',
    identify: (participantId) => {
      const site = named.find((candidate) => candidate.site === participantId)
      return {
        displayName: site?.displayName ?? participantId,
        handle: site?.handle ?? undefined,
        mark: site?.mark ?? null,
        ordinal: site?.ordinal ?? null,
      }
    },
  }
}
