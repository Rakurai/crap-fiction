import { useCallback, useEffect, useState } from 'react'
import { chooseWorkspace, fetchWorkspace } from './workspaceClient.js'

export type WorkspaceViewModel =
  | { readonly status: 'loading' }
  | {
      readonly status: 'unset'
      readonly error: string | undefined
      readonly submitting: boolean
      readonly submit: (candidate: string) => void
    }
  | { readonly status: 'set'; readonly workspace: string }

/**
 * Owns the one thing the client asks about the workspace: whether it is
 * configured yet, and setting it when it is not. SPEC "Files" holds the
 * workspace path as process configuration once it is set, so nothing here
 * re-fetches after a successful submit.
 */
export function useWorkspace(): WorkspaceViewModel {
  const [workspace, setWorkspace] = useState<string | null | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchWorkspace().then((value) => {
      if (!cancelled) setWorkspace(value)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const submit = useCallback((candidate: string) => {
    setSubmitting(true)
    setError(undefined)
    chooseWorkspace(candidate).then((result) => {
      setSubmitting(false)
      if (result.ok) {
        setWorkspace(result.workspace)
      } else {
        setError(result.message)
      }
    })
  }, [])

  if (workspace === undefined) return { status: 'loading' }
  if (workspace === null) return { status: 'unset', error, submitting, submit }
  return { status: 'set', workspace }
}
