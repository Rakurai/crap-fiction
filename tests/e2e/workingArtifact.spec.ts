import { expect, test, type Locator, type Page } from '@playwright/test'
import { APPLIED_TEXT, SUGGESTION_CLAIM } from '../support/fixtureAnswers.js'
import {
  answerControl,
  answerOf,
  control,
  createPiece,
  leavePiece,
  manuscript,
  openPiece,
  reopenPiece,
  sendToRoom,
  transcriptLine,
} from './studio.js'

const FIRST = 'Working Artifact'

const SECOND = 'A Second Piece'

const OPENING = 'The cups sat where she had left them.'

const STORY_NOTE = 'about: two people and a harbour they never name'

const AUTHOR_NOTE = 'I write short, and I distrust adverbs.'

const DRAFT_ASK = 'is the opening carrying its weight'

const STORY_ASK = 'does this say what the piece is about'

const AUTHOR_ASK = 'what does this say about how I write'

function contextDocument(page: Page, label: string): Locator {
  return page.getByRole('textbox', { name: label })
}

test('each surface holds its own work, a context change applies and persists, and author context follows the author', async ({
  page,
}) => {
  await openPiece(page, FIRST)

  const editor = manuscript(page)
  await editor.click()
  await page.keyboard.type(OPENING)

  await sendToRoom(page, DRAFT_ASK)

  await control(page, 'story context').click()
  const storyContext = contextDocument(page, 'Story context')
  await expect(storyContext).toBeVisible()
  await expect(page.getByText(DRAFT_ASK)).toBeHidden()
  await expect(control(page, 'abandon')).toBeHidden()

  await storyContext.fill(STORY_NOTE)
  await sendToRoom(page, STORY_ASK)

  await control(page, 'draft').click()
  await expect(control(page, 'abandon')).toBeVisible()
  await expect(editor).toHaveText(OPENING)
  await expect(transcriptLine(page, SUGGESTION_CLAIM)).toBeVisible()
  await expect(control(page, 'abandon')).toBeHidden()

  await control(page, 'story context').click()
  await expect(answerOf(page, 'Story Editor')).toBeVisible()
  await expect(page.getByText(STORY_ASK)).toBeVisible()
  await expect(page.getByText(DRAFT_ASK)).toBeHidden()

  await answerControl(page, 'Story Editor', 'apply').click()
  await expect(page.getByText('READ-ONLY')).toBeVisible()
  await expect(page.getByText("Held while Story Editor's change is applied.")).toBeVisible()
  await expect(storyContext).toBeDisabled()

  await expect(storyContext).toHaveValue(APPLIED_TEXT)
  await expect(page.getByText('READ-ONLY')).toBeHidden()
  await expect(storyContext).toBeEnabled()

  await control(page, 'author context').click()
  const authorContext = contextDocument(page, 'Author context')
  await authorContext.fill(AUTHOR_NOTE)
  await sendToRoom(page, AUTHOR_ASK)
  await expect(page.getByText(AUTHOR_ASK)).toBeVisible()
  await expect(answerOf(page, 'Story Editor')).toBeVisible()

  // Leaving is what flushes every surface, so reopening shows what reached disk.
  await leavePiece(page)
  await reopenPiece(page, FIRST)
  await expect(editor).toHaveText(OPENING)

  await control(page, 'story context').click()
  await expect(storyContext).toHaveValue(APPLIED_TEXT)

  await leavePiece(page)
  await createPiece(page, SECOND)
  await expect(editor).toHaveText('')

  await control(page, 'author context').click()
  await expect(authorContext).toHaveValue(AUTHOR_NOTE)
  await expect(page.getByText(AUTHOR_ASK)).toBeVisible()
  await expect(answerOf(page, 'Story Editor')).toBeVisible()
})
