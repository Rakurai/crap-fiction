import { expect, test } from '@playwright/test'
import { SUGGESTION_CLAIM } from '../support/fixtureAnswers.js'
import { manuscript, openPiece, sendToRoom } from './studio.js'

/**
 * SPEC "Verification": typing stays possible while a round lands, with the
 * keystrokes reaching the editor while the stream is delivering.
 *
 * A browser earns this one. That the composer is not disabled and that a
 * response renders as its event arrives are both settled below the browser and
 * asserted there. What is not is the thing the author would actually feel: real
 * keystrokes reaching a real editor in the same window that is being re-rendered
 * by a stream. Nothing headless can be wrong about that in the way a running
 * application can — a focus steal, a re-mount on an event, an overlay — and each
 * of those looks like working code.
 */
const OPENING = 'The cups sat where she had left them.'

const CONTINUED = ' The harbour was still dark.'

test('keystrokes reach the manuscript while a round is delivering responses', async ({ page }) => {
  await openPiece(page, 'Typing During A Round')

  const editor = manuscript(page)
  await editor.click()
  await page.keyboard.type(OPENING)
  await expect(editor).toHaveText(OPENING)

  const abandon = await sendToRoom(page, 'what isn’t working about the opening')

  // The stream has delivered: a response the round produced is on screen, and
  // the round is still running behind it. Waited for rather than timed, so the
  // keystrokes below land in the window this journey is about and not before it.
  await expect(page.getByText(SUGGESTION_CLAIM)).toBeVisible()
  await expect(abandon).toBeVisible()

  await editor.click()
  await page.keyboard.press('End')
  await page.keyboard.type(CONTINUED)

  // Both halves of the claim, and the second is what makes the first mean
  // anything: the prose arrived, and the round it arrived during had not
  // settled yet.
  await expect(editor).toHaveText(`${OPENING}${CONTINUED}`)
  await expect(abandon).toBeVisible()

  // And the round goes on to settle with the author's own typing intact — a
  // round that quietly replaced the manuscript with the text it was compiled
  // from would pass everything above.
  await expect(abandon).toBeHidden()
  await expect(editor).toHaveText(`${OPENING}${CONTINUED}`)
})
