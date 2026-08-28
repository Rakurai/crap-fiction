import { expect, test } from '@playwright/test'
import { applied, SUGGESTION_CLAIM } from '../support/fixtureAnswers.js'
import { answerControl, manuscript, openPiece, sendToRoom } from '../support/studio.js'

const OPENING = 'The cups sat where she had left them, above the harbour.'

const MARKER = ' Still hers to write.'

test('applying a recommendation rewrites the manuscript, holds it, releases it, and undoes as one action', async ({ page }) => {
  await openPiece(page, 'Applying A Recommendation')

  const editor = manuscript(page)
  await editor.click()
  await page.keyboard.type(OPENING)

  const stop = await sendToRoom(page, 'is the opening carrying its weight')
  await expect(page.getByText(SUGGESTION_CLAIM)).toBeVisible()
  await expect(stop).toBeHidden()

  await answerControl(page, 'Change', 'apply').click()

  await expect(page.getByText('READ-ONLY')).toBeVisible()
  await expect(page.getByText("Held while Change's change is applied.")).toBeVisible()
  await expect(editor).toHaveAttribute('contenteditable', 'false')

  await expect(editor).toHaveText(applied(OPENING))
  await expect(page.getByText('READ-ONLY')).toBeHidden()

  await expect(editor).toHaveAttribute('contenteditable', 'true')

  await editor.click()
  await page.keyboard.press('ControlOrMeta+z')
  await expect(editor).toHaveText(OPENING)

  await page.keyboard.press('End')
  await page.keyboard.type(MARKER)
  await expect(editor).toHaveText(`${OPENING}${MARKER}`)
})
