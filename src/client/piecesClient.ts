import { z } from 'zod'
import { pieceDetailSchema, pieceSummarySchema, type PieceDetail, type PieceSummary } from '../server/pieces.js'
import { RequestFailure, requestJson } from './request.js'

export async function fetchPieces(signal?: AbortSignal): Promise<readonly PieceSummary[]> {
  return requestJson('/pieces', z.array(pieceSummarySchema).readonly(), { signal: signal ?? null })
}

export async function fetchPiece(id: string, signal?: AbortSignal): Promise<PieceDetail> {
  return requestJson(`/pieces/${encodeURIComponent(id)}`, pieceDetailSchema, { signal: signal ?? null })
}

export async function saveDraft(id: string, draft: string, signal?: AbortSignal): Promise<void> {
  await requestJson(`/pieces/${encodeURIComponent(id)}/draft`, z.null(), {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ draft }),
    signal: signal ?? null,
  })
}

export type CreatePieceResult = { readonly ok: true; readonly piece: PieceSummary } | { readonly ok: false; readonly message: string }

export async function createPiece(title: string, signal?: AbortSignal): Promise<CreatePieceResult> {
  try {
    const piece = await requestJson('/pieces', pieceSummarySchema, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title }),
      signal: signal ?? null,
    })
    return { ok: true, piece }
  } catch (err) {
    if (err instanceof RequestFailure) {
      return { ok: false, message: err.message }
    }
    throw err
  }
}
