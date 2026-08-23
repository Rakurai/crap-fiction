import { useEffect, useRef, useState } from 'react'
import { createAutosaveController, type AutosaveState } from './autosave.js'
import { saveDraft } from './piecesClient.js'

export type AutosaveViewModel = {
  readonly failed: boolean
  readonly message: string | undefined
  readonly failedAtMs: number | undefined
  readonly flush: () => void
}

/**
 * SPEC "Write semantics": debounces `draft.md` writes through the pure
 * controller in `autosave.ts`, keeping React's part to the manuscript text
 * as it changes and the failed-save indicator. `pieceId` is fixed for the
 * life of one controller — the surface that opens a piece unmounts this hook
 * rather than handing it a new id, so there is nothing to re-point mid-flight.
 */
export function useAutosave(pieceId: string, markdown: string): AutosaveViewModel {
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

  return {
    failed: state.failed,
    message: state.failed ? state.message : undefined,
    failedAtMs: state.failed ? state.atMs : undefined,
    flush: controller.flush,
  }
}
