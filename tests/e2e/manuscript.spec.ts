import { expect, test } from '@playwright/test'

/**
 * The one journey walked in a browser: prose the author types is prose they
 * find again. This is the behaviour VISION cannot tolerate failing, and every
 * link in the chain is proven somewhere else — the debounce and the write in
 * flight in `autosave`, the write itself in `pieces`, the envelope at the
 * route, meaning surviving the document model in `markdown` — while nothing
 * proves the chain.
 *
 * Nothing is simulated and no seam is invented to observe it: the test reaches
 * the studio the way the author does, including naming a workspace, because the
 * suite's data root starts empty and that is what a first run does.
 */
test('prose typed into the manuscript is the prose found there after a reload', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel('Where do your pieces live?').fill('my-writing')
  await page.getByRole('button', { name: 'use this directory' }).click()

  await page.getByRole('button', { name: 'new piece' }).click()
  await page.getByLabel('title', { exact: true }).fill('The Lighthouse')
  await page.getByRole('button', { name: 'create' }).click()

  await page.getByRole('button', { name: 'The Lighthouse' }).click()

  // Thirteen words, counted by hand rather than by the counter under test.
  const prose = 'First light of the day, and the cups sat where she left them.'

  // The write waited for is the debounced one the author never asks for: the
  // test does not call the save path and does not reach past the debounce, it
  // waits for the write the debounce eventually makes.
  const written = page.waitForResponse(
    (response) => response.request().method() === 'PUT' && response.url().endsWith('/draft') && response.ok(),
  )
  await page.getByRole('textbox', { name: 'Manuscript' }).fill(prose)
  await written

  await page.reload()

  // The listing's length is read from the draft on disk, so it says the prose
  // is there before the manuscript is opened again to show it — and it would
  // read zero words if the draft had been held only in memory.
  await expect(page.getByText('13 WORDS')).toBeVisible()

  await page.getByRole('button', { name: 'The Lighthouse' }).click()
  await expect(page.getByRole('textbox', { name: 'Manuscript' })).toHaveText(prose)
})
