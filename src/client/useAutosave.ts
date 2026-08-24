import { useEffect, useRef, useState } from 'react'
import { createAutosaveController, type AutosaveState } from './autosave.js'
import type { saveDraft as saveDraftFn } from './piecesClient.js'

export type AutosaveViewModel = Readonly<{
  state: AutosaveState
  flush: () => void
}>

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
