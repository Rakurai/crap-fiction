const STORAGE_KEY = 'crap-fiction.disclosedApplications'

function readDisclosed(): ReadonlySet<string> {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  return new Set(raw === null ? [] : (JSON.parse(raw) as readonly string[]))
}

/**
 * Whether an applied change's before-and-after is disclosed, surviving a reload: an application
 * id is unique for life, so a stale "open" entry from an earlier applied change never resurfaces.
 */
export function isChangeDisclosed(applicationId: string): boolean {
  return readDisclosed().has(applicationId)
}

export function setChangeDisclosed(applicationId: string, disclosed: boolean): void {
  const ids = new Set(readDisclosed())
  if (disclosed) ids.add(applicationId)
  else ids.delete(applicationId)
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
}
