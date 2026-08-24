import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getTheme, setTheme } from '../../src/server/interfaceTheme.js'

describe('interface theme', () => {
  let dataRoot: string

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-data-root-'))
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  it('reports no theme chosen when settings.yaml carries no theme key', () => {
    expect(getTheme(dataRoot)).toBeUndefined()
  })

  it('persists a chosen theme and reads it back', async () => {
    await setTheme(dataRoot, 'dark')
    expect(getTheme(dataRoot)).toBe('dark')
  })

  it('writes only the interface preferences section, leaving the workspace key untouched', async () => {
    const settingsPath = path.join(dataRoot, 'config', 'settings.yaml')
    mkdirSync(path.dirname(settingsPath), { recursive: true })
    writeFileSync(settingsPath, 'workspace: my-writing\n', 'utf8')

    await setTheme(dataRoot, 'light')

    const text = readFileSync(settingsPath, 'utf8')
    expect(text).toContain('workspace: my-writing')
    expect(text).toContain('theme: light')
  })
})
