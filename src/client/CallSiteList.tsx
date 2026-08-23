import { useState, type FormEvent } from 'react'
import type { CallSiteAssignmentView } from '../shared/callSiteViews.js'
import styles from './CallSiteList.module.css'

type CallSiteListProps = {
  readonly sites: readonly CallSiteAssignmentView[]
  /** What the runtime reports it holds, offered so the author need not type one. */
  readonly known: readonly string[]
  readonly assigning: string | undefined
  readonly onAssign: (site: string, model: string) => void
}

/**
 * One form per site, so a site is assignable one at a time. The models the
 * runtime reports are offered through the platform's own datalist: an identifier
 * typed with a character wrong is a call site that fails as unconfigured at the
 * next round, discovered minutes later. It stays a text field rather than a
 * closed list, because a model the runtime does not hold yet is still one the
 * author may be pointing a participant at.
 */
export function CallSiteList({ sites, known, assigning, onAssign }: CallSiteListProps) {
  const [empty, setEmpty] = useState<string | undefined>(undefined)

  return (
    <ul className={styles.list}>
      {sites.map((site) => (
        <li key={site.site} className={styles.item}>
          <div className={styles.name}>{site.displayName ?? site.site}</div>
          {site.roleDescription !== null && <p className={styles.role}>{site.roleDescription}</p>}
          <form
            className={styles.form}
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault()
              const model = new FormData(event.currentTarget).get('model')
              const named = typeof model === 'string' ? model.trim() : ''
              if (named.length === 0) {
                setEmpty(site.site)
                return
              }
              setEmpty(undefined)
              onAssign(site.site, named)
            }}
          >
            <label className={styles.label} htmlFor={`model-${site.site}`}>
              model
            </label>
            <input
              id={`model-${site.site}`}
              name="model"
              type="text"
              list={`known-models-${site.site}`}
              className={styles.input}
              defaultValue={site.assignment ?? ''}
              disabled={assigning === site.site}
            />
            <datalist id={`known-models-${site.site}`}>
              {known.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
            <button type="submit" className={styles.submit} disabled={assigning === site.site}>
              assign
            </button>
          </form>
          {empty === site.site && (
            <p className={styles.error} role="alert">
              Name a model to assign. Clearing the field does not unassign this participant.
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}
