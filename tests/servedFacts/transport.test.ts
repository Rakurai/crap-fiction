import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { RequestFailure, unwrapEnvelope } from '../../src/client/servedFacts/transport.js'

const workspaceSchema = z.object({ workspace: z.string().nullable() })

describe('unwrapping the response envelope a route answers with', () => {
  it('returns the payload carried by a successful envelope', () => {
    expect(unwrapEnvelope({ success: true, data: { workspace: null } }, workspaceSchema)).toEqual({ workspace: null })
  })

  it('raises a refused failure carrying the code and message a route declared', () => {
    const body = { success: false, error: { code: 'PIECE_NOT_FOUND', message: 'no such piece' } }

    expect(() => unwrapEnvelope(body, workspaceSchema)).toThrow(RequestFailure)
    try {
      unwrapEnvelope(body, workspaceSchema)
      expect.unreachable()
    } catch (failure) {
      expect(failure).toBeInstanceOf(RequestFailure)
      expect((failure as RequestFailure).message).toBe('no such piece')
      expect((failure as RequestFailure).reason).toEqual({ kind: 'refused', code: 'PIECE_NOT_FOUND' })
    }
  })

  it('raises an unreachable failure when the body is not envelope-shaped at all', () => {
    try {
      unwrapEnvelope({ nonsense: true }, workspaceSchema)
      expect.unreachable()
    } catch (failure) {
      expect(failure).toBeInstanceOf(RequestFailure)
      expect((failure as RequestFailure).reason).toEqual({ kind: 'unreachable' })
    }
  })

  it('raises an unreachable failure when the payload does not satisfy the caller-declared schema', () => {
    try {
      unwrapEnvelope({ success: true, data: { workspace: 42 } }, workspaceSchema)
      expect.unreachable()
    } catch (failure) {
      expect(failure).toBeInstanceOf(RequestFailure)
      expect((failure as RequestFailure).reason).toEqual({ kind: 'unreachable' })
    }
  })
})
