import { useCallback, useRef, useState } from 'react'
import type { RosterMemberView } from '../shared/pieceViews.js'
import type { SurfaceId } from '../shared/surfaces.js'
import { failureMessage } from './request.js'
import type { PieceAdapters } from './usePiece.js'
import { useWriteSerializer } from './useWriteSerializer.js'

export type SurfaceCastViewModel = Readonly<{
  members: readonly RosterMemberView[]
  toggling: string | undefined
  error: string | undefined
  toggle: (memberId: string) => void
}>

export function useSurfaceCast(
  pieceId: string,
  surface: SurfaceId,
  initialMembers: readonly RosterMemberView[],
  { updatePiece }: PieceAdapters,
): SurfaceCastViewModel {
  const [members, setMembers] = useState(initialMembers)
  const [toggling, setToggling] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const desired = useRef(initialMembers)
  const confirmed = useRef(initialMembers)
  const serializer = useWriteSerializer()

  const toggle = useCallback(
    (memberId: string) => {
      if (!desired.current.some((member) => member.id === memberId)) return
      const target = desired.current.map((member) => (member.id === memberId ? { ...member, enabled: !member.enabled } : member))
      desired.current = target
      const targetRevision = serializer.nextRevision()
      setToggling(memberId)
      setError(undefined)

      const ids = target.filter((member) => member.enabled).map((member) => member.id)
      void serializer.run((signal) => updatePiece(pieceId, { cast: { surface, ids } }, signal)).then((result) => {
        if (result === undefined) return
        if (result.outcome === 'value') {
          confirmed.current = result.value.surfaces[surface].roster
          if (serializer.isCurrent(targetRevision)) {
            desired.current = confirmed.current
            setMembers(confirmed.current)
            setToggling(undefined)
          }
          return
        }
        if (serializer.isCurrent(targetRevision)) {
          desired.current = confirmed.current
          setMembers(confirmed.current)
          setToggling(undefined)
          setError(failureMessage(result))
        }
      })
    },
    [pieceId, surface, updatePiece, serializer],
  )

  return { members, toggling, error, toggle }
}
