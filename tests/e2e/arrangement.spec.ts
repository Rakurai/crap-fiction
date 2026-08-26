import { expect, test } from '@playwright/test'

test('prose typed into the manuscript is the prose found there after a reload', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel('Where do your pieces live?').fill('my-writing')
  await page.getByRole('button', { name: 'use this directory' }).click()

  await page.getByRole('button', { name: 'new piece' }).click()
  await page.getByLabel('title', { exact: true }).fill('The Lighthouse')
  await page.getByRole('button', { name: 'create' }).click()

  await page.getByRole('button', { name: 'The Lighthouse' }).click()

  const prose = 'First light of the day, and the cups sat where she left them.'

  const written = page.waitForResponse(
    (response) => response.request().method() === 'PUT' && response.url().endsWith('/surfaces/draft/document') && response.ok(),
  )
  await page.getByRole('textbox', { name: 'Manuscript' }).fill(prose)
  await written

  await page.reload()

  await expect(page.getByText('13 WORDS')).toBeVisible()

  await page.getByRole('button', { name: 'The Lighthouse' }).click()
  await expect(page.getByRole('textbox', { name: 'Manuscript' })).toHaveText(prose)
})
