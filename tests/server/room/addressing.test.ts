import { describe, expect, it } from 'vitest'
import { parseAddressing } from '../../../src/server/room/addressing.js'
import type { RoleDefinition } from '../../../src/server/model/roles.js'

const shape: RoleDefinition = { id: 'shape', handle: 'shape', displayName: 'Shape', roleDescription: 'x' }
const compression: RoleDefinition = { id: 'compression', handle: 'compression', displayName: 'Compression', roleDescription: 'y' }
const editor: RoleDefinition = { id: 'story-editor', handle: 'editor', displayName: 'Story Editor', roleDescription: 'z' }
const participants = [shape, compression, editor]

// Where a sigil counts as opening a mention at all is the shared `@handle` grammar's claim, held
// at `shared/handle.test.ts`; the one email-shaped case below is this module's seam onto it.

describe('parseAddressing', () => {
  it('addresses every participant a message names, by full handle or by prefix, in the order named, whatever the case and only once each', () => {
    expect(parseAddressing('@shape does the opening earn its length', participants)).toEqual([shape])
    expect(parseAddressing('@comp the last line is doing too much', participants)).toEqual([compression])
    expect(parseAddressing('a note for @SHAPE and @editor, both of you', participants)).toEqual([shape, editor])
    expect(parseAddressing('@shape, really, @shape', participants)).toEqual([shape])
  })

  /**
   * A token matching no handle, or more than one, is ignored and stays ordinary text — as does a
   * sigil that opened no mention, and a message holding none at all.
   */
  it('addresses nobody from a token matching no handle or more than one, from a sigil that opened nothing, or from a message with none', () => {
    const ambiguous = [shape, { ...compression, id: 'shade', handle: 'shade' }]

    expect(parseAddressing('@nobody home', participants)).toEqual([])
    expect(parseAddressing('@sh pick one', ambiguous)).toEqual([])
    expect(parseAddressing('mail@shape.com is not a mention', participants)).toEqual([])
    expect(parseAddressing('just an ordinary note', participants)).toEqual([])
  })
})
