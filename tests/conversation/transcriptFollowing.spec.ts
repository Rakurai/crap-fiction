import { expect, test, type Page } from '@playwright/test'
import { INTERVIEWER_QUESTION } from '../support/fixtureAnswers.js'
import { control, openPiece, sendToRoom, transcriptLine } from '../support/studio.js'

const MESSAGE = 'what isn’t working about the opening'

const SECOND_MESSAGE = 'say more about the second paragraph'

const STILL_AT_THE_NEWEST = 24

const A_WAY_BACK_UP = 400

function scrollingTranscript(page: Page) {
  return transcriptLine(page, MESSAGE).first()
}

type TranscriptFacts = { readonly fromNewest: number; readonly scrollTop: number }

async function overflowing(page: Page): Promise<TranscriptFacts | null> {
  return scrollingTranscript(page).evaluate((node) => {
    function scrolls(element: Element): boolean {
      const { overflowY } = getComputedStyle(element)
      return (overflowY === 'auto' || overflowY === 'scroll') && element.scrollHeight > element.clientHeight
    }

    let element: Element | null = node.parentElement
    while (element !== null && !scrolls(element)) element = element.parentElement
    if (element === null) return null
    return { fromNewest: element.scrollHeight - element.scrollTop - element.clientHeight, scrollTop: element.scrollTop }
  })
}

async function transcriptFacts(page: Page): Promise<TranscriptFacts> {
  const facts = await overflowing(page)
  if (facts === null) throw new Error('nothing around the transcript scrolls, so there is no position to follow')
  return facts
}

async function longerThanThePane(page: Page): Promise<void> {
  await expect.poll(async () => (await overflowing(page)) !== null).toBe(true)
}

test('the transcript follows the newest entry, holds where the author scrolled back to, and follows the next message again', async ({ page }) => {
  await openPiece(page, 'Transcript Following')

  const stop = await sendToRoom(page, MESSAGE)
  await expect(stop).toBeHidden({ timeout: 20_000 })

  await expect.poll(async () => (await transcriptFacts(page)).fromNewest).toBeLessThanOrEqual(STILL_AT_THE_NEWEST)

  await scrollingTranscript(page).hover()
  await page.mouse.wheel(0, -A_WAY_BACK_UP)
  await expect.poll(async () => (await transcriptFacts(page)).fromNewest).toBeGreaterThan(STILL_AT_THE_NEWEST)

  const heldAt = (await transcriptFacts(page)).scrollTop
  const asking = control(page, 'ask me')
  await expect(asking).toBeEnabled()

  await asking.click()
  await expect(transcriptLine(page, INTERVIEWER_QUESTION)).toBeVisible()

  expect((await transcriptFacts(page)).scrollTop).toBeGreaterThan(heldAt)
  await expect.poll(async () => (await transcriptFacts(page)).fromNewest).toBeLessThanOrEqual(STILL_AT_THE_NEWEST)
})

test('entries landing while the author is reading further up leave the view where it was', async ({ page }) => {
  await openPiece(page, 'Transcript Held')

  const firstRound = await sendToRoom(page, MESSAGE)
  await expect(firstRound).toBeHidden({ timeout: 20_000 })
  await longerThanThePane(page)

  const stop = await sendToRoom(page, SECOND_MESSAGE)

  await scrollingTranscript(page).hover()
  await page.mouse.wheel(0, -A_WAY_BACK_UP)
  await expect.poll(async () => (await transcriptFacts(page)).fromNewest).toBeGreaterThan(STILL_AT_THE_NEWEST)
  const heldAt = (await transcriptFacts(page)).scrollTop

  await expect(stop).toBeHidden({ timeout: 20_000 })

  expect((await transcriptFacts(page)).scrollTop).toBe(heldAt)
})
