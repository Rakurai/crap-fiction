import type { CastMemberView } from '../shared/pieceViews.js'
import styles from './RoomEditor.module.css'

type RoomEditorProps = {
  readonly members: readonly CastMemberView[]
  readonly toggling: string | undefined
  readonly onToggle: (id: string) => void
  readonly onClose: () => void
}

export function RoomEditor({ members, toggling, onToggle, onClose }: RoomEditorProps) {
  return (
    <div className={styles.panel} role="dialog" aria-label="The room">
      <div className={styles.header}>
        <span className={styles.title}>The room</span>
        <button type="button" className={styles.done} onClick={onClose}>
          done
        </button>
      </div>
      <ul className={styles.list}>
        {members.map((member) => (
          <li key={member.id} className={styles.item}>
            <div className={styles.name}>{member.displayName}</div>
            <p className={styles.role}>{member.roleDescription}</p>
            <button
              type="button"
              className={styles.toggle}
              aria-pressed={member.enabled}
              disabled={toggling === member.id}
              onClick={() => onToggle(member.id)}
            >
              {member.enabled ? 'enabled' : 'disabled'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
