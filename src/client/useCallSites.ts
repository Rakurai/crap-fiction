import { useCallback, useEffect, useState } from 'react'
import type { CallSiteAssignmentView } from '../shared/callSiteViews.js'
import type { RuntimeStatus } from '../shared/runtimeStatus.js'
import type { assignModel as assignModelFn, fetchCallSites as fetchCallSitesFn, fetchRuntimeStatus as fetchRuntimeStatusFn } from './callSitesClient.js'
import { useLoaded } from './load.js'
import { failureMessage } from './request.js'

export type CallSiteAdapters = Readonly<{
  fetchCallSites: typeof fetchCallSitesFn
  fetchRuntimeStatus: typeof fetchRuntimeStatusFn
  assignModel: typeof assignModelFn
}>

const SAVED_STANDS_MS = 2600

export type CallSitesViewModel =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | {
      readonly status: 'ready'
      readonly room: readonly CallSiteAssignmentView[]
      readonly operations: readonly CallSiteAssignmentView[]
      readonly runtime: RuntimeStatus | undefined
      readonly runtimeError: string | undefined
      readonly assigning: string | undefined
      readonly saved: string | undefined
      readonly assignError: string | undefined
      readonly assign: (site: string, model: string) => void
    }

export function useCallSites(adapters: CallSiteAdapters): CallSitesViewModel {
  const { fetchCallSites, fetchRuntimeStatus, assignModel } = adapters
  const [sites, setSites] = useLoaded(fetchCallSites, [])
  const [probe] = useLoaded(fetchRuntimeStatus, [])
  const [assigning, setAssigning] = useState<string | undefined>(undefined)
  const [saved, setSaved] = useState<string | undefined>(undefined)
  const [assignError, setAssignError] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (saved === undefined) return
    const timer = setTimeout(() => setSaved(undefined), SAVED_STANDS_MS)
    return () => clearTimeout(timer)
  }, [saved])

  const assign = useCallback((site: string, model: string) => {
    setAssigning(site)
    setAssignError(undefined)
    void assignModel(site, model).then((result) => {
      setAssigning(undefined)
      if (result.outcome === 'value') {
        const { assignment } = result.value
        setSites((current) =>
          current.kind === 'ready'
            ? { kind: 'ready', value: current.value.map((s) => (s.site === site ? { ...s, assignment } : s)) }
            : current,
        )
        setSaved(site)
        return
      }
      setAssignError(failureMessage(result))
    })
  }, [])

  if (sites.kind === 'loading' || probe.kind === 'loading') return { status: 'loading' }
  if (sites.kind === 'error') return { status: 'error', message: sites.message }
  return {
    status: 'ready',
    room: sites.value.filter((site) => site.handle !== null),
    operations: sites.value.filter((site) => site.handle === null),
    runtime: probe.kind === 'ready' ? probe.value : undefined,
    runtimeError: probe.kind === 'error' ? probe.message : undefined,
    assigning,
    saved,
    assignError,
    assign,
  }
}
