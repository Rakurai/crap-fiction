import { afterEach, describe, expect, it, vi } from 'vitest'
import { abandonOperation, subscribeToRoom } from '../../../src/client/roomClient.js'

/**
 * A harness standing in for the platform `EventSource`: it supplies nothing the real one
 * would not (no default frames, no auto-reconnect), only a way for a test to drive the
 * listeners `subscribeToRoom` registers and to reach the instance it constructed.
 */
class FakeEventSource {
  static instances: FakeEventSource[] = []
  readonly listeners = new Map<string, Set<(event: Event) => void>>()

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this)
  }

  addEventListener(type: string, listener: (event: Event) => void): void {
    const set = this.listeners.get(type) ?? new Set()
    set.add(listener)
    this.listeners.set(type, set)
  }

  close(): void {}

  emit(type: string, event: Event): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }
}

function firstFakeSource(): FakeEventSource {
  const [source] = FakeEventSource.instances
  if (source === undefined) throw new Error('expected subscribeToRoom to have constructed an EventSource')
  return source
}

/** Reacts to the signal it was actually given, the same as a real request would. */
function stubFetchRespectingSignal() {
  const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
    const signal = init?.signal
    return new Promise((_resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException('aborted', 'AbortError'))
        return
      }
      signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('an abandonable client operation', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('propagates the caller’s own cancellation to the underlying request rather than only stopping local observation', async () => {
    const fetchMock = stubFetchRespectingSignal()
    const controller = new AbortController()

    const result = abandonOperation('the-lighthouse', 'draft', 'c1', 'a1', controller.signal)
    controller.abort()

    expect(await result).toEqual({ outcome: 'abandoned' })
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ signal: controller.signal }))
  })
})

describe('learning a piece’s activity over its event stream', () => {
  afterEach(() => {
    FakeEventSource.instances = []
    vi.unstubAllGlobals()
  })

  it('resolves with the parsed snapshot for a well-formed frame', async () => {
    vi.stubGlobal('EventSource', FakeEventSource)

    const { snapshot } = subscribeToRoom('the-lighthouse', () => {}, () => {})
    const parsedActivity = { draft: null, storyContext: null, authorContext: null }
    firstFakeSource().emit('activity.snapshot', new MessageEvent('activity.snapshot', { data: JSON.stringify(parsedActivity) }))

    await expect(snapshot).resolves.toEqual(parsedActivity)
  })

  it('rejects, and reports the malformed frame, rather than substituting an empty snapshot when the frame does not parse', async () => {
    vi.stubGlobal('EventSource', FakeEventSource)
    const onMalformedFrame = vi.fn()

    const { snapshot } = subscribeToRoom('the-lighthouse', () => {}, onMalformedFrame)
    firstFakeSource().emit('activity.snapshot', new MessageEvent('activity.snapshot', { data: 'not json' }))

    await expect(snapshot).rejects.toThrow(/malformed/)
    expect(onMalformedFrame).toHaveBeenCalledWith(expect.stringContaining('activity.snapshot'))
  })

  it('rejects rather than hanging forever when the connection fails before any snapshot arrives', async () => {
    vi.stubGlobal('EventSource', FakeEventSource)

    const { snapshot } = subscribeToRoom('the-lighthouse', () => {}, () => {})
    firstFakeSource().emit('error', new Event('error'))

    await expect(snapshot).rejects.toThrow()
  })
})
