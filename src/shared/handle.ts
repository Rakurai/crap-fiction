export const handlePattern = /^[a-z][a-z0-9]*$/

const HANDLE_CHARACTER = /^[a-zA-Z0-9]$/

export function isHandleCharacter(character: string | undefined): boolean {
  return character !== undefined && HANDLE_CHARACTER.test(character)
}

export function opensMention(preceding: string | undefined): boolean {
  return preceding === undefined || /\s/.test(preceding)
}
