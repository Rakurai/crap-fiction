import type { fetchCallSites as fetchCallSitesFn } from './callSitesClient.js'
import { useLoaded } from './load.js'

export type ParticipantIdentity = Readonly<{
  displayName: string
  handle: string | undefined
  mark: string | null
  ordinal: number | null
}>

const UNKNOWN_PARTICIPANT: ParticipantIdentity = Object.freeze({
  displayName: 'Unknown participant',
  handle: undefined,
  mark: null,
  ordinal: null,
})

export type RosterViewModel =
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'error'; message: string }>
  | Readonly<{ kind: 'ready'; identify: (participantId: string) => ParticipantIdentity }>

export function useRoster(fetchCallSites: typeof fetchCallSitesFn): RosterViewModel {
  const [sites] = useLoaded(fetchCallSites, [])

  if (sites.kind === 'loading') return { kind: 'loading' }
  if (sites.kind === 'error') return { kind: 'error', message: sites.message }

  const named = sites.value
  return {
    kind: 'ready',
    identify: (participantId) => {
      const site = named.find((candidate) => candidate.site === participantId)
      if (site === undefined) return UNKNOWN_PARTICIPANT
      return {
        displayName: site.displayName,
        handle: site.handle ?? undefined,
        mark: site.mark,
        ordinal: site.ordinal,
      }
    },
  }
}
