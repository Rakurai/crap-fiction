import { z } from 'zod'
import { pieceDetailSchema, pieceSummarySchema, type PieceDetail, type PieceStatus, type PieceSummary } from '../shared/pieceViews.js'
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

export type PiecePatch = Readonly<{ title?: string; status?: PieceStatus; cast?: readonly string[] }>

/**
 * #13 "The room"/#19 "Piece lifecycle": the one PATCH the route answers with
 * the piece as it now stands, on the same terms as opening it — enabling and
 * disabling a specialist, retitling and marking a piece finished or
 * abandoned are all this one call, differing only in which fields the
 * caller names.
 */
export function updatePiece(id: string, patch: PiecePatch, signal?: AbortSignal): Promise<RequestResult<PieceDetail>> {
  return requestJson(`/pieces/${encodeURIComponent(id)}`, pieceDetailSchema, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
    signal: signal ?? null,
  })
}
