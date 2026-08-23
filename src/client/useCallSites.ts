import { useCallback, useEffect, useState } from 'react'
import type { CallSiteAssignmentView } from '../server/model/callSites.js'
import type { RuntimeStatus } from '../server/model/types.js'
import { assignModel, fetchCallSites, fetchRuntimeStatus } from './callSitesClient.js'

export type CallSitesViewModel =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready'
      readonly sites: readonly CallSiteAssignmentView[]
      readonly runtime: RuntimeStatus | undefined
      readonly assigning: string | undefined
      readonly assignError: string | undefined
      readonly assign: (site: string, model: string) => void
    }

/**
 * PRD "Assign models to participants": owns the call-site listing, the
 * runtime's reachability, and assigning one site at a time. A site being
 * saved is tracked by its own id rather than a single boolean, since the
 * one-at-a-time contract still allows a second row's assignment to be read
 * while the first is in flight.
 */
export function useCallSites(): CallSitesViewModel {
  const [sites, setSites] = useState<readonly CallSiteAssignmentView[] | undefined>(undefined)
  const [runtime, setRuntime] = useState<RuntimeStatus | undefined>(undefined)
  const [assigning, setAssigning] = useState<string | undefined>(undefined)
  const [assignError, setAssignError] = useState<string | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    fetchCallSites().then((value) => {
      if (!cancelled) setSites(value)
    })
    fetchRuntimeStatus().then((value) => {
      if (!cancelled) setRuntime(value)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const assign = useCallback((site: string, model: string) => {
    setAssigning(site)
    setAssignError(undefined)
    assignModel(site, model).then((result) => {
      setAssigning(undefined)
      if (result.ok) {
        setSites((current) => current?.map((s) => (s.site === site ? { ...s, assignment: result.assignment } : s)))
      } else {
        setAssignError(result.message)
      }
    })
  }, [])

  if (sites === undefined) return { status: 'loading' }
  return { status: 'ready', sites, runtime, assigning, assignError, assign }
}
