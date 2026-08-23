import { useCallback, useEffect, useState } from 'react'
import { chooseWorkspace, fetchWorkspace } from './workspaceClient.js'
import { isAbortError } from './request.js'

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

type LoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'loaded'; readonly workspace: string | null }

/**
 * Owns the one thing the client asks about the workspace: whether it is
 * configured yet, and setting it when it is not. SPEC "Files" holds the
 * workspace path as process configuration once it is set, so nothing here
 * re-fetches after a successful submit.
 */
export function useWorkspace(): WorkspaceViewModel {
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' })
  const [error, setError] = useState<string | undefined>(undefined)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetchWorkspace(controller.signal)
      .then((workspace) => setLoad({ kind: 'loaded', workspace }))
      .catch((err: unknown) => {
        if (isAbortError(err)) return
        setLoad({ kind: 'error', message: err instanceof Error ? err.message : 'failed to load workspace' })
      })
    return () => controller.abort()
  }, [])

  const submit = useCallback((candidate: string) => {
    setSubmitting(true)
    setError(undefined)
    chooseWorkspace(candidate)
      .then((result) => {
        setSubmitting(false)
        if (result.ok) {
          setLoad({ kind: 'loaded', workspace: result.workspace })
        } else {
          setError(result.message)
        }
      })
      .catch((err: unknown) => {
        setSubmitting(false)
        setError(err instanceof Error ? err.message : 'failed to set workspace')
      })
  }, [])

  if (load.kind === 'loading') return { status: 'loading' }
  if (load.kind === 'error') return { status: 'error', message: load.message }
  if (load.workspace === null) return { status: 'unset', error, submitting, submit }
  return { status: 'set', workspace: load.workspace }
}
