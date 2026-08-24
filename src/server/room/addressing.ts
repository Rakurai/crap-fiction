import type { RoleDefinition } from '../model/roles.js'

const HANDLE_CHAR = /[a-zA-Z0-9]/

export function parseAddressing(message: string, participants: readonly RoleDefinition[]): readonly RoleDefinition[] {
  const addressed: RoleDefinition[] = []
  const seen = new Set<string>()

  for (let index = 0; index < message.length; index++) {
    if (message[index] !== '@') continue
    if (index !== 0 && !/\s/.test(message[index - 1] ?? '')) continue

    let end = index + 1
    while (end < message.length && HANDLE_CHAR.test(message[end] ?? '')) end++
    const token = message.slice(index + 1, end).toLowerCase()
    if (token.length === 0) continue

    const matches = participants.filter((participant) => participant.handle.startsWith(token))
    if (matches.length !== 1) continue

    const [match] = matches
    if (match === undefined || seen.has(match.id)) continue
    seen.add(match.id)
    addressed.push(match)
  }

  return addressed
}
