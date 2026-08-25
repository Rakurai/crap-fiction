import type { CastMemberView, StoryEditorView } from '../shared/pieceViews.js'
import { machineWords } from './facts.js'
import styles from './RoomEditor.module.css'
import { Scrim } from './Scrim.js'

type RoomEditorProps = {
  readonly members: readonly CastMemberView[]
  readonly storyEditor: StoryEditorView
  readonly toggling: string | undefined
  readonly onToggle: (id: string) => void
  readonly onClose: () => void
}

const ALWAYS_PRESENT = machineWords('always present')
const ABSENT = machineWords('absent')

export function RoomEditor({ members, storyEditor, toggling, onToggle, onClose }: RoomEditorProps) {
  return (
    <>
      <Scrim onDismiss={onClose} />
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label="The room">
        <div className={styles.header}>
          <span className={styles.title}>The room</span>
          <button type="button" className={styles.done} onClick={onClose}>
            done
          </button>
        </div>
        <ul className={styles.list}>
          {members.map((member) => (
            <li key={member.id} className={styles.item}>
              <div className={styles.identity}>
                <span className={styles.handle}>@{member.handle}</span>
                <span className={styles.name}>{member.displayName}</span>
                {/* Present is the panel's own premise, so only absence is stamped. */}
                {!member.enabled && <span className={styles.absent}>{ABSENT}</span>}
              </div>
              <button
                type="button"
                className={styles.toggle}
                disabled={toggling === member.id}
                onClick={() => onToggle(member.id)}
              >
                {member.enabled ? 'disable' : 'enable'}
              </button>
              <p className={styles.role}>{member.roleDescription}</p>
            </li>
          ))}
          {/* The room is the cast and the Story Editor. It is here because it is always here. */}
          <li className={styles.item}>
            <div className={styles.identity}>
              <span className={styles.handle}>@{storyEditor.handle}</span>
              <span className={styles.name}>{storyEditor.displayName}</span>
            </div>
            <span className={styles.always}>{ALWAYS_PRESENT}</span>
            <p className={styles.role}>{storyEditor.roleDescription}</p>
          </li>
        </ul>
      </div>
    </>
  )
}
