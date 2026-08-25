import type { ChangeEvent } from 'react'
import type { CallSiteAssignmentView } from '../shared/callSiteViews.js'
import styles from './CallSiteList.module.css'

type CallSiteListProps = {
  readonly sites: readonly CallSiteAssignmentView[]
  readonly known: readonly string[]
  readonly assigning: string | undefined
  readonly onAssign: (site: string, model: string) => void
}

function choices(known: readonly string[], assignment: string | null): readonly string[] {
  if (assignment === null || known.includes(assignment)) return known
  return [assignment, ...known]
}

export function CallSiteList({ sites, known, assigning, onAssign }: CallSiteListProps) {
  return (
    <ul className={styles.list}>
      {sites.map((site) => {
        const models = choices(known, site.assignment)
        return (
          <li key={site.site} className={styles.item}>
            <div className={styles.name}>{site.displayName ?? site.site}</div>
            {site.roleDescription !== null && <p className={styles.role}>{site.roleDescription}</p>}
            <div className={styles.form}>
              <label className={styles.label} htmlFor={`model-${site.site}`}>
                model
              </label>
              <select
                id={`model-${site.site}`}
                name="model"
                className={styles.input}
                value={site.assignment ?? ''}
                disabled={assigning === site.site || models.length === 0}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                  const model = event.currentTarget.value
                  if (model.length === 0 || model === site.assignment) return
                  onAssign(site.site, model)
                }}
              >
                {site.assignment === null && <option value="">unassigned</option>}
                {models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
            {models.length === 0 && <p className={styles.note}>No models to choose from until the runtime is reachable.</p>}
          </li>
        )
      })}
    </ul>
  )
}
