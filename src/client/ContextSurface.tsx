import type { KeyboardEvent } from 'react'
import { type SurfaceId } from '../shared/surfaces.js'
import { ApplyingBanner } from './ApplyingBanner.js'
import styles from './ContextSurface.module.css'
import { DocumentHeader } from './DocumentHeader.js'
import { facts, machineWords } from './facts.js'
import type { LifecycleProps } from './pieceLifecycle.js'
import { SaveFailure } from './SaveFailure.js'
import type { ApplyingHold } from './useConversationSession.js'
import type { AutosaveViewModel } from './useAutosave.js'

export type ContextSurfaceId = Exclude<SurfaceId, 'draft'>

const LABEL: Readonly<Record<ContextSurfaceId, string>> = {
  storyContext: 'Story context',
  authorContext: 'Author context',
}

function isUndoKeystroke(event: KeyboardEvent): boolean {
  return event.key.toLowerCase() === 'z' && (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey
}

type ContextSurfaceProps = {
  readonly surface: ContextSurfaceId
  readonly title: string
  readonly onOpenPieces: () => void
  readonly onOpenModels: () => void
  readonly text: string
  readonly location: string
  readonly onChange: (text: string) => void
  readonly referenceSchema: string | null
  readonly autosave: AutosaveViewModel
  readonly onSwitchTo: (surface: SurfaceId) => void
  readonly lifecycle: LifecycleProps
  readonly applying: ApplyingHold | undefined
  readonly onReverseApplication: () => boolean
}

export function ContextSurface({
  surface,
  title,
  onOpenPieces,
  onOpenModels,
  text,
  location,
  onChange,
  referenceSchema,
  autosave,
  onSwitchTo,
  lifecycle,
  applying,
  onReverseApplication,
}: ContextSurfaceProps) {

  return (
    <div className={styles.wrapper}>
      <DocumentHeader
        onOpenPieces={onOpenPieces}
        onOpenModels={onOpenModels}
        title={title}
        lifecycle={lifecycle}
        surface={surface}
        onSwitchTo={onSwitchTo}
      />

      {lifecycle.retitleError !== undefined && (
        <p className={styles.lifecycleError} role="alert">
          {lifecycle.retitleError}
        </p>
      )}

      {applying !== undefined && <ApplyingBanner applying={applying} />}

      <div className={styles.scroll}>
        <div className={styles.measure}>
          <div className={styles.contextFacts}>{facts(machineWords(LABEL[surface]), location)}</div>
          <textarea
            aria-label={LABEL[surface]}
            className={styles.text}
            value={text}
            disabled={applying !== undefined}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (isUndoKeystroke(event) && onReverseApplication()) event.preventDefault()
            }}
          />
        </div>
      </div>

      {referenceSchema !== null && (
        <details className={styles.reference}>
          <summary className={styles.referenceSummary}>reference schema</summary>
          <p className={styles.referenceBody}>{referenceSchema}</p>
        </details>
      )}

      {autosave.state.failed && <SaveFailure failure={autosave.state} location={location} title={title} />}
    </div>
  )
}
