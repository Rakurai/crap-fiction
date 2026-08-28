import { useState } from 'react'

export type ApplyingHold = Readonly<{ participantName?: string; abandon: () => void }>

export type AuthorContextSelection = Readonly<{ value: string | null | undefined; onChange: (conversationId: string | null) => void }>

export function useConversationSession(initialConversationId: string | null, global?: AuthorContextSelection) {
  const [localConversationId, setLocalConversationId] = useState<string | null>(initialConversationId)
  const activeConversationId = global === undefined ? localConversationId : global.value === undefined ? initialConversationId : global.value
  const [session, setSession] = useState(0)
  const [applying, setApplying] = useState<ApplyingHold | undefined>(undefined)

  const setActiveConversationId = global === undefined ? setLocalConversationId : global.onChange

  function switchTo(conversationId: string | null): void {
    setActiveConversationId(conversationId)
    setSession((current) => current + 1)
  }

  return { activeConversationId, setActiveConversationId, session, switchTo, applying, setApplying }
}

export type ConversationSession = ReturnType<typeof useConversationSession>
