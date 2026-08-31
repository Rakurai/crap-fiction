type SubscribableValue<T> = Readonly<{
  get: () => T
  set: (value: T) => void
  subscribe: (onChange: () => void) => () => void
}>

export function createSubscribableValue<T>(initial: T): SubscribableValue<T> {
  let current = initial
  const listeners = new Set<() => void>()

  return {
    get: () => current,
    set: (value) => {
      current = value
      for (const listener of listeners) listener()
    },
    subscribe: (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
  }
}
