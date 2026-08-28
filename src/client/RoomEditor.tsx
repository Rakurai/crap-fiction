import type { RosterMemberView, StoryEditorView } from '../shared/pieceViews.js'
import { machineWords } from './facts.js'
import { Identity } from './Identity.js'
import { PanelHeader } from './PanelHeader.js'
import styles from './RoomEditor.module.css'
import { Scrim } from './Scrim.js'

type RoomEditorProps = {
  readonly members: readonly RosterMemberView[]
  readonly storyEditor: StoryEditorView
  readonly toggling: string | undefined
  readonly onToggle: (id: string) => void
  readonly onClose: () => void
}

const ALWAYS_PRESENT = machineWords('always present')

export function RoomEditor({ members, storyEditor, toggling, onToggle, onClose }: RoomEditorProps) {
  return (
    <>
      <Scrim onDismiss={onClose} />
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label="The room">
        <PanelHeader title="The room" tone="panel" onDismiss={onClose} />
        <ul className={styles.list}>
          {members.map((member) => (
            <li key={member.id} className={styles.item}>
              <Identity mark={member.mark} ordinal={member.ordinal} displayName={member.displayName} handle={member.handle} />
              <button
                type="button"
                className={member.enabled ? `${styles.toggle} ${styles.present}` : styles.toggle}
                disabled={toggling === member.id}
                onClick={() => onToggle(member.id)}
              >
                {member.enabled ? 'disable' : 'enable'}
              </button>
              <p className={styles.role}>{member.description}</p>
            </li>
          ))}
          <li className={styles.item}>
            <Identity mark={storyEditor.mark} ordinal={null} displayName={storyEditor.displayName} handle={storyEditor.handle} />
            <span className={styles.always}>{ALWAYS_PRESENT}</span>
            <p className={styles.role}>{storyEditor.description}</p>
          </li>
        </ul>
      </div>
    </>
  )
}
