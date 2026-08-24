import { useCallback, useState } from 'react'
import { useLoaded } from './load.js'
import { failureMessage } from './request.js'
import { chooseWorkspace, fetchWorkspace } from './workspaceClient.js'

export type WorkspaceViewModel =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | {
      readonly status: 'unset'
      readonly error: string | undefined
      readonly submitting: boolean
      readonly submit: (candidate: string) => void
    }
  | { readonly status: 'set'; readonly workspace: string }

export function useWorkspace(): WorkspaceViewModel {
  const [load, setLoad] = useLoaded(fetchWorkspace, [])
  const [error, setError] = useState<string | undefined>(undefined)
  const [submitting, setSubmitting] = useState(false)

  const submit = useCallback((candidate: string) => {
    setSubmitting(true)
    setError(undefined)
    void chooseWorkspace(candidate).then((result) => {
      setSubmitting(false)
      if (result.outcome === 'value') {
        setLoad({ kind: 'ready', value: { workspace: result.value.workspace } })
        return
      }
      setError(failureMessage(result))
    })
  }, [])

  if (load.kind === 'loading') return { status: 'loading' }
  if (load.kind === 'error') return { status: 'error', message: load.message }
  if (load.value.workspace === null) return { status: 'unset', error, submitting, submit }
  return { status: 'set', workspace: load.value.workspace }
}
