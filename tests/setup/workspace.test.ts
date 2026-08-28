import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SettingsStore } from '../../src/server/store/index.js'
import {
  PersistedWorkspaceUnusableError,
  WorkspaceNotSetError,
  WorkspaceOutsideRootError,
  WorkspaceRegistry,
} from '../../src/server/workspace.js'

describe('WorkspaceRegistry', () => {
  let dataRoot: string
  const settings = new SettingsStore()

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-data-root-'))
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  it('reports nothing configured as an absence to a reader and a stated failure to a caller that needs one', () => {
    const registry = WorkspaceRegistry.openAt(dataRoot, settings)

    expect(registry.get()).toBeUndefined()
    expect(() => registry.require()).toThrowError(WorkspaceNotSetError)
  })

  it('resolves a directory inside the data root, and a studio opened later reads it back without being told', async () => {
    const registry = WorkspaceRegistry.openAt(dataRoot, settings)

    const resolved = await registry.set('my-writing')

    expect(resolved).toBe(path.join(dataRoot, 'my-writing'))
    expect(registry.require()).toBe(resolved)
    expect(WorkspaceRegistry.openAt(dataRoot, settings).get()).toBe(resolved)
  })

  it('refuses a directory outside the data root and leaves nothing set', async () => {
    const registry = WorkspaceRegistry.openAt(dataRoot, settings)

    await expect(registry.set('/etc/passwd')).rejects.toThrow(WorkspaceOutsideRootError)
    expect(registry.get()).toBeUndefined()
  })

  it('refuses to open on a persisted value outside the data root, naming the file and the value', async () => {
    const settingsFile = path.join(dataRoot, 'config', 'settings.yaml')
    mkdirSync(path.dirname(settingsFile), { recursive: true })
    writeFileSync(settingsFile, 'workspace: /\n', 'utf8')

    expect(() => WorkspaceRegistry.openAt(dataRoot, settings)).toThrowError(PersistedWorkspaceUnusableError)
    expect(() => WorkspaceRegistry.openAt(dataRoot, settings)).toThrowError(new RegExp(`${settingsFile}.*"/"`))
    expect(readFileSync(settingsFile, 'utf8')).toBe('workspace: /\n')
  })
})
