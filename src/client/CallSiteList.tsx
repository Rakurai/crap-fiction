import type { ChangeEvent } from 'react'
import type { CallSiteAssignmentView } from '../shared/callSiteViews.js'
import styles from './CallSiteList.module.css'
import { machineWords } from './facts.js'
import { Identity } from './Identity.js'

type CallSiteListProps = {
  readonly heading: string
  readonly what?: string
  readonly sites: readonly CallSiteAssignmentView[]
  readonly known: readonly string[]
  readonly assigning: string | undefined
  readonly saved: string | undefined
  readonly onAssign: (site: string, model: string) => void
}

function choices(known: readonly string[], assignment: string | null): readonly string[] {
  if (assignment === null || known.includes(assignment)) return known
  return [assignment, ...known]
}

export function CallSiteList({ heading, what, sites, known, assigning, saved, onAssign }: CallSiteListProps) {
  return (
    <section className={styles.group}>
      <div className={styles.groupHeader}>
        <h2 className={styles.heading}>{heading}</h2>
        {what !== undefined && <p className={styles.what}>{what}</p>}
        <span className={styles.column}>{machineWords('model')}</span>
      </div>
      <ul className={styles.list}>
        {sites.map((site) => {
          const models = choices(known, site.assignment)
          return (
            <li key={site.site} className={styles.item}>
              <div className={styles.identity}>
                <Identity mark={site.mark} ordinal={site.ordinal} displayName={site.displayName} handle={site.handle ?? undefined} />
                {saved === site.site && <span className={styles.saved}>{machineWords('saved')}</span>}
              </div>
              <p className={styles.role}>{site.description}</p>
              <select
                aria-label={`Model for ${site.displayName}`}
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
              {models.length === 0 && <p className={styles.note}>No models to choose from until the runtime is reachable.</p>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
