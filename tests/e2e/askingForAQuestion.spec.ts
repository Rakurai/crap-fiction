import { expect, test, type Page } from '@playwright/test'
import { INTERVIEWER_QUESTION } from '../support/fixtureAnswers.js'
import { answerOf, composer, control, manuscript, openPiece, transcriptLine } from './studio.js'

const PIECE = 'Asking For A Question'

const OPENING = 'The cups sat where she had left them.'

const ASK_ME = 'ask me'

async function askForAQuestion(page: Page): Promise<void> {
  await control(page, ASK_ME).click()
  await expect(answerOf(page, 'Interviewer')).toBeVisible()
  await expect(transcriptLine(page, INTERVIEWER_QUESTION)).toBeVisible()
}

test('the composer asks for a question on every surface, and the same words can be typed by hand', async ({ page }) => {
  await openPiece(page, PIECE)

  const editor = manuscript(page)
  await editor.click()
  await page.keyboard.type(OPENING)

  await askForAQuestion(page)

  await control(page, 'story').click()
  await askForAQuestion(page)

  await control(page, 'author').click()
  await askForAQuestion(page)

  // The control composes a message, so the mention it sends is one the composer offers on its own.
  await control(page, 'draft').click()
  await composer(page).fill('@int')
  await page.getByRole('option', { name: 'Interviewer' }).click()
  await expect(composer(page)).toHaveValue('@interview ')
})
