import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Identity } from '../../src/client/Identity.js'

const VOICE = { mark: 'VO', ordinal: 0, displayName: 'Voice', handle: 'voice' }

describe('Identity', () => {
  afterEach(cleanup)

  it('reads as the display name followed by the handle, so the name is what the eye lands on', () => {
    render(<Identity {...VOICE} />)

    expect(screen.getByText('Voice').compareDocumentPosition(screen.getByText('@voice'))).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('names a participant that has no handle by its display name alone', () => {
    render(<Identity mark={null} ordinal={null} displayName="Unknown participant" handle={undefined} />)

    expect(screen.getByText('Unknown participant')).toBeTruthy()
    expect(screen.queryByText(/^@/)).toBeNull()
  })
})
