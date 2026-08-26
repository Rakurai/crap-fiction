import { useEffect, useRef, useState } from 'react'
import { createAutosaveController, type AutosaveState, type SaveDocument } from './autosave.js'

export type AutosaveViewModel = Readonly<{
  state: AutosaveState
  flush: () => void
}>

export function useAutosave(markdown: string, save: SaveDocument): AutosaveViewModel {
  const [state, setState] = useState<AutosaveState>({ failed: false })
  const controllerRef = useRef<ReturnType<typeof createAutosaveController> | undefined>(undefined)

  controllerRef.current ??= createAutosaveController(markdown, save, setState, () => Date.now())
  const controller = controllerRef.current

  useEffect(() => {
    controller.update(markdown)
  }, [controller, markdown])

  useEffect(() => {
    return () => controller.flush()
  }, [controller])

  return { state, flush: controller.flush }
}
