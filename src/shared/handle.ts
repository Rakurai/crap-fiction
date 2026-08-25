/**
 * The `@handle` grammar, declared once. Three places read it — the shipped roles schema, the
 * server's addressing of a message, and the client's completion of one as the author types —
 * and they must agree, or a handle the studio accepts is one the author cannot finish typing.
 * Widening what a handle may hold means widening it here, for all three at once.
 */

/** What a shipped handle may be: one lowercase token, distinct from the display name. */
export const handlePattern = /^[a-z][a-z0-9]*$/

const HANDLE_CHARACTER = /^[a-zA-Z0-9]$/

/**
 * Whether a character belongs to the handle being typed or read. Case-insensitive, because the
 * author types in whatever case they like and addressing folds it.
 */
export function isHandleCharacter(character: string | undefined): boolean {
  return character !== undefined && HANDLE_CHARACTER.test(character)
}

/**
 * Whether a sigil preceded by this character opens a mention at all. `undefined` is the start
 * of the text, which does; a letter does not, so an email address is not a mention.
 */
export function opensMention(preceding: string | undefined): boolean {
  return preceding === undefined || /\s/.test(preceding)
}
