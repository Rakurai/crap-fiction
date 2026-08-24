import { expect, test } from '@playwright/test'
import { SUGGESTION_CLAIM } from '../support/fixtureAnswers.js'
import { manuscript, openPiece, sendToRoom } from './studio.js'

const OPENING = 'The cups sat where she had left them.'

const CONTINUED = ' The harbour was still dark.'

test('keystrokes reach the manuscript while a round is delivering responses', async ({ page }) => {
  await openPiece(page, 'Typing During A Round')

  const editor = manuscript(page)
  await editor.click()
  await page.keyboard.type(OPENING)
  await expect(editor).toHaveText(OPENING)

  const abandon = await sendToRoom(page, 'what isn’t working about the opening')

  await expect(page.getByText(SUGGESTION_CLAIM)).toBeVisible()
  await expect(abandon).toBeVisible()

  await editor.click()
  await page.keyboard.press('End')
  await page.keyboard.type(CONTINUED)

  await expect(editor).toHaveText(`${OPENING}${CONTINUED}`)
  await expect(abandon).toBeVisible()

  await expect(abandon).toBeHidden()
  await expect(editor).toHaveText(`${OPENING}${CONTINUED}`)
})
