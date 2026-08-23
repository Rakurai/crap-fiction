import { mkdtempSync, rmSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  mostRecentConversationId,
  readConversation,
  readPiece,
  writeConversation,
  writePieceCast,
  writePieceMetadata,
} from '../../../src/server/store/index.js'

const conversationSchema = z.object({ id: z.string(), rounds: z.array(z.object({ id: z.string() })) })

describe('conversations', () => {
  let workspaceDir: string

  beforeEach(async () => {
    workspaceDir = mkdtempSync(path.join(tmpdir(), 'studio-workspace-'))
    await writePieceMetadata(workspaceDir, 'cups', { title: 'Cups', mode: 'flash', status: 'drafting', cast: ['shape'] })
  })

  afterEach(() => {
    rmSync(workspaceDir, { recursive: true, force: true })
  })

  it('reports a conversation nothing has written yet as a declared absence', () => {
    expect(readConversation(workspaceDir, 'cups', 'c1', conversationSchema)).toBeUndefined()
  })

  it('writes a conversation and reads it back', async () => {
    await writeConversation(workspaceDir, 'cups', 'c1', { id: 'c1', rounds: [{ id: 'r1' }] })
    expect(readConversation(workspaceDir, 'cups', 'c1', conversationSchema)).toEqual({ id: 'c1', rounds: [{ id: 'r1' }] })
  })

  it('reports no most-recent conversation when none has ever been written', () => {
    expect(mostRecentConversationId(workspaceDir, 'cups')).toBeUndefined()
  })

  it('reports the most recently written conversation as the most recent one', async () => {
    await writeConversation(workspaceDir, 'cups', 'older', { id: 'older', rounds: [] })
    const past = new Date(Date.now() - 10_000)
    utimesSync(path.join(workspaceDir, 'cups', 'conversations', 'older.json'), past, past)

    await writeConversation(workspaceDir, 'cups', 'newer', { id: 'newer', rounds: [] })

    expect(mostRecentConversationId(workspaceDir, 'cups')).toBe('newer')
  })
})

describe('writePieceCast', () => {
  let workspaceDir: string

  beforeEach(async () => {
    workspaceDir = mkdtempSync(path.join(tmpdir(), 'studio-workspace-'))
    await writePieceMetadata(workspaceDir, 'cups', { title: 'Cups', mode: 'flash', status: 'drafting', cast: ['shape'] })
  })

  afterEach(() => {
    rmSync(workspaceDir, { recursive: true, force: true })
  })

  it('sets only the cast, leaving title, mode and status untouched', async () => {
    await writePieceCast(workspaceDir, 'cups', ['shape', 'compression'])

    const metadata = readPiece(workspaceDir, 'cups')?.metadata
    expect(metadata).toEqual({ title: 'Cups', mode: 'flash', status: 'drafting', cast: ['shape', 'compression'] })
  })
})
