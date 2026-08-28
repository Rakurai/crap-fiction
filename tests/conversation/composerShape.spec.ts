import { expect, test, type Locator } from '@playwright/test'
import { composer, control, openPiece } from '../support/studio.js'

async function box(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const found = await locator.boundingBox()
  if (found === null) throw new Error('the control was not drawn, so it has no box to measure')
  return found
}

test('the composer stacks its controls beside a field that spans them', async ({ page }) => {
  await openPiece(page, 'Composer Shape')

  const ask = await box(control(page, 'ask me'))
  const send = await box(control(page, 'send'))
  const field = await box(composer(page))

  expect(ask.y + ask.height).toBeLessThanOrEqual(send.y)
  expect(ask.x + ask.width).toBeCloseTo(send.x + send.width, 0)
  expect(field.x + field.width).toBeLessThanOrEqual(ask.x)
  expect(field.y).toBeCloseTo(ask.y, 0)
  expect(field.y + field.height).toBeCloseTo(send.y + send.height, 0)
})
