import { describe, expect, it } from 'vitest'
import { participantMarkColor, unseededParticipantMarkColor } from '../../src/client/theme/participantMark.js'

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

describe('the treatment for a participant the roster gives no seed', () => {
  const saturationOf = (colour: string) => Number(colour.split(/[\s(]+/)[2]?.replace('%', ''))

  it('carries no hue, unlike any seeded mark', () => {
    expect(saturationOf(unseededParticipantMarkColor('dark'))).toBe(0)
    expect(saturationOf(unseededParticipantMarkColor('light'))).toBe(0)
  })

  it('cannot collide with a seeded mark at any ordinal, in either scheme', () => {
    for (const scheme of ['dark', 'light'] as const) {
      const unseeded = unseededParticipantMarkColor(scheme)
      for (let ordinal = 0; ordinal < 12; ordinal++) {
        expect(participantMarkColor(ordinal, scheme)).not.toBe(unseeded)
      }
    }
  })

  it('holds the same per-scheme lightness a seeded mark holds', () => {
    const lightnessOf = (colour: string) => Number(colour.match(/(\d+)%\)$/)?.[1])

    expect(lightnessOf(unseededParticipantMarkColor('dark'))).toBe(lightnessOf(participantMarkColor(0, 'dark')))
    expect(lightnessOf(unseededParticipantMarkColor('light'))).toBe(lightnessOf(participantMarkColor(0, 'light')))
  })
})
