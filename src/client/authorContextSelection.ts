import { z } from 'zod'

const STORAGE_KEY = 'crap-fiction.authorContextConversationId'

const storedSchema = z.string().min(1).nullable()

export function readStoredAuthorContextConversationId(): string | null | undefined {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (raw === null) return undefined
  try {
    const parsed = storedSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : undefined
  } catch {
    return undefined
  }
}

export function writeStoredAuthorContextConversationId(conversationId: string | null): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(conversationId))
}
