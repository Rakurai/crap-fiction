import { readAuthorContext, readStoryContext } from '../store/index.js'

export type CompiledDurableContext = Readonly<{
  authorContext: string | undefined
  storyContext: string | undefined
}>

export type ReadDurableContext = (workspaceDir: string, pieceId: string) => CompiledDurableContext

export function durableContextReader(dataRoot: string): ReadDurableContext {
  return (workspaceDir, pieceId) => ({
    authorContext: readAuthorContext(dataRoot),
    storyContext: readStoryContext(workspaceDir, pieceId),
  })
}
