import { expect, type Locator, type Page } from '@playwright/test'

const WORKSPACE = 'my-writing'

// Exact: Playwright matches a role's name as a substring, and the piece's own title sits in
// the top bar as a button beside the view controls.
export function control(page: Page, name: string): Locator {
  return page.getByRole('button', { name, exact: true })
}

export async function openPiece(page: Page, title: string): Promise<void> {
  await page.goto('/')

  const namingWorkspace = page.getByLabel('Where do your pieces live?')
  const newPiece = control(page, 'new piece')
  await expect(namingWorkspace.or(newPiece).first()).toBeVisible()
  if (await namingWorkspace.isVisible()) {
    await namingWorkspace.fill(WORKSPACE)
    await control(page, 'use this directory').click()
    await expect(newPiece).toBeVisible()
  }

  await newPiece.click()
  await page.getByLabel('title', { exact: true }).fill(title)
  await control(page, 'create').click()

  await control(page, title).click()
  await expect(manuscript(page)).toBeVisible()
}

export function manuscript(page: Page): Locator {
  return page.getByRole('textbox', { name: 'Manuscript' })
}

export async function sendToRoom(page: Page, message: string): Promise<Locator> {
  await page.getByLabel('Message the room').fill(message)
  await control(page, 'send').click()
  const abandon = control(page, 'abandon')
  await expect(abandon).toBeVisible()
  return abandon
}

export async function writeThroughSource(page: Page, markdown: string): Promise<void> {
  await control(page, 'source').click()
  await page.getByRole('textbox', { name: 'Manuscript source' }).fill(markdown)
  await control(page, 'rendered').click()
  await expect(manuscript(page)).toBeVisible()
}
