import type { FormEvent } from 'react'
import type { CallSiteAssignmentView } from '../server/model/callSites.js'

type CallSiteListProps = {
  readonly sites: readonly CallSiteAssignmentView[]
  readonly assigning: string | undefined
  readonly onAssign: (site: string, model: string) => void
}

/** Deliberately bare markup (see WorkspacePrompt). One form per site, so a site is assignable one at a time. */
export function CallSiteList({ sites, assigning, onAssign }: CallSiteListProps) {
  return (
    <ul>
      {sites.map((site) => (
        <li key={site.site}>
          <strong>{site.displayName ?? site.site}</strong>
          {site.roleDescription !== undefined && <p>{site.roleDescription}</p>}
          <form
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault()
              const model = new FormData(event.currentTarget).get('model')
              if (typeof model === 'string' && model.trim().length > 0) {
                onAssign(site.site, model.trim())
              }
            }}
          >
            <label>
              Model
              <input name="model" type="text" defaultValue={site.assignment ?? ''} disabled={assigning === site.site} />
            </label>
            <button type="submit" disabled={assigning === site.site}>
              Assign
            </button>
          </form>
        </li>
      ))}
    </ul>
  )
}
