import { useMemo } from 'react'
import type { AddressableParticipantView } from '../../shared/pieceViews.js'
import type { SurfaceId } from '../../shared/surfaces.js'
import { presentValue, readState } from '../servedFacts/readState.js'
import { usePieceDetail } from '../servedFacts/resources.js'

type NamedParticipant = Readonly<{ id: string; handle: string; displayName: string; mark: string }>

export type ParticipantIdentity = NamedParticipant &
  (Readonly<{ eligibility: 'cast' | 'addressed-only'; ordinal: number }> | Readonly<{ eligibility: 'generalist' }>)

export function participantIdentity(participant: AddressableParticipantView): ParticipantIdentity {
  const named: NamedParticipant = {
    id: participant.id,
    handle: participant.handle,
    displayName: participant.displayName,
    mark: participant.mark,
  }
  return participant.eligibility === 'generalist'
    ? { ...named, eligibility: 'generalist' }
    : { ...named, eligibility: participant.eligibility, ordinal: participant.ordinal }
}

export function useParticipantIdentities(pieceId: string, surface: SurfaceId): ReadonlyMap<string, ParticipantIdentity> {
  const detail = presentValue(readState(usePieceDetail(pieceId)))
  const addressable = detail?.surfaces[surface].addressable

  return useMemo(() => new Map((addressable ?? []).map((participant) => [participant.id, participantIdentity(participant)])), [addressable])
}
