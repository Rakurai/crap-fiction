import type { FormEvent } from 'react'
import type { CallSiteAssignmentView } from '../server/model/callSites.js'
import styles from './CallSiteList.module.css'

type CallSiteListProps = {
  readonly sites: readonly CallSiteAssignmentView[]
  readonly assigning: string | undefined
  readonly onAssign: (site: string, model: string) => void
}

/** One form per site, so a site is assignable one at a time. */
export function CallSiteList({ sites, assigning, onAssign }: CallSiteListProps) {
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
              if (typeof model === 'string' && model.trim().length > 0) {
                onAssign(site.site, model.trim())
              }
            }}
          >
            <label className={styles.label} htmlFor={`model-${site.site}`}>
              Model
            </label>
            <input
              id={`model-${site.site}`}
              name="model"
              type="text"
              className={styles.input}
              defaultValue={site.assignment ?? ''}
              disabled={assigning === site.site}
            />
            <button type="submit" className={styles.submit} disabled={assigning === site.site}>
              Assign
            </button>
          </form>
        </li>
      ))}
    </ul>
  )
}
