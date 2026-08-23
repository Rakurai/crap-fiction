import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WorkspaceOutsideRootError, WorkspaceRegistry } from '../../src/server/workspace.js'

describe('WorkspaceRegistry', () => {
  let dataRoot: string

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-data-root-'))
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  it('reports no workspace configured when nothing was ever set', () => {
    const registry = new WorkspaceRegistry(dataRoot)
    registry.load()
    expect(registry.get()).toBeUndefined()
  })

  it('refuses a directory outside the data root and leaves nothing set', async () => {
    const registry = new WorkspaceRegistry(dataRoot)
    registry.load()

    await expect(registry.set('/etc/passwd')).rejects.toThrow(WorkspaceOutsideRootError)
    expect(registry.get()).toBeUndefined()
  })

  it('accepts a directory inside the data root and never asks the file again', async () => {
    const registry = new WorkspaceRegistry(dataRoot)
    registry.load()

    const resolved = await registry.set('my-writing')
    expect(resolved).toBe(path.join(dataRoot, 'my-writing'))
    expect(registry.get()).toBe(resolved)

    const reloaded = new WorkspaceRegistry(dataRoot)
    reloaded.load()
    expect(reloaded.get()).toBe(resolved)
  })

  it('preserves a hand-written comment and an unknown key in settings.yaml across a set', async () => {
    const settingsPath = path.join(dataRoot, 'config', 'settings.yaml')
    mkdirSync(path.dirname(settingsPath), { recursive: true })
    writeFileSync(settingsPath, '# author notes\ninterfacePreferences:\n  theme: dark\n', 'utf8')

    const registry = new WorkspaceRegistry(dataRoot)
    registry.load()
    await registry.set('my-writing')

    const text = readFileSync(settingsPath, 'utf8')
    expect(text).toContain('# author notes')
    expect(text).toContain('theme: dark')
    expect(text).toContain(`workspace: ${path.join(dataRoot, 'my-writing')}`)
  })
})
