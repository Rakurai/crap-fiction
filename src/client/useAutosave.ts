import { useEffect, useRef, useState } from 'react'
import { createAutosaveController, type AutosaveState, type SaveDocument } from './autosave.js'

export type AutosaveViewModel = Readonly<{
  state: AutosaveState
  flush: () => Promise<AutosaveState>
  install: (text: string) => Promise<AutosaveState>
}>

export function useAutosave(markdown: string, save: SaveDocument): AutosaveViewModel {
  const [state, setState] = useState<AutosaveState>({ failed: false })
  const controllerRef = useRef<ReturnType<typeof createAutosaveController> | undefined>(undefined)

  controllerRef.current ??= createAutosaveController(markdown, save, setState, () => Date.now())
  const controller = controllerRef.current

  // React may verify an effect by cleaning it up and starting it again without another render. The
  // controller therefore follows the effect lifecycle rather than being removed from its render ref.
  useEffect(() => {
    controller.activate()
    return controller.dispose
  }, [controller])

  useEffect(() => {
    controller.update(markdown)
  }, [controller, markdown])

  return { state, flush: controller.flush, install: controller.install }
}
