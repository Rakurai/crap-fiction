import { expect, test } from '@playwright/test'
import { APPLIED_MANUSCRIPT, SUGGESTION_CLAIM } from '../support/fixtureAnswers.js'
import { control, manuscript, openPiece, sendToRoom } from './studio.js'

const OPENING = 'The cups sat where she had left them.'

const MARKER = ' Still hers to write.'

const REFUSED = 'zzz'

test('applying a recommendation rewrites the manuscript, holds it, releases it, and undoes as one action', async ({ page }) => {
  await openPiece(page, 'Applying A Recommendation')

  const editor = manuscript(page)
  await editor.click()
  await page.keyboard.type(OPENING)

  const abandon = await sendToRoom(page, 'is the opening carrying its weight')
  await expect(page.getByText(SUGGESTION_CLAIM)).toBeVisible()
  await expect(abandon).toBeHidden()

  await control(page, 'apply').click()

  await expect(page.getByText('READ-ONLY')).toBeVisible()
  await expect(page.getByText("Held while Shape's change is applied.")).toBeVisible()
  await expect(editor).toHaveAttribute('contenteditable', 'false')
  await editor.click()
  await page.keyboard.type(REFUSED)
  await expect(editor).toHaveText(OPENING)

  await expect(editor).toHaveText(APPLIED_MANUSCRIPT)
  await expect(page.getByText('READ-ONLY')).toBeHidden()

  await expect(editor).toHaveAttribute('contenteditable', 'true')

  await editor.click()
  await page.keyboard.press('ControlOrMeta+z')
  await expect(editor).toHaveText(OPENING)

  await page.keyboard.press('End')
  await page.keyboard.type(MARKER)
  await expect(editor).toHaveText(`${OPENING}${MARKER}`)
})
