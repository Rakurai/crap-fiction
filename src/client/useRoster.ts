import type { fetchCallSites as fetchCallSitesFn } from './callSitesClient.js'
import { useLoaded } from './load.js'

/**
 * UX_DESIGN "Participant responses": every visible response carries the
 * participant's identity, and identity is identity only. A participant's mark is
 * assigned by its place in the roster rather than by its id, so the room stays
 * legible when the author edits it and nothing here has to know which
 * specialists shipped. The last of the five is the ink the prose is set in, which
 * is what `tokens.css` reserves for the Story Editor — the roster puts it last,
 * where the round reaches it.
 */
const MARKS = ['var(--mark-teal)', 'var(--mark-indigo)', 'var(--mark-clay)', 'var(--mark-olive)', 'var(--ink)']

/** A participant no roster named has no identity to carry, so it is drawn in quiet chrome. */
const UNMARKED = 'var(--ink3)'

/** A participant as the composer's handle completion offers it — nothing an operation carries. */
export type HandleEntry = Readonly<{ handle: string; displayName: string }>

export type RosterViewModel = Readonly<{
  /**
   * Whether the roster request has finished, either way. The conversation waits
   * on this rather than on success, because a roster that could not be read is
   * still an answer and the author must not be left without the surface.
   */
  settled: boolean
  /** The room's name for a participant, falling back to its id only when nothing named it. */
  displayName: (participantId: string) => string
  /** The participant's own colour, as a value a style can carry. */
  mark: (participantId: string) => string
  /** UX_DESIGN "Actions on a response": the shipped handle for a participant, so replying can address it in the main input the way typing `@` would — absent for an operation call site, which is never addressed. */
  handle: (participantId: string) => string | undefined
  /**
   * SPEC "Model access"/"The room": every participant's handle, for the
   * composer's own combobox — the shipped handles, read from the roster rather
   * than written out in the client. An operation call site carries no handle
   * (it is never addressed), so it is absent here rather than offered as
   * something the author could type `@` toward.
   */
  handles: readonly HandleEntry[]
}>

/**
 * The room's own names, which the conversation needs and the models screen's
 * concerns — reachability, assignment — have nothing to do with. They were the
 * same hook, and because that hook reported ready before the roster had arrived,
 * every conversation drew participants by their internal ids first and their
 * names a moment later. A name that changes under the author is worse than a
 * surface that waits for it.
 */
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
