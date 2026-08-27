import { expect, type Locator, type Page } from '@playwright/test'

const WORKSPACE = 'my-writing'

// Exact: Playwright matches a role's name as a substring, and the piece's own title sits in
// the top bar as a button beside the view controls.
export function control(page: Page, name: string): Locator {
  return page.getByRole('button', { name, exact: true })
}

export function paneControl(page: Page, long: string, short: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^(${long}|${short})$`) })
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

  await createPiece(page, title)
}

export async function createPiece(page: Page, title: string): Promise<void> {
  await control(page, 'new piece').click()
  await page.getByLabel('title', { exact: true }).fill(title)
  await control(page, 'create').click()

  await reopenPiece(page, title)
}

export async function reopenPiece(page: Page, title: string): Promise<void> {
  await control(page, title).click()
  await expect(manuscript(page)).toBeVisible()
}

export async function openPieces(page: Page): Promise<void> {
  await control(page, 'PIECES').click()
  await expect(control(page, 'new piece')).toBeVisible()
}

/** One answer's controls: a transcript draws the same ones under every answer it holds. */
export function answerOf(page: Page, participantName: string): Locator {
  return page.getByRole('group', { name: `${participantName}'s answer` })
}

export function answerControl(page: Page, participantName: string, name: string): Locator {
  return answerOf(page, participantName).getByRole('button', { name, exact: true })
}

/**
 * A line of a transcript, drawn in whichever surface is showing: every surface keeps its own
 * transcript mounted, and a role query is what passes over the panes held hidden.
 */
export function transcriptLine(page: Page, text: string): Locator {
  return page.getByRole('paragraph').filter({ hasText: text })
}

export function manuscript(page: Page): Locator {
  return page.getByRole('textbox', { name: 'Manuscript' })
}

/** The composer of whichever surface is showing: a role query passes over the ones held hidden. */
export function composer(page: Page): Locator {
  return page.getByRole('combobox', { name: 'Message the room' })
}

export async function sendToRoom(page: Page, message: string): Promise<Locator> {
  await composer(page).fill(message)
  await control(page, 'send').click()
  const stop = control(page, 'stop')
  await expect(stop).toBeVisible()
  return stop
}

export async function writeThroughSource(page: Page, markdown: string): Promise<void> {
  await paneControl(page, 'source', 'src').click()
  await page.getByRole('textbox', { name: 'Manuscript source' }).fill(markdown)
  await paneControl(page, 'rendered', 'prose').click()
  await expect(manuscript(page)).toBeVisible()
}
