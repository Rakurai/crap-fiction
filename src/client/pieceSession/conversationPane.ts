import { createSubscribableValue } from './subscribableValue.js'

export type ConversationPaneState = Readonly<{
  conversationId: string | null
  composerText: string
  transcriptPosition: number
  disclosures: ReadonlySet<string>
}>

export type ConversationPane = Readonly<{
  getState: () => ConversationPaneState
  subscribe: (onChange: () => void) => () => void
  selectConversation: (conversationId: string | null) => void
  setComposerText: (composerText: string) => void
  setTranscriptPosition: (transcriptPosition: number) => void
  setDisclosures: (disclosures: ReadonlySet<string>) => void
}>

const EMPTY_DISCLOSURES: ReadonlySet<string> = new Set()

function freshPane(conversationId: string | null): ConversationPaneState {
  return { conversationId, composerText: '', transcriptPosition: 0, disclosures: EMPTY_DISCLOSURES }
}

export function createConversationPane(initialConversationId: string | null): ConversationPane {
  const value = createSubscribableValue(freshPane(initialConversationId))

  return {
    getState: value.get,
    subscribe: value.subscribe,
    selectConversation: (conversationId) => value.set(freshPane(conversationId)),
    setComposerText: (composerText) => value.set({ ...value.get(), composerText }),
    setTranscriptPosition: (transcriptPosition) => value.set({ ...value.get(), transcriptPosition }),
    setDisclosures: (disclosures) => value.set({ ...value.get(), disclosures }),
  }
}
