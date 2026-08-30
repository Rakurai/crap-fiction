import { describe, expect, it } from 'vitest'
import { participantMarkColor } from '../../src/client/theme/participantMark.js'

describe('deriving a participant mark colour from its roster ordinal', () => {
  it('gives the same ordinal the same colour every time, in one scheme', () => {
    expect(participantMarkColor(3, 'dark')).toBe(participantMarkColor(3, 'dark'))
  })

  it('gives adjacent ordinals visibly different hues', () => {
    const hueOf = (colour: string) => Number(colour.split(/[\s(]+/)[1])

    const first = hueOf(participantMarkColor(0, 'dark'))
    const second = hueOf(participantMarkColor(1, 'dark'))

    expect(Math.abs(first - second)).toBeGreaterThan(30)
  })

  it('lightens the mark for the dark scheme and darkens it for the light scheme, holding the hue', () => {
    const dark = participantMarkColor(2, 'dark')
    const light = participantMarkColor(2, 'light')

    const hueOf = (colour: string) => colour.split(/[\s(]+/)[1]
    const lightnessOf = (colour: string) => Number(colour.match(/(\d+)%\)$/)?.[1])

    expect(hueOf(dark)).toBe(hueOf(light))
    expect(lightnessOf(dark)).toBeGreaterThan(lightnessOf(light))
  })
})
