/**
 * SPEC "The room": a sigil counts where it begins the message or follows
 * whitespace, and the letters after it are what the room prefix-matches
 * against a handle. The composer reads the same rule to know when the caret
 * sits inside a token worth completing — never to decide who a message
 * addresses, which stays the room's own reading of the words the author sent.
 */
const HANDLE_CHAR = /[a-zA-Z0-9]/

export type MentionQuery = Readonly<{ sigilIndex: number; token: string }>

/**
 * The live `@token` the caret sits inside, or `undefined` where there is
 * none: a space between the sigil and the caret, a sigil that does not begin
 * the message or follow whitespace, or no sigil at all within reach.
 */
export function mentionQuery(value: string, caret: number): MentionQuery | undefined {
  let index = caret
  while (index > 0 && HANDLE_CHAR.test(value[index - 1] ?? '')) index--
  if (index === 0 || value[index - 1] !== '@') return undefined

  const sigilIndex = index - 1
  if (sigilIndex !== 0 && !/\s/.test(value[sigilIndex - 1] ?? '')) return undefined

  return { sigilIndex, token: value.slice(index, caret) }
}

/** `value` with `query`'s token replaced by `handle`, and the caret just past the space that follows it. */
export function completeMention(value: string, query: MentionQuery, handle: string): { value: string; caret: number } {
  const before = value.slice(0, query.sigilIndex)
  const after = value.slice(query.sigilIndex + 1 + query.token.length)
  const inserted = `@${handle} `
  return { value: before + inserted + after, caret: before.length + inserted.length }
}
