const HANDLE_CHAR = /[a-zA-Z0-9]/

export type MentionQuery = Readonly<{ sigilIndex: number; token: string }>

export function mentionQuery(value: string, caret: number): MentionQuery | undefined {
  let index = caret
  while (index > 0 && HANDLE_CHAR.test(value[index - 1] ?? '')) index--
  if (index === 0 || value[index - 1] !== '@') return undefined

  const sigilIndex = index - 1
  if (sigilIndex !== 0 && !/\s/.test(value[sigilIndex - 1] ?? '')) return undefined

  return { sigilIndex, token: value.slice(index, caret) }
}

export function completeMention(value: string, query: MentionQuery, handle: string): { value: string; caret: number } {
  const before = value.slice(0, query.sigilIndex)
  const after = value.slice(query.sigilIndex + 1 + query.token.length)
  const inserted = `@${handle} `
  return { value: before + inserted + after, caret: before.length + inserted.length }
}
