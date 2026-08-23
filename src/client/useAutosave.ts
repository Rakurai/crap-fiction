import { useEffect, useRef, useState } from 'react'
import { createAutosaveController, type AutosaveState } from './autosave.js'
import type { saveDraft as saveDraftFn } from './piecesClient.js'

/**
 * The controller's own state, passed through rather than flattened. Flattening it
 * into three optional fields made the surface re-check what the union already
 * guarantees — a failed save always has a message and a moment — and a check that
 * cannot fail is a check that stops meaning anything (CODING_STANDARDS "Types":
 * a discriminated union over an optional field encoding a state).
 */
export type AutosaveViewModel = Readonly<{
  state: AutosaveState
  flush: () => void
}>

/**
 * SPEC "Write semantics": debounces `draft.md` writes through the pure
 * controller in `autosave.ts`, keeping React's part to the manuscript text
 * as it changes and the failed-save indicator. `pieceId` is fixed for the
 * life of one controller — the surface that opens a piece unmounts this hook
 * rather than handing it a new id, so there is nothing to re-point mid-flight.
 * `saveDraft` reaches the server; the caller supplies it rather than this
 * hook importing the adapter that performs it.
 */
export function useAutosave(pieceId: string, markdown: string, saveDraft: typeof saveDraftFn): AutosaveViewModel {
  const [state, setState] = useState<AutosaveState>({ failed: false })
  const controllerRef = useRef<ReturnType<typeof createAutosaveController> | undefined>(undefined)

  controllerRef.current ??= createAutosaveController(markdown, (text) => saveDraft(pieceId, text), setState, () => Date.now())
  const controller = controllerRef.current

  useEffect(() => {
    controller.update(markdown)
  }, [controller, markdown])

  useEffect(() => {
    return () => controller.flush()
  }, [controller])

  return { state, flush: controller.flush }
}
