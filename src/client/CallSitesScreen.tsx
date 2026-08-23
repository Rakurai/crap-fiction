import { CallSiteList } from './CallSiteList.js'
import { RuntimeStatusBanner } from './RuntimeStatusBanner.js'
import { useCallSites } from './useCallSites.js'

type CallSitesScreenProps = {
  readonly onClose: () => void
}

/** PRD "Assign models to participants": the place the author goes, one action away from the piece list. */
export function CallSitesScreen({ onClose }: CallSitesScreenProps) {
  const view = useCallSites()

  return (
    <div>
      <button type="button" onClick={onClose}>
        ‹ pieces
      </button>
      {view.status === 'ready' && (
        <>
          <RuntimeStatusBanner runtime={view.runtime} />
          {view.assignError !== undefined && <p role="alert">{view.assignError}</p>}
          <CallSiteList sites={view.sites} assigning={view.assigning} onAssign={view.assign} />
        </>
      )}
    </div>
  )
}
