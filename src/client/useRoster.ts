import type { fetchCallSites as fetchCallSitesFn } from './callSitesClient.js'
import { useLoaded } from './load.js'

const MARKS = ['var(--mark-teal)', 'var(--mark-indigo)', 'var(--mark-clay)', 'var(--mark-olive)', 'var(--ink)']

const UNMARKED = 'var(--ink3)'

export type HandleEntry = Readonly<{ handle: string; displayName: string }>

export type RosterViewModel = Readonly<{
  settled: boolean
  displayName: (participantId: string) => string
  mark: (participantId: string) => string
  handle: (participantId: string) => string | undefined
  handles: readonly HandleEntry[]
}>

export function useRoster(fetchCallSites: typeof fetchCallSitesFn): RosterViewModel {
  const [sites] = useLoaded(fetchCallSites, [])
  const named = sites.kind === 'ready' ? sites.value : []

  return {
    settled: sites.kind !== 'loading',
    displayName: (participantId) => named.find((site) => site.site === participantId)?.displayName ?? participantId,
    mark: (participantId) => {
      const place = named.findIndex((site) => site.site === participantId)
      return place === -1 ? UNMARKED : (MARKS[place % MARKS.length] ?? UNMARKED)
    },
    handle: (participantId) => named.find((site) => site.site === participantId)?.handle ?? undefined,
    handles: named.flatMap((site) => (site.handle === null ? [] : [{ handle: site.handle, displayName: site.displayName ?? site.site }])),
  }
}
