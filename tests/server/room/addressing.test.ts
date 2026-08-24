import { describe, expect, it } from 'vitest'
import { parseAddressing } from '../../../src/server/room/addressing.js'
import type { RoleDefinition } from '../../../src/server/model/roles.js'

const shape: RoleDefinition = { id: 'shape', handle: 'shape', displayName: 'Shape', roleDescription: 'x' }
const compression: RoleDefinition = { id: 'compression', handle: 'compression', displayName: 'Compression', roleDescription: 'y' }
const editor: RoleDefinition = { id: 'story-editor', handle: 'editor', displayName: 'Story Editor', roleDescription: 'z' }
const participants = [shape, compression, editor]

describe('parseAddressing', () => {
  it('addresses a participant by its full handle at the start of the message', () => {
    expect(parseAddressing('@shape does the opening earn its length', participants)).toEqual([shape])
  })

  it('addresses a participant by a prefix match on its handle', () => {
    expect(parseAddressing('@comp the last line is doing too much', participants)).toEqual([compression])
  })

  it('addresses a sigil following whitespace, not only one at the start', () => {
    expect(parseAddressing('a note for @shape here', participants)).toEqual([shape])
  })

  it('addresses every participant named, in the order the message names them', () => {
    expect(parseAddressing('@shape and @editor, both of you', participants)).toEqual([shape, editor])
  })

  it('ignores a token matching no handle', () => {
    expect(parseAddressing('@nobody home', participants)).toEqual([])
  })

  it('ignores a token prefix-matching more than one handle', () => {
    const ambiguous = [shape, { ...compression, id: 'shade', handle: 'shade' }]
    expect(parseAddressing('@sh pick one', ambiguous)).toEqual([])
  })

  it('addresses nobody from an email-shaped mention, since the sigil follows a letter rather than whitespace', () => {
    expect(parseAddressing('mail@shape.com is not a mention', participants)).toEqual([])
  })

  it('addresses nobody from a doubled sigil', () => {
    expect(parseAddressing('@@shape', participants)).toEqual([])
  })

  it('is case-insensitive on the handle', () => {
    expect(parseAddressing('@SHAPE weigh in', participants)).toEqual([shape])
  })

  it('addresses a participant only once even if named twice', () => {
    expect(parseAddressing('@shape, really, @shape', participants)).toEqual([shape])
  })

  it('finds nobody in a message with no sigil', () => {
    expect(parseAddressing('just an ordinary note', participants)).toEqual([])
  })
})
