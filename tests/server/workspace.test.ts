import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WorkspaceNotSetError, WorkspaceOutsideRootError, WorkspaceRegistry } from '../../src/server/workspace.js'

describe('WorkspaceRegistry', () => {
  let dataRoot: string

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-data-root-'))
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  it('reports no workspace configured when nothing was ever set', () => {
    const registry = WorkspaceRegistry.openAt(dataRoot)
    expect(registry.get()).toBeUndefined()
  })

  it('raises a declared failure from require() when nothing was ever set', () => {
    const registry = WorkspaceRegistry.openAt(dataRoot)
    expect(() => registry.require()).toThrowError(WorkspaceNotSetError)
  })

  it('returns the resolved workspace from require() once one is set', async () => {
    const registry = WorkspaceRegistry.openAt(dataRoot)
    const resolved = await registry.set('my-writing')
    expect(registry.require()).toBe(resolved)
  })

  it('refuses a directory outside the data root and leaves nothing set', async () => {
    const registry = WorkspaceRegistry.openAt(dataRoot)

    await expect(registry.set('/etc/passwd')).rejects.toThrow(WorkspaceOutsideRootError)
    expect(registry.get()).toBeUndefined()
  })

  it('accepts a directory inside the data root and never asks the file again', async () => {
    const registry = WorkspaceRegistry.openAt(dataRoot)

    const resolved = await registry.set('my-writing')
    expect(resolved).toBe(path.join(dataRoot, 'my-writing'))
    expect(registry.get()).toBe(resolved)

    const reloaded = WorkspaceRegistry.openAt(dataRoot)
    expect(reloaded.get()).toBe(resolved)
  })

  it('writes only the workspace section, leaving the interface theme untouched', async () => {
    const settingsPath = path.join(dataRoot, 'config', 'settings.yaml')
    mkdirSync(path.dirname(settingsPath), { recursive: true })
    writeFileSync(settingsPath, 'interfacePreferences:\n  theme: dark\n', 'utf8')

    const registry = WorkspaceRegistry.openAt(dataRoot)
    await registry.set('my-writing')

    const text = readFileSync(settingsPath, 'utf8')
    expect(text).toContain('theme: dark')
    expect(text).toContain(`workspace: ${path.join(dataRoot, 'my-writing')}`)
  })
})
