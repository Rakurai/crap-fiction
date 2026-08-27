import { z } from 'zod'
import { PathEscapesRootError, readSettingsSection, resolveWorkspaceDirectory, settingsFile, writeSettingsSection } from './store/index.js'

export class WorkspaceOutsideRootError extends Error {
  constructor(dataRoot: string, candidate: string) {
    super(`workspace directory "${candidate}" is not inside the data root "${dataRoot}"`)
    this.name = 'WorkspaceOutsideRootError'
  }
}

export class PersistedWorkspaceUnusableError extends Error {
  constructor(file: string, candidate: string, reason: string) {
    super(`${file}: workspace "${candidate}" ${reason}`)
    this.name = 'PersistedWorkspaceUnusableError'
  }
}

export class WorkspaceNotSetError extends Error {
  constructor() {
    super('no workspace is configured')
    this.name = 'WorkspaceNotSetError'
  }
}

const workspacePathSchema = z.string().min(1)

function containedWorkspace(dataRoot: string, candidate: string): string {
  try {
    return resolveWorkspaceDirectory(dataRoot, candidate)
  } catch (err) {
    if (err instanceof PathEscapesRootError) {
      throw new WorkspaceOutsideRootError(dataRoot, candidate)
    }
    throw err
  }
}

export class WorkspaceRegistry {
  readonly #dataRoot: string
  #workspace: string | undefined

  static openAt(dataRoot: string): WorkspaceRegistry {
    const persisted = readSettingsSection(dataRoot, 'workspace', workspacePathSchema)
    if (persisted === undefined) return new WorkspaceRegistry(dataRoot, undefined)

    try {
      return new WorkspaceRegistry(dataRoot, containedWorkspace(dataRoot, persisted))
    } catch (err) {
      if (err instanceof WorkspaceOutsideRootError) {
        throw new PersistedWorkspaceUnusableError(settingsFile(dataRoot), persisted, `is not inside the data root "${dataRoot}"`)
      }
      throw err
    }
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
    const resolved = containedWorkspace(this.#dataRoot, candidate)

    await writeSettingsSection(this.#dataRoot, 'workspace', resolved)
    this.#workspace = resolved
    return resolved
  }
}
