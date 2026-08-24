import { z } from 'zod'
import { PathEscapesRootError, readSettingsSection, resolveWorkspaceDirectory, writeSettingsSection } from './store/index.js'

export class WorkspaceOutsideRootError extends Error {
  constructor(dataRoot: string, candidate: string) {
    super(`workspace directory "${candidate}" is not inside the data root "${dataRoot}"`)
    this.name = 'WorkspaceOutsideRootError'
  }
}

export class WorkspaceNotSetError extends Error {
  constructor() {
    super('no workspace is configured')
    this.name = 'WorkspaceNotSetError'
  }
}

const workspacePathSchema = z.string().min(1)

export class WorkspaceRegistry {
  readonly #dataRoot: string
  #workspace: string | undefined

  static openAt(dataRoot: string): WorkspaceRegistry {
    return new WorkspaceRegistry(dataRoot, readSettingsSection(dataRoot, 'workspace', workspacePathSchema))
  }

  private constructor(dataRoot: string, workspace: string | undefined) {
    this.#dataRoot = dataRoot
    this.#workspace = workspace
  }

  get(): string | undefined {
    return this.#workspace
  }

  require(): string {
    if (this.#workspace === undefined) throw new WorkspaceNotSetError()
    return this.#workspace
  }

  async set(candidate: string): Promise<string> {
    let resolved: string
    try {
      resolved = resolveWorkspaceDirectory(this.#dataRoot, candidate)
    } catch (err) {
      if (err instanceof PathEscapesRootError) {
        throw new WorkspaceOutsideRootError(this.#dataRoot, candidate)
      }
      throw err
    }

    await writeSettingsSection(this.#dataRoot, 'workspace', resolved)
    this.#workspace = resolved
    return resolved
  }
}
