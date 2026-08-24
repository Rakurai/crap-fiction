import { expect, test, type Page } from '@playwright/test'
import { control, manuscript, openPiece, writeThroughSource } from './studio.js'

/**
 * SPEC "Verification": the reading view restores position against real layout,
 * where the element the browser scrolls and the moment it has a height are the
 * browser's to decide and not the test's to model.
 *
 * The hook states the arithmetic — a ratio captured on the way out and reapplied
 * on the way in — against a DOM whose heights it was handed. What it cannot state
 * is that the numbers refer to anything: the reading view is a different column
 * width, a different measure and a title the editing view does not draw, so the
 * document is a different height on the other side of the switch. A ratio is the
 * right thing to keep only if that is true, and only a browser laying out real
 * prose in a real font can say it is.
 */

/** Enough paragraphs that the surface certainly scrolls, at any window this suite runs at. */
const LONG_MANUSCRIPT = Array.from(
  { length: 40 },
  (_, index) =>
    `Paragraph ${index + 1}. The cups sat where she had left them, and the light came up behind the harbour, over the water and into the room where nobody had yet said anything about the night before.`,
).join('\n\n')

/**
 * Where the author is looking, as a fraction of the whole document.
 *
 * The scrolling element is found by asking which ancestor actually scrolls rather
 * than by naming one: which element that is, and whether the editing and reading
 * views even use the same one, is the browser's business and the CSS's — a test
 * that named it would pass or fail on a detail it has no standing to know. Asked
 * of the computed overflow and not of the heights alone, because the measure
 * column between the prose and the scroller is taller than its own box and
 * scrolls nothing — a height mismatch is not a scroller.
 */
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

/**
 * A ratio survives a relayout approximately or not at all: the document is a
 * different height in each view, so the pixel it lands on is a rounding of the
 * fraction rather than the same pixel. A twentieth of the document is the
 * tolerance — wide enough that a font metric or a scrollbar does not fail the
 * journey, far too narrow for a position that was reset, dropped, or restored
 * from the wrong height.
 */
const TOLERANCE = 0.05

test('the reading view keeps the place the author was reading, and gives it back', async ({ page }) => {
  await openPiece(page, 'Reading Position')
  await writeThroughSource(page, LONG_MANUSCRIPT)

  const editor = manuscript(page)
  await editor.hover()
  await page.mouse.wheel(0, 2_000)

  // Read back rather than assumed: how far a wheel gesture travels is the
  // browser's decision, and this journey needs a position in the middle of the
  // document, not a particular one.
  await expect.poll(() => readingRatio(page)).toBeGreaterThan(0.1)
  const before = await readingRatio(page)
  expect(before).toBeLessThan(0.8)

  async function drift(): Promise<number> {
    return Math.abs((await readingRatio(page)) - before)
  }

  await control(page, 'reading').click()
  await expect(page.getByText('ESC TO RETURN')).toBeVisible()
  await expect.poll(drift).toBeLessThan(TOLERANCE)

  await page.keyboard.press('Escape')
  await expect(page.getByText('ESC TO RETURN')).toBeHidden()
  await expect.poll(drift).toBeLessThan(TOLERANCE)
})
