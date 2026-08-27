import { expect, test } from '@playwright/test'
import { composer, manuscript, openPiece, transcriptLine } from './studio.js'

const OPENING = 'The cups sat where she had left them.'

const MESSAGE = 'what should I be asking about this'

test('Enter sends, Shift+Enter does not, and the mention offer takes Enter while it is open', async ({ page }) => {
  await openPiece(page, 'Sending From The Keyboard')

  const editor = manuscript(page)
  await editor.click()
  await page.keyboard.type(OPENING)

  const field = composer(page)
  await field.click()
  await page.keyboard.type('@int')
  await expect(page.getByRole('option', { name: 'Interviewer' })).toBeVisible()

  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')

  await expect(field).toHaveValue('@interview ')
  await expect(page.getByRole('option', { name: 'Interviewer' })).toBeHidden()

  await page.keyboard.press('Shift+Enter')
  await page.keyboard.type(MESSAGE)
  await expect(field).toHaveValue(`@interview \n${MESSAGE}`)

  await page.keyboard.press('Enter')

  await expect(field).toHaveValue('')
  await expect(transcriptLine(page, MESSAGE)).toBeVisible()
})
