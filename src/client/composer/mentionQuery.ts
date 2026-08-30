import { isHandleCharacter, opensMention } from '../../shared/handle.js'

export type MentionQuery = Readonly<{ at: number; token: string }>

export function detectMentionQuery(text: string, caret: number): MentionQuery | undefined {
  let index = caret - 1
  while (index >= 0 && isHandleCharacter(text[index])) index--
  if (text[index] !== '@') return undefined
  if (!opensMention(text[index - 1])) return undefined
  return { at: index, token: text.slice(index + 1, caret) }
}

export function matchingHandles<T extends { handle: string }>(token: string, candidates: readonly T[]): readonly T[] {
  const lowered = token.toLowerCase()
  return candidates.filter((candidate) => candidate.handle.startsWith(lowered))
}

export type MentionInsertion = Readonly<{ text: string; caret: number }>

export function insertMention(text: string, query: MentionQuery, handle: string): MentionInsertion {
  const before = text.slice(0, query.at)
  const after = text.slice(query.at + 1 + query.token.length)
  const inserted = `@${handle} `
  return { text: `${before}${inserted}${after}`, caret: before.length + inserted.length }
}
