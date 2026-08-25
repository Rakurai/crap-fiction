import { durableContextSchema, type DurableContext } from '../../shared/durableContext.js'
import { readAuthorContext, readStoryContext } from '../store/index.js'

export type CompiledDurableContext = Readonly<{
  authorContext: string | undefined
  storyContext: string | undefined
}>

export type ReadDurableContext = (workspaceDir: string, pieceId: string) => CompiledDurableContext

export function renderDurableContext(context: DurableContext | undefined): string | undefined {
  if (context === undefined) return undefined

  const sections = Object.entries(context)
    .filter(([, entries]) => entries.length > 0)
    .map(([name, entries]) => `${name}:\n${entries.map((entry) => `- ${entry}`).join('\n')}`)

  return sections.length === 0 ? undefined : sections.join('\n\n')
}

export function durableContextReader(dataRoot: string): ReadDurableContext {
  return (workspaceDir, pieceId) => ({
    authorContext: renderDurableContext(readAuthorContext(dataRoot, durableContextSchema)),
    storyContext: renderDurableContext(readStoryContext(workspaceDir, pieceId, durableContextSchema)),
  })
}
