import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildTestApp } from '../../support/harness.js'
import { writeAppliedChange, writeConversation } from '../../../src/server/store/index.js'

describe('/pieces', () => {
  let dataRoot: string

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-data-root-'))
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  async function withWorkspace() {
    const { app, workspace } = buildTestApp(dataRoot)
    await workspace.set('my-writing')
    return app
  }

  it('refuses to list pieces with no workspace configured', async () => {
    const { app } = buildTestApp(dataRoot)
    const res = await app.request('/pieces')
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ success: false, error: { code: 'WORKSPACE_NOT_SET' } })
  })

  it('creates a piece from a title alone and lists it afterwards', async () => {
    const app = await withWorkspace()

    const postRes = await app.request('/pieces', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'The Cups' }),
    })
    expect(postRes.status).toBe(200)
    const postBody = await postRes.json()
    expect(postBody).toMatchObject({ success: true, data: { id: 'the-cups', title: 'The Cups', mode: 'flash', status: 'drafting' } })

    const listRes = await app.request('/pieces')
    const listBody = await listRes.json()
    expect(listBody).toMatchObject({ success: true, data: [{ id: 'the-cups', title: 'The Cups' }] })
  })

  it('refuses a piece with no title', async () => {
    const app = await withWorkspace()
    const res = await app.request('/pieces', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ success: false, error: { code: 'INVALID_REQUEST' } })
  })

  it('opens a created piece by id', async () => {
    const app = await withWorkspace()
    await app.request('/pieces', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Cups' }),
    })

    const res = await app.request('/pieces/cups')
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, data: { id: 'cups', title: 'Cups' } })
  })

  it('reports a piece that does not exist as PIECE_NOT_FOUND', async () => {
    const app = await withWorkspace()
    const res = await app.request('/pieces/nothing-here')
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ success: false, error: { code: 'PIECE_NOT_FOUND' } })
  })

  it('reports a hand-corrupted piece.yaml as a stated ARTIFACT_INVALID failure, in the envelope', async () => {
    const { app, workspace } = buildTestApp(dataRoot)
    const dir = await workspace.set('my-writing')
    mkdirSync(path.join(dir, 'broken'), { recursive: true })
    writeFileSync(path.join(dir, 'broken', 'piece.yaml'), 'title: Broken\nmode: flash\nstatus: not-a-status\n', 'utf8')

    const res = await app.request('/pieces/broken')
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ success: false, error: { code: 'ARTIFACT_INVALID' } })
  })

  it('saves a draft as Markdown and reports it back on the next open', async () => {
    const { app, workspace } = buildTestApp(dataRoot)
    const dir = await workspace.set('my-writing')
    mkdirSync(path.join(dir, 'cups'), { recursive: true })
    writeFileSync(
      path.join(dir, 'cups', 'piece.yaml'),
      'title: Cups\nmode: flash\nstatus: drafting\ncast:\n  - shape\n',
      'utf8',
    )

    const putRes = await app.request('/pieces/cups/draft', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ draft: 'Two small words.' }),
    })
    expect(putRes.status).toBe(200)
    expect(await putRes.json()).toEqual({ success: true, data: null })

    const getRes = await app.request('/pieces/cups')
    expect(await getRes.json()).toMatchObject({ success: true, data: { draft: 'Two small words.' } })
  })

  it('reports saving a draft for a piece that does not exist as PIECE_NOT_FOUND', async () => {
    const app = await withWorkspace()
    const res = await app.request('/pieces/nothing-here/draft', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ draft: 'text' }),
    })
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ success: false, error: { code: 'PIECE_NOT_FOUND' } })
  })

  it('refuses to save a draft with no workspace configured', async () => {
    const { app } = buildTestApp(dataRoot)
    const res = await app.request('/pieces/cups/draft', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ draft: 'text' }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ success: false, error: { code: 'WORKSPACE_NOT_SET' } })
  })

  it('opens a piece listing its specialists with their role descriptions, all enabled by default', async () => {
    const app = await withWorkspace()
    await app.request('/pieces', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Cups' }),
    })

    const res = await app.request('/pieces/cups')
    const body = await res.json()
    expect(body).toMatchObject({
      success: true,
      data: { cast: [{ id: 'shape', displayName: 'Shape', roleDescription: 'x', enabled: true }] },
    })
  })

  it('disables a specialist, and the next open reports it disabled', async () => {
    const app = await withWorkspace()
    await app.request('/pieces', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Cups' }),
    })

    const patchRes = await app.request('/pieces/cups', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cast: [] }),
    })
    expect(patchRes.status).toBe(200)
    expect(await patchRes.json()).toMatchObject({
      success: true,
      data: { cast: [{ id: 'shape', enabled: false }] },
    })

    const getRes = await app.request('/pieces/cups')
    expect(await getRes.json()).toMatchObject({ success: true, data: { cast: [{ id: 'shape', enabled: false }] } })
  })

  it('retitles a piece without renaming its directory', async () => {
    const app = await withWorkspace()
    await app.request('/pieces', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Cups' }),
    })

    const patchRes = await app.request('/pieces/cups', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'The Cups' }),
    })
    expect(patchRes.status).toBe(200)
    expect(await patchRes.json()).toMatchObject({ success: true, data: { id: 'cups', title: 'The Cups' } })

    const getRes = await app.request('/pieces/cups')
    expect(await getRes.json()).toMatchObject({ success: true, data: { id: 'cups', title: 'The Cups' } })
  })

  it('marks a piece finished, and nothing gates opening or writing its draft afterwards', async () => {
    const app = await withWorkspace()
    await app.request('/pieces', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Cups' }),
    })

    const patchRes = await app.request('/pieces/cups', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'finished' }),
    })
    expect(await patchRes.json()).toMatchObject({ success: true, data: { status: 'finished' } })

    const putRes = await app.request('/pieces/cups/draft', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ draft: 'The last word.' }),
    })
    expect(putRes.status).toBe(200)

    const getRes = await app.request('/pieces/cups')
    expect(await getRes.json()).toMatchObject({ success: true, data: { status: 'finished', draft: 'The last word.' } })
  })

  it('reports retitling a piece that does not exist as PIECE_NOT_FOUND', async () => {
    const app = await withWorkspace()
    const res = await app.request('/pieces/nothing-here', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Anything' }),
    })
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ success: false, error: { code: 'PIECE_NOT_FOUND' } })
  })

  it('refuses to widen a piece past its mode\'s cast', async () => {
    const app = await withWorkspace()
    await app.request('/pieces', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Cups' }),
    })

    const res = await app.request('/pieces/cups', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cast: ['story-editor'] }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ success: false, error: { code: 'CAST_MEMBER_UNKNOWN' } })
  })

  it('reports enabling a specialist for a piece that does not exist as PIECE_NOT_FOUND', async () => {
    const app = await withWorkspace()
    const res = await app.request('/pieces/nothing-here', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cast: [] }),
    })
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ success: false, error: { code: 'PIECE_NOT_FOUND' } })
  })
})

describe('/pieces/:id/conversations/:cid', () => {
  let dataRoot: string

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-data-root-'))
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  async function withPiece() {
    const { app, workspace } = buildTestApp(dataRoot)
    const dir = await workspace.set('my-writing')
    await app.request('/pieces', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Cups' }),
    })
    return { app, dir }
  }

  it('reports the piece\'s conversations, in the listing GET /pieces/:id already carries', async () => {
    const { app, dir } = await withPiece()
    await writeConversation(dir, 'cups', 'c1', {
      id: 'c1',
      rounds: [{ id: 'r1', message: 'does the opening earn its length', addressed: [], brought: [], outcome: 'settled', participants: [] }],
    })

    const res = await app.request('/pieces/cups')
    const body = await res.json()
    expect(body.data.conversations).toEqual([{ id: 'c1', opening: 'does the opening earn its length', lastActivity: expect.any(Number) }])
  })

  it('deletes a conversation and the change files its applications name', async () => {
    const { app, dir } = await withPiece()
    await writeConversation(dir, 'cups', 'c1', {
      id: 'c1',
      rounds: [
        {
          id: 'r1',
          addressed: [],
          brought: [],
          outcome: 'settled',
          participants: [{ participantId: 'shape', result: { kind: 'response', outcome: 'applicableSuggestion', claim: 'cut it' } }],
        },
      ],
    })
    await writeAppliedChange(dir, 'cups', {
      id: 'change1',
      roundId: 'r1',
      participantId: 'shape',
      content: { kind: 'passages', passages: [{ before: 'it', after: '' }] },
    })

    const delRes = await app.request('/pieces/cups/conversations/c1', { method: 'DELETE' })
    expect(delRes.status).toBe(200)
    expect(await delRes.json()).toEqual({ success: true, data: null })

    const getRes = await app.request('/pieces/cups/conversations/c1')
    expect(getRes.status).toBe(404)
    expect(await getRes.json()).toMatchObject({ success: false, error: { code: 'CONVERSATION_NOT_FOUND' } })

    const pieceRes = await app.request('/pieces/cups')
    expect((await pieceRes.json()).data.conversations).toEqual([])
  })

  it('reports deleting a conversation nothing has written yet as CONVERSATION_NOT_FOUND', async () => {
    const { app } = await withPiece()

    const res = await app.request('/pieces/cups/conversations/never-written', { method: 'DELETE' })
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ success: false, error: { code: 'CONVERSATION_NOT_FOUND' } })
  })
})
