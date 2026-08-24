import { durableContextSchema, type DurableContext } from '../../shared/durableContext.js'
import { readAuthorContext, readStoryContext, writeAuthorContext } from '../store/index.js'

/**
 * The two durable contexts as a call's context wants them: text, since SPEC
 * "Model access" has the prompt crossing as text. Either is `undefined` when the
 * author has written nothing there, which is what keeps an empty heading out of
 * the prompt (`renderPrompt` omits a section with no body).
 */
export type CompiledDurableContext = Readonly<{
  authorContext: string | undefined
  storyContext: string | undefined
}>

/**
 * How a round reaches both durable contexts. A function rather than the room
 * holding the data root, because where either file lives is the store
 * boundary's and the data root is process configuration the composition root
 * already owns — the room asks for this piece's durable context and knows
 * neither path.
 */
export type ReadDurableContext = (workspaceDir: string, pieceId: string) => CompiledDurableContext

/**
 * One context rendered for a participant to read: each section the author named,
 * with its entries beneath it. A section holding nothing is omitted rather than
 * rendered as a bare name, and a context that has nothing left after that is
 * `undefined` — a model reads an empty section as something to remark on rather
 * than as nothing having been said.
 */
export function renderDurableContext(context: DurableContext | undefined): string | undefined {
  if (context === undefined) return undefined

  const sections = Object.entries(context)
    .filter(([, entries]) => entries.length > 0)
    .map(([name, entries]) => `${name}:\n${entries.map((entry) => `- ${entry}`).join('\n')}`)

  return sections.length === 0 ? undefined : sections.join('\n\n')
}

/**
 * Reads both durable contexts for one piece, bound to the data root the process
 * was given.
 *
 * SPEC "Files": piece metadata, both durable contexts and the model assignments
 * are read when a piece is opened and again when a model call is compiled —
 * nothing watches the filesystem and nothing polls, so a file the author edited
 * by hand is picked up by the next round that uses it. The read happens once per
 * round rather than once per participant, because a round compiles every
 * eligible participant's context before issuing its first call and they must all
 * be answering from the same standing instructions.
 */
export function durableContextReader(dataRoot: string): ReadDurableContext {
  return (workspaceDir, pieceId) => ({
    authorContext: renderDurableContext(readAuthorContext(dataRoot, durableContextSchema)),
    storyContext: renderDurableContext(readStoryContext(workspaceDir, pieceId, durableContextSchema)),
  })
}

/**
 * #18 "Capture context"'s review reads and writes the author context in its
 * raw, structured form — a proposal concerns one entry in one section, and a
 * rendered string has no addressable entries left to apply one against. Bound
 * to the data root the same way `durableContextReader` is and for the same
 * reason: the room never holds it, since where the author context lives is
 * process configuration the composition root already owns.
 *
 * The piece's own story context needs no equivalent binding — every room
 * method already receives `workspaceDir` as a call-time parameter, so a
 * caller reads and writes it through the store directly.
 */
export type AuthorContextStore = Readonly<{
  read: () => DurableContext
  write: (context: DurableContext) => Promise<void>
}>

export function authorContextStore(dataRoot: string): AuthorContextStore {
  return {
    read: () => readAuthorContext(dataRoot, durableContextSchema) ?? {},
    write: (context) => writeAuthorContext(dataRoot, context),
  }
}
