import { useState } from 'react'

/** The author context's conversation selection: global client state, so a piece switch never resets it. */
export type AuthorContextSelection = Readonly<{ value: string | null | undefined; onChange: (conversationId: string | null) => void }>

export type LiveAction = Readonly<{ conversationId: string; actionId: string }>

/**
 * One editing surface's own conversation-session state: which conversation it shows, a key that
 * forces a fresh session without depending on a conversation id `Conversation` itself may still be
 * minting, the operation it has in flight, and the participant its manuscript is held for.
 *
 * `global`, when given, holds the selection outside this component tree instead — author context's
 * selection outlives the piece that is open, so a piece switch cannot reset it the way remounting
 * this hook's own state would. `setActiveConversationId` is handed to a descendant as an effect
 * dependency (`Conversation`'s own projection of it), so it must keep one stable identity per
 * target rather than a fresh closure every render — either the `useState` setter itself, or
 * `global.onChange`, both of which React and the caller already keep stable.
 */
export function useConversationSession(initialConversationId: string | null, global?: AuthorContextSelection) {
  const [localConversationId, setLocalConversationId] = useState<string | null>(initialConversationId)
  const activeConversationId = global === undefined ? localConversationId : global.value === undefined ? initialConversationId : global.value
  const [session, setSession] = useState(0)
  const [liveAction, setLiveAction] = useState<LiveAction | undefined>(undefined)
  const [applying, setApplying] = useState<Readonly<{ participantName: string }> | undefined>(undefined)

  const setActiveConversationId = global === undefined ? setLocalConversationId : global.onChange

  function switchTo(conversationId: string | null): void {
    setActiveConversationId(conversationId)
    setSession((current) => current + 1)
  }

  return { activeConversationId, setActiveConversationId, session, switchTo, liveAction, setLiveAction, applying, setApplying }
}

export type ConversationSession = ReturnType<typeof useConversationSession>
