import { z } from 'zod'
import { pieceDetailSchema, pieceSummarySchema, type PieceDetail, type PieceStatus, type PieceSummary } from '../shared/pieceViews.js'
import { requestJson, type RequestResult } from './request.js'

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

export function createPiece(title: string, mode: string, signal?: AbortSignal): Promise<RequestResult<PieceSummary>> {
  return requestJson('/pieces', pieceSummarySchema, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title, mode }),
    signal: signal ?? null,
  })
}

export type PiecePatch = Readonly<{ title?: string; status?: PieceStatus; cast?: readonly string[] }>

export function updatePiece(id: string, patch: PiecePatch, signal?: AbortSignal): Promise<RequestResult<PieceDetail>> {
  return requestJson(`/pieces/${encodeURIComponent(id)}`, pieceDetailSchema, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
    signal: signal ?? null,
  })
}
