import type { ConversationEntry } from '../shared/conversationEntries.js'
import { openingWords } from '../shared/conversationEntries.js'
import { machineWords } from './facts.js'

export const NO_AUTHOR_MESSAGE = machineWords('asked for a concrete change')
export const NOTHING_SAID_YET = machineWords('new conversation')

export function conversationName(entries: readonly ConversationEntry[]): string {
  return openingWords(entries) ?? (entries.length === 0 ? NOTHING_SAID_YET : NO_AUTHOR_MESSAGE)
}
