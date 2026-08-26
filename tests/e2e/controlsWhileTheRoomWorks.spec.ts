import { expect, test } from '@playwright/test'
import { composer, control, manuscript, openPiece } from './studio.js'

const OPENING = 'The cups sat where she had left them.'

test('the send control keeps its box while the room holds it, and Abandon is drawn as a control', async ({ page }) => {
  await openPiece(page, 'Controls While The Room Works')

  const editor = manuscript(page)
  await editor.click()
  await page.keyboard.type(OPENING)

  const send = control(page, 'send')
  await composer(page).fill('what isn’t working about the opening')
  await expect(send).toBeEnabled()
  const offered = await send.boundingBox()

  await send.click()
  const abandon = control(page, 'abandon')
  await expect(abandon).toBeVisible()
  await expect(send).toBeDisabled()

  const held = await send.boundingBox()
  expect(held?.width).toBe(offered?.width)
  expect(held?.height).toBe(offered?.height)
  expect(held?.height ?? 0).toBeGreaterThan(24)

  await expect(abandon).toHaveCSS('border-top-width', '1px')
  const escape = await abandon.boundingBox()
  expect(escape?.height ?? 0).toBeGreaterThan(20)

  await abandon.click()
  await expect(abandon).toBeHidden()
})
