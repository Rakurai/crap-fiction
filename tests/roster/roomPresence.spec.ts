import { expect, test, type Locator, type Page } from '@playwright/test'
import { control, openPiece } from '../support/studio.js'

async function drawnColour(locator: Locator): Promise<string> {
  return locator.evaluate((node) => getComputedStyle(node).color)
}

async function accent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const probe = document.createElement('span')
    probe.style.color = 'var(--accent)'
    document.body.append(probe)
    const resolved = getComputedStyle(probe).color
    probe.remove()
    return resolved
  })
}

test('the room window carries presence in the colour of the control', async ({ page }) => {
  await openPiece(page, 'Room Presence')
  await control(page, 'room').click()

  const present = control(page, 'disable').first()
  const absent = control(page, 'enable').first()
  await expect(present).toBeVisible()
  await expect(absent).toBeVisible()

  const inTheRoom = await accent(page)
  expect(await drawnColour(present)).toBe(inTheRoom)
  expect(await drawnColour(absent)).not.toBe(inTheRoom)
})
