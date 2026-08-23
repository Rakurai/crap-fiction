import { useCallback, useEffect, useState } from 'react'
import type { CallSiteAssignmentView } from '../server/model/callSites.js'
import type { RuntimeStatus } from '../server/model/types.js'
import { assignModel, fetchCallSites, fetchRuntimeStatus } from './callSitesClient.js'
import { isAbortError } from './request.js'

export type CallSitesViewModel =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | {
      readonly status: 'ready'
      readonly sites: readonly CallSiteAssignmentView[]
      readonly runtime: RuntimeStatus | undefined
      readonly runtimeError: string | undefined
      readonly assigning: string | undefined
      readonly assignError: string | undefined
      readonly assign: (site: string, model: string) => void
    }

type LoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'ready'; readonly sites: readonly CallSiteAssignmentView[] }

/**
 * PRD "Assign models to participants": owns the call-site listing, the
 * runtime's reachability, and assigning one site at a time. A site being
 * saved is tracked by its own id rather than a single boolean, since the
 * one-at-a-time contract still allows a second row's assignment to be read
 * while the first is in flight.
 */
export function useCallSites(): CallSitesViewModel {
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' })
  const [runtime, setRuntime] = useState<RuntimeStatus | undefined>(undefined)
  const [runtimeError, setRuntimeError] = useState<string | undefined>(undefined)
  const [assigning, setAssigning] = useState<string | undefined>(undefined)
  const [assignError, setAssignError] = useState<string | undefined>(undefined)

  useEffect(() => {
    const controller = new AbortController()
    fetchCallSites(controller.signal)
      .then((sites) => setLoad({ kind: 'ready', sites }))
      .catch((err: unknown) => {
        if (isAbortError(err)) return
        setLoad({ kind: 'error', message: err instanceof Error ? err.message : 'failed to load call sites' })
      })
    fetchRuntimeStatus(controller.signal)
      .then((status) => setRuntime(status))
      .catch((err: unknown) => {
        if (isAbortError(err)) return
        setRuntimeError(err instanceof Error ? err.message : 'failed to load model runtime status')
      })
    return () => controller.abort()
  }, [])

  const assign = useCallback((site: string, model: string) => {
    setAssigning(site)
    setAssignError(undefined)
    assignModel(site, model)
      .then((result) => {
        setAssigning(undefined)
        if (result.ok) {
          setLoad((current) =>
            current.kind === 'ready'
              ? { kind: 'ready', sites: current.sites.map((s) => (s.site === site ? { ...s, assignment: result.assignment } : s)) }
              : current,
          )
        } else {
          setAssignError(result.message)
        }
      })
      .catch((err: unknown) => {
        setAssigning(undefined)
        setAssignError(err instanceof Error ? err.message : 'failed to assign model')
      })
  }, [])

  if (load.kind === 'loading') return { status: 'loading' }
  if (load.kind === 'error') return { status: 'error', message: load.message }
  return { status: 'ready', sites: load.sites, runtime, runtimeError, assigning, assignError, assign }
}
