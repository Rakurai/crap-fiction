import { expect, test, type Page } from '@playwright/test'
import { manuscript, openPiece, paneControl, writeThroughSource } from '../support/studio.js'

const LONG_MANUSCRIPT = Array.from(
  { length: 40 },
  (_, index) =>
    `Paragraph ${index + 1}. The cups sat where she had left them, and the light came up behind the harbour, over the water and into the room where nobody had yet said anything about the night before.`,
).join('\n\n')

async function readingRatio(page: Page): Promise<number> {
  return manuscript(page).evaluate((node) => {
    function scrolls(element: Element): boolean {
      const { overflowY } = getComputedStyle(element)
      return (overflowY === 'auto' || overflowY === 'scroll') && element.scrollHeight > element.clientHeight
    }

    let element = node.parentElement
    while (element !== null && !scrolls(element)) element = element.parentElement
    if (element === null) throw new Error('nothing around the manuscript scrolls, so there is no position to restore')
    return element.scrollTop / element.scrollHeight
  })
}

const TOLERANCE = 0.05

test('the reading view keeps the place the author was reading, and gives it back', async ({ page }) => {
  await openPiece(page, 'Reading Position')
  await writeThroughSource(page, LONG_MANUSCRIPT)

  const editor = manuscript(page)
  await editor.hover()
  await page.mouse.wheel(0, 2_000)

  await expect.poll(() => readingRatio(page)).toBeGreaterThan(0.1)
  const before = await readingRatio(page)
  expect(before).toBeLessThan(0.8)

  async function drift(): Promise<number> {
    return Math.abs((await readingRatio(page)) - before)
  }

  await paneControl(page, 'reading', 'read').click()
  await expect(paneControl(page, 'reading', 'read')).toBeHidden()
  await expect.poll(drift).toBeLessThan(TOLERANCE)

  await page.keyboard.press('Escape')
  await expect(paneControl(page, 'reading', 'read')).toBeVisible()
  await expect.poll(drift).toBeLessThan(TOLERANCE)
})

const WINDOW = { width: 1100, height: 720 }

test('the reading view holds the measure the prose was already set to, so no line breaks anywhere else', async ({ page }) => {
  await page.setViewportSize(WINDOW)
  await openPiece(page, 'Reading Measure')

  const editor = manuscript(page)
  await editor.click()
  await page.keyboard.type(LONG_MANUSCRIPT.slice(0, 400))

  const beside = await editor.evaluate((node) => node.clientWidth)

  await paneControl(page, 'reading', 'read').click()
  await expect(paneControl(page, 'reading', 'read')).toBeHidden()

  expect(await editor.evaluate((node) => node.clientWidth)).toBe(beside)
})
