import { useEffect, useRef, useState } from 'react'
import { createAutosaveController } from './autosave.js'
import { saveDraft } from './piecesClient.js'

export type AutosaveViewModel = {
  readonly failed: boolean
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
  const [failed, setFailed] = useState(false)
  const controllerRef = useRef<ReturnType<typeof createAutosaveController> | undefined>(undefined)

  controllerRef.current ??= createAutosaveController(
    markdown,
    (text) => saveDraft(pieceId, text),
    (state) => setFailed(state.failed),
  )
  const controller = controllerRef.current

  useEffect(() => {
    controller.update(markdown)
  }, [controller, markdown])

  useEffect(() => {
    return () => controller.flush()
  }, [controller])

  return { failed, flush: controller.flush }
}
