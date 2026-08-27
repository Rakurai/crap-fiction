import { z } from 'zod'

const STORAGE_KEY = 'crap-fiction.disclosedApplications'

const disclosedSchema = z.array(z.string().min(1)).readonly()

function readDisclosed(): ReadonlySet<string> {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (raw === null) return new Set()
  try {
    const parsed = disclosedSchema.safeParse(JSON.parse(raw))
    return parsed.success ? new Set(parsed.data) : new Set()
  } catch {
    return new Set()
  }
}

export function isChangeDisclosed(applicationId: string): boolean {
  return readDisclosed().has(applicationId)
}

export function setChangeDisclosed(applicationId: string, disclosed: boolean): void {
  const ids = new Set(readDisclosed())
  if (disclosed) ids.add(applicationId)
  else ids.delete(applicationId)
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
}
