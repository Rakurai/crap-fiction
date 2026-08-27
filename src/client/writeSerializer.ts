export type WriteSerializer = Readonly<{
  nextRevision: () => number
  isCurrent: (revision: number) => boolean
  run: <T>(operation: (signal: AbortSignal) => Promise<T>) => Promise<T | undefined>
  activate: () => void
  dispose: () => void
}>

export function createWriteSerializer(): WriteSerializer {
  let queue: Promise<unknown> = Promise.resolve()
  let inFlight: AbortController | undefined
  let disposed = false
  let revision = 0

  function run<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T | undefined> {
    const operationDone = queue.then(async () => {
      if (disposed) return undefined
      const controller = new AbortController()
      inFlight = controller
      const result = await operation(controller.signal)
      inFlight = undefined
      if (disposed || controller.signal.aborted) return undefined
      return result
    })
    queue = operationDone.then(
      () => undefined,
      () => undefined,
    )
    return operationDone
  }

  return {
    nextRevision: () => ++revision,
    isCurrent: (target) => target === revision,
    run,
    activate() {
      disposed = false
    },
    dispose() {
      disposed = true
      inFlight?.abort()
    },
  }
}
