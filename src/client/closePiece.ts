import { SURFACE_IDS } from '../shared/surfaces.js'
import type { AutosaveState } from './autosave.js'
import type { BySurface } from './bySurface.js'

export type ClosePieceResult = Readonly<{ blocked: boolean }>

/**
 * Leaving an open piece: every surface is flushed and waited on, and a failed write is the one thing
 * that keeps the piece open — the author's text is what this protects. A surface with no writer is a
 * document nothing can flush, so it blocks leaving exactly as a failed write does rather than being
 * read as a surface with nothing to save. What a surface still has in flight is not this request's
 * to end: the studio abandons a piece's unfinished work itself when another piece is opened.
 */
export async function closePiece(flush: BySurface<() => Promise<AutosaveState>>): Promise<ClosePieceResult> {
  const writers: (() => Promise<AutosaveState>)[] = []
  for (const surface of SURFACE_IDS) {
    const write = flush[surface]
    if (write === undefined) return { blocked: true }
    writers.push(write)
  }
  const flushed = await Promise.all(writers.map((write) => write()))
  return { blocked: flushed.some((state) => state.failed) }
}
