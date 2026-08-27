import { SURFACE_IDS } from '../shared/surfaces.js'
import type { AutosaveState } from './autosave.js'
import type { BySurface } from './bySurface.js'

export type ClosePieceResult = Readonly<{ blocked: boolean }>

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
