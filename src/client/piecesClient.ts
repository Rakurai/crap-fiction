import { z } from 'zod'
import { castMemberViewSchema, pieceDetailSchema, pieceSummarySchema, type CastMemberView, type PieceDetail, type PieceSummary } from '../shared/pieceViews.js'
import { requestJson, type RequestResult } from './request.js'

/**
 * The piece routes, each one line: what the route is, and what shape its payload
 * has. Every one of them answers in the same `RequestResult`, so nothing here
 * translates one representation of failure into another — that translation, six
 * times over, was what these modules used to be mostly made of.
 */
export function fetchPieces(signal?: AbortSignal): Promise<RequestResult<readonly PieceSummary[]>> {
  return requestJson('/pieces', z.array(pieceSummarySchema).readonly(), { signal: signal ?? null })
}

export function fetchPiece(id: string, signal?: AbortSignal): Promise<RequestResult<PieceDetail>> {
  return requestJson(`/pieces/${encodeURIComponent(id)}`, pieceDetailSchema, { signal: signal ?? null })
}

export function saveDraft(id: string, draft: string, signal?: AbortSignal): Promise<RequestResult<null>> {
  return requestJson(`/pieces/${encodeURIComponent(id)}/draft`, z.null(), {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ draft }),
    signal: signal ?? null,
  })
}

export function createPiece(title: string, signal?: AbortSignal): Promise<RequestResult<PieceSummary>> {
  return requestJson('/pieces', pieceSummarySchema, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title }),
    signal: signal ?? null,
  })
}

/** CONTEXT "Room"/#13: enabling and disabling a specialist, carrying the piece's whole enabled cast at once. */
export function setPieceCast(id: string, cast: readonly string[], signal?: AbortSignal): Promise<RequestResult<readonly CastMemberView[]>> {
  return requestJson(`/pieces/${encodeURIComponent(id)}`, z.array(castMemberViewSchema).readonly(), {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cast }),
    signal: signal ?? null,
  })
}
