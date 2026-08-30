import { useMemo } from 'react'
import type { AddressableParticipantView } from '../../shared/pieceViews.js'
import type { SurfaceId } from '../../shared/surfaces.js'
import { presentValue, readState } from '../servedFacts/readState.js'
import { usePieceDetail } from '../servedFacts/resources.js'

export type ParticipantIdentity = Readonly<{
  id: string
  handle: string
  displayName: string
  mark: string
  ordinal: number | null
}>

function toIdentity(participant: AddressableParticipantView): ParticipantIdentity {
  return {
    id: participant.id,
    handle: participant.handle,
    displayName: participant.displayName,
    mark: participant.mark,
    ordinal: participant.eligibility === 'generalist' ? null : participant.ordinal,
  }
}

export function useParticipantIdentities(pieceId: string, surface: SurfaceId): ReadonlyMap<string, ParticipantIdentity> {
  const detail = presentValue(readState(usePieceDetail(pieceId)))
  const addressable = detail?.surfaces[surface].addressable

  return useMemo(() => new Map((addressable ?? []).map((participant) => [participant.id, toIdentity(participant)])), [addressable])
}
