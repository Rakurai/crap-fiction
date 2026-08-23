import type { ApiResponse } from '../server/envelope.js'
import type { Theme } from '../server/interfaceTheme.js'

export class ThemeRequestFailure extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ThemeRequestFailure'
  }
}

async function unwrap<T>(response: Response): Promise<T> {
  const body = (await response.json()) as ApiResponse<T>
  if (!body.success) {
    throw new ThemeRequestFailure(body.error.message)
  }
  return body.data
}

export async function fetchTheme(): Promise<Theme | null> {
  const res = await fetch('/theme')
  const data = await unwrap<{ theme: Theme | null }>(res)
  return data.theme
}

export async function chooseTheme(theme: Theme): Promise<Theme> {
  const res = await fetch('/theme', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ theme }),
  })
  const data = await unwrap<{ theme: Theme }>(res)
  return data.theme
}
