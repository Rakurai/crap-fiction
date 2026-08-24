import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Getting to an open piece, which is where all three fixture journeys start and
 * none of them is about. It is the arrangement journey's own opening walked
 * again — deliberately, rather than by seeding files into the data root: a
 * journey that reached its starting state through a back door would stop proving
 * the state is reachable, and this suite's whole claim is that it walks what the
 * author walks.
 *
 * The workspace is named once per data root and the studio never asks again, so
 * whether the prompt is up depends on which journey ran first. Both openings are
 * therefore tolerated — and which one appeared is waited for rather than guessed
 * at, since the studio renders neither while it is still asking the server.
 */
const WORKSPACE = 'my-writing'

/**
 * A control named exactly, everywhere below.
 *
 * Playwright reads a role's name as a substring by default, and this interface
 * has a piece's own title sitting in the top bar as a button beside the view
 * controls — so a journey about a piece called "Reading Position" asking for the
 * button named "reading" is asking for two things at once. Every control here is
 * therefore named in full, which is also how the author reads them.
 */
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

  // A title of its own per journey, because the data root is shared across the
  // three and a listing with two rows reading the same words is ambiguous to a
  // test for the same reason it would be to the author.
  await newPiece.click()
  await page.getByLabel('title', { exact: true }).fill(title)
  await control(page, 'create').click()

  await control(page, title).click()
  await expect(manuscript(page)).toBeVisible()
}

/** The rendered prose surface — the editor itself, named the way anything reading the page reaches it. */
export function manuscript(page: Page): Locator {
  return page.getByRole('textbox', { name: 'Manuscript' })
}

/**
 * Sends the room a message and returns once a round is on screen in flight.
 *
 * `abandon` beside the round's facts line is the studio's own statement that a
 * round is running; the journeys read flight from it rather than from a timer,
 * so a slower machine waits instead of failing.
 */
export async function sendToRoom(page: Page, message: string): Promise<Locator> {
  await page.getByLabel('Message the room').fill(message)
  await control(page, 'send').click()
  const abandon = control(page, 'abandon')
  await expect(abandon).toBeVisible()
  return abandon
}

/**
 * Replaces the manuscript with prose that is certainly taller than the surface
 * showing it, through the source view — the one route in the interface that
 * accepts whole Markdown, so a journey needing many paragraphs does not have to
 * synthesise keystrokes for the paragraph breaks.
 */
export async function writeThroughSource(page: Page, markdown: string): Promise<void> {
  await control(page, 'source').click()
  await page.getByRole('textbox', { name: 'Manuscript source' }).fill(markdown)
  await control(page, 'rendered').click()
  await expect(manuscript(page)).toBeVisible()
}
