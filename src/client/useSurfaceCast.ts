import { useCallback, useEffect, useRef, useState } from 'react'
import type { CastMemberView } from '../shared/pieceViews.js'
import type { SurfaceId } from '../shared/surfaces.js'
import { failureMessage } from './request.js'
import type { PieceAdapters } from './usePiece.js'

export type SurfaceCastViewModel = Readonly<{
  members: readonly CastMemberView[]
  /** The member whose enablement is in flight, so its own control can say so. */
  toggling: string | undefined
  error: string | undefined
  toggle: (memberId: string) => void
}>

/**
 * One surface's cast: who is in the room for it, which member is being brought in or sent away, and
 * what went wrong if that request failed. A cast is per surface, so the roster the studio answers
 * with is read back for this surface alone — another surface's cast is untouched by it.
 */
export function useSurfaceCast(
  pieceId: string,
  surface: SurfaceId,
  initialMembers: readonly CastMemberView[],
  { updatePiece }: PieceAdapters,
): SurfaceCastViewModel {
  const [members, setMembers] = useState(initialMembers)
  const [toggling, setToggling] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const desired = useRef(initialMembers)
  const confirmed = useRef(initialMembers)
  const revision = useRef(0)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const inFlight = useRef<AbortController | undefined>(undefined)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      inFlight.current?.abort()
    }
  }, [])

  const toggle = useCallback(
    (memberId: string) => {
      if (!desired.current.some((member) => member.id === memberId)) return
      const target = desired.current.map((member) => (member.id === memberId ? { ...member, enabled: !member.enabled } : member))
      desired.current = target
      const targetRevision = ++revision.current
      setToggling(memberId)
      setError(undefined)

      queue.current = queue.current.then(async () => {
        if (!mounted.current) return
        const controller = new AbortController()
        inFlight.current = controller
        const ids = target.filter((member) => member.enabled).map((member) => member.id)
        const result = await updatePiece(pieceId, { cast: { surface, ids } }, controller.signal)
        if (!mounted.current || controller.signal.aborted) return
        inFlight.current = undefined
        if (result.outcome === 'value') {
          confirmed.current = result.value.surfaces[surface].cast
          if (targetRevision === revision.current) {
            desired.current = confirmed.current
            setMembers(confirmed.current)
            setToggling(undefined)
          }
          return
        }
        if (targetRevision === revision.current) {
          desired.current = confirmed.current
          setMembers(confirmed.current)
          setToggling(undefined)
          setError(failureMessage(result))
        }
      })
    },
    [pieceId, surface, updatePiece],
  )

  return { members, toggling, error, toggle }
}
