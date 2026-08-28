import { expect, test } from '@playwright/test'
import { SUGGESTION_CLAIM } from '../support/fixtureAnswers.js'
import { manuscript, openPiece, sendToRoom } from '../support/studio.js'

const OPENING = 'The cups sat where she had left them.'

const CONTINUED = ' The harbour was still dark.'

test('keystrokes reach the manuscript while the room is delivering responses', async ({ page }) => {
  await openPiece(page, 'Typing While The Room Answers')

  const editor = manuscript(page)
  await editor.click()
  await page.keyboard.type(OPENING)
  await expect(editor).toHaveText(OPENING)

  const stop = await sendToRoom(page, 'what isn’t working about the opening')

  await expect(page.getByText(SUGGESTION_CLAIM)).toBeVisible()
  await expect(stop).toBeVisible()

  await editor.click()
  await page.keyboard.press('End')
  await page.keyboard.type(CONTINUED)

  await expect(editor).toHaveText(`${OPENING}${CONTINUED}`)
  await expect(stop).toBeVisible()

  await expect(stop).toBeHidden()
  await expect(editor).toHaveText(`${OPENING}${CONTINUED}`)
})
