import type { ApiResponse } from '../server/envelope.js'
import type { PieceDetail, PieceSummary } from '../server/pieces.js'

export class PiecesRequestFailure extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PiecesRequestFailure'
  }
}

async function unwrap<T>(response: Response): Promise<T> {
  const body = (await response.json()) as ApiResponse<T>
  if (!body.success) {
    throw new PiecesRequestFailure(body.error.message)
  }
  return body.data
}

export async function fetchPieces(): Promise<readonly PieceSummary[]> {
  const res = await fetch('/pieces')
  return unwrap<readonly PieceSummary[]>(res)
}

export async function fetchPiece(id: string): Promise<PieceDetail> {
  const res = await fetch(`/pieces/${encodeURIComponent(id)}`)
  return unwrap<PieceDetail>(res)
}

export type CreatePieceResult = { readonly ok: true; readonly piece: PieceSummary } | { readonly ok: false; readonly message: string }

export async function createPiece(title: string): Promise<CreatePieceResult> {
  const res = await fetch('/pieces', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  try {
    const piece = await unwrap<PieceSummary>(res)
    return { ok: true, piece }
  } catch (err) {
    if (err instanceof PiecesRequestFailure) {
      return { ok: false, message: err.message }
    }
    throw err
  }
}
