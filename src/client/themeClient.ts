import { z } from 'zod'
import { themeSchema, type Theme } from '../shared/theme.js'
import { RequestFailure, requestJson } from './request.js'

const themeStateSchema = z.object({ theme: themeSchema.nullable() })
const themeSetSchema = z.object({ theme: themeSchema })

export async function fetchTheme(signal?: AbortSignal): Promise<Theme | null> {
  const data = await requestJson('/theme', themeStateSchema, { signal: signal ?? null })
  return data.theme
}

export type ChooseThemeResult = { readonly ok: true; readonly theme: Theme } | { readonly ok: false; readonly message: string }

export async function chooseTheme(theme: Theme, signal?: AbortSignal): Promise<ChooseThemeResult> {
  try {
    const data = await requestJson('/theme', themeSetSchema, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ theme }),
      signal: signal ?? null,
    })
    return { ok: true, theme: data.theme }
  } catch (err) {
    if (err instanceof RequestFailure) {
      return { ok: false, message: err.message }
    }
    throw err
  }
}
