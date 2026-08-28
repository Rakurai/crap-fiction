import { describe, expect, it } from 'vitest'
import { parseAddressing } from '../../src/server/room/addressing.js'
import type { RoleDefinition } from '../../src/server/model/roles.js'

const SHAPE: RoleDefinition = {
  id: 'shape',
  handle: 'shape',
  displayName: 'Shape',
  description: 'x',
  mark: 'SH',
  persona: 'reasons about x',
  eligibility: 'cast',
  function: undefined,
  availability: [],
}
const COMPRESSION: RoleDefinition = {
  id: 'compression',
  handle: 'compression',
  displayName: 'Compression',
  description: 'y',
  mark: 'CO',
  persona: 'reasons about y',
  eligibility: 'cast',
  function: undefined,
  availability: [],
}
const EDITOR: RoleDefinition = {
  id: 'story-editor',
  handle: 'editor',
  displayName: 'Story Editor',
  description: 'z',
  mark: 'SE',
  persona: 'reasons about z',
  eligibility: 'generalist',
  function: undefined,
  availability: [],
}
const PARTICIPANTS = [SHAPE, COMPRESSION, EDITOR]

describe('parseAddressing', () => {
  it('addresses every participant a message names, by full handle or by prefix, in the order named, whatever the case and only once each', () => {
    expect(parseAddressing('@shape does the opening earn its length', PARTICIPANTS)).toEqual([SHAPE])
    expect(parseAddressing('@comp the last line is doing too much', PARTICIPANTS)).toEqual([COMPRESSION])
    expect(parseAddressing('a note for @SHAPE and @editor, both of you', PARTICIPANTS)).toEqual([SHAPE, EDITOR])
    expect(parseAddressing('@shape, really, @shape', PARTICIPANTS)).toEqual([SHAPE])
  })

  it('addresses nobody from a token matching no handle or more than one, from a sigil that opened nothing, or from a message with none', () => {
    const ambiguous = [SHAPE, { ...COMPRESSION, id: 'shade', handle: 'shade' }]

    expect(parseAddressing('@nobody home', PARTICIPANTS)).toEqual([])
    expect(parseAddressing('@sh pick one', ambiguous)).toEqual([])
    expect(parseAddressing('mail@shape.com is not a mention', PARTICIPANTS)).toEqual([])
    expect(parseAddressing('just an ordinary note', PARTICIPANTS)).toEqual([])
  })
})
