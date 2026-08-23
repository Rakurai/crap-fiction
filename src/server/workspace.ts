import path from 'node:path'
import { z } from 'zod'
import { PathEscapesRootError, resolveWithinRoot } from './paths.js'
import { readYamlArtifact, writeYamlArtifact } from './store.js'

export class WorkspaceOutsideRootError extends Error {
  constructor(dataRoot: string, candidate: string) {
    super(`workspace directory "${candidate}" is not inside the data root "${dataRoot}"`)
    this.name = 'WorkspaceOutsideRootError'
  }
}

const settingsSchema = z.object({
  workspace: z.string().min(1).optional(),
})

function settingsPath(dataRoot: string): string {
  return path.join(dataRoot, 'config', 'settings.yaml')
}

/**
 * SPEC "Files": the workspace path is process configuration, read once, not
 * re-read per request the way author-editable data is — this registry is
 * that one read, held for the life of the process and updated in memory the
 * moment the author sets it, so nothing after startup asks the file again.
 */
export class WorkspaceRegistry {
  readonly #dataRoot: string
  #workspace: string | undefined

  constructor(dataRoot: string) {
    this.#dataRoot = dataRoot
  }

  load(): void {
    const settings = readYamlArtifact(settingsPath(this.#dataRoot), settingsSchema)
    this.#workspace = settings?.workspace
  }

  get(): string | undefined {
    return this.#workspace
  }

  async set(candidate: string): Promise<string> {
    let resolved: string
    try {
      resolved = resolveWithinRoot(this.#dataRoot, candidate)
    } catch (err) {
      if (err instanceof PathEscapesRootError) {
        throw new WorkspaceOutsideRootError(this.#dataRoot, candidate)
      }
      throw err
    }

    await writeYamlArtifact(settingsPath(this.#dataRoot), (document) => {
      document.set('workspace', resolved)
    })
    this.#workspace = resolved
    return resolved
  }
}
