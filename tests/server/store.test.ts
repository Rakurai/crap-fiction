import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { readYamlArtifact, TolerantReadError, writeYamlArtifact } from '../../src/server/store.js'

describe('readYamlArtifact / writeYamlArtifact', () => {
  let dir: string
  let file: string

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'studio-store-'))
    file = path.join(dir, 'nested', 'artifact.yaml')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('reports a missing file as a declared absence, not a failure', () => {
    const schema = z.object({ title: z.string().optional() })
    expect(readYamlArtifact(file, schema)).toBeUndefined()
  })

  it('writes atomically to a nested path that does not yet exist, then reads it back', async () => {
    const schema = z.object({ title: z.string() })
    await writeYamlArtifact(file, (document) => document.set('title', 'Cups'))
    expect(readYamlArtifact(file, schema)).toEqual({ title: 'Cups' })
  })

  it('keeps comments, key order and unknown keys through a write', async () => {
    await writeYamlArtifact(file, (document) => document.set('placeholder', 'x'))
    writeFileSync(file, '# a note the author left\nworkspace: old-path\nunknown-to-schema: kept\n', 'utf8')

    await writeYamlArtifact(file, (document) => document.set('workspace', 'new-path'))

    const text = readFileSync(file, 'utf8')
    expect(text).toContain('# a note the author left')
    expect(text).toContain('unknown-to-schema: kept')
    expect(text).toContain('workspace: new-path')
    expect(text.indexOf('workspace:')).toBeLessThan(text.indexOf('unknown-to-schema:'))
  })

  it('reads a scalar where a list is expected as a one-item list', async () => {
    const schema = z.object({ tags: z.array(z.string()) })
    await writeYamlArtifact(file, (document) => document.set('tags', 'solo'))
    expect(readYamlArtifact(file, schema)).toEqual({ tags: ['solo'] })
  })

  it('reads an absent optional list as empty rather than as absent', async () => {
    const schema = z.object({ tags: z.array(z.string()).optional() })
    await writeYamlArtifact(file, (document) => document.set('other', 1))
    expect(readYamlArtifact(file, schema)).toEqual({ tags: [] })
  })

  it('reads an absent optional section as an empty object', async () => {
    const schema = z.object({ preferences: z.object({ theme: z.string().optional() }).optional() })
    await writeYamlArtifact(file, (document) => document.set('other', 1))
    expect(readYamlArtifact(file, schema)).toEqual({ preferences: {} })
  })

  it('trims surrounding whitespace from a string value', async () => {
    const schema = z.object({ title: z.string() })
    await writeYamlArtifact(file, (document) => document.set('title', '  Cups  '))
    expect(readYamlArtifact(file, schema)).toEqual({ title: 'Cups' })
  })

  it('supplies no value for an absent optional scalar, unlike an absent section', async () => {
    const schema = z.object({ title: z.string().optional() })
    await writeYamlArtifact(file, (document) => document.set('other', 1))
    expect(readYamlArtifact(file, schema)?.title).toBeUndefined()
  })

  it('states a failure naming the entry when a required entry is missing', async () => {
    const schema = z.object({ title: z.string() })
    await writeYamlArtifact(file, (document) => document.set('other', 1))
    expect(() => readYamlArtifact(file, schema)).toThrowError(/title/)
  })

  it('states a failure naming the entry when a value is the wrong kind', async () => {
    const schema = z.object({ title: z.string() })
    await writeYamlArtifact(file, (document) => document.set('title', 42))
    expect(() => readYamlArtifact(file, schema)).toThrowError(/title/)
  })

  it('states a failure, rather than throwing an unrelated error, when the YAML does not parse', async () => {
    await writeYamlArtifact(file, (document) => document.set('title', 'Cups'))
    writeFileSync(file, ':\n  - this is not: [valid\n', 'utf8')

    const schema = z.object({ title: z.string() })
    expect(() => readYamlArtifact(file, schema)).toThrowError(TolerantReadError)
  })
})
