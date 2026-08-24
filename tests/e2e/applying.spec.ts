import { expect, test } from '@playwright/test'
import { APPLIED_MANUSCRIPT, SUGGESTION_CLAIM } from '../support/fixtureAnswers.js'
import { control, manuscript, openPiece, sendToRoom } from './studio.js'

/**
 * SPEC "Verification": applying a recommendation changes the visible manuscript;
 * the manuscript is read-only for the duration and editable the moment it
 * settles; and the editor's own undo keystroke restores it.
 *
 * The undo is the reason this is a browser test and not three of them. SPEC
 * "Deliberately out" keeps no application undo stack and no inverse-closure
 * machinery: what restores the manuscript is the editor's own history, reached by
 * the author's own keystroke, and the only place both of those are real is a
 * browser. That the application arrives as a single history action is the draft
 * boundary's to state and is stated there; that the keystroke finds it is here.
 */
const OPENING = 'The cups sat where she had left them.'

/** Typed once the application has been undone, to prove the surface took real keystrokes again. */
const MARKER = ' Still hers to write.'

const REFUSED = 'zzz'

test('applying a recommendation rewrites the manuscript, holds it, releases it, and undoes as one action', async ({ page }) => {
  await openPiece(page, 'Applying A Recommendation')

  const editor = manuscript(page)
  await editor.click()
  await page.keyboard.type(OPENING)

  const roundAbandon = await sendToRoom(page, 'is the opening carrying its weight')
  await expect(page.getByText(SUGGESTION_CLAIM)).toBeVisible()
  await expect(roundAbandon).toBeHidden()

  await control(page, 'apply').click()

  // Read-only while the call is out, stated two ways because they are two
  // different facts and only one of them is the author's. The notice and the
  // attribute are why the surface refuses; the prose being untouched after real
  // keystrokes is the refusal itself.
  await expect(page.getByText('READ-ONLY')).toBeVisible()
  await expect(editor).toHaveAttribute('contenteditable', 'false')
  await editor.click()
  await page.keyboard.type(REFUSED)
  await expect(editor).toHaveText(OPENING)

  // The manuscript the author is looking at is the applied one — not a notice
  // saying it was applied, and not the same prose with a record beside it.
  await expect(editor).toHaveText(APPLIED_MANUSCRIPT)
  await expect(page.getByText('READ-ONLY')).toBeHidden()

  // Editable the moment it settles, with nothing to dismiss first.
  await expect(editor).toHaveAttribute('contenteditable', 'true')

  // The author's own undo keystroke, and one of them: the application is a
  // single history action, so it comes back whole rather than a sentence at a
  // time. Pressed before anything is typed on top of it — what the editor does
  // with the author's next keystrokes is the next assertion's business and not
  // this one's.
  await editor.click()
  await page.keyboard.press('ControlOrMeta+z')
  await expect(editor).toHaveText(OPENING)

  // And the surface is genuinely the author's again: real keystrokes, landing
  // where they were typed.
  await page.keyboard.press('End')
  await page.keyboard.type(MARKER)
  await expect(editor).toHaveText(`${OPENING}${MARKER}`)
})
