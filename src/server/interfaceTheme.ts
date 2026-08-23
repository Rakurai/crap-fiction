import { z } from 'zod'
import { themeSchema, type Theme } from '../shared/theme.js'
import { readSettings, writeSettings } from './store/index.js'

const settingsSchema = z.object({
  interfacePreferences: z.object({ theme: themeSchema.optional() }).optional(),
})

/**
 * SPEC "Files": interface preferences are author-editable data, re-read at
 * the moment they are used rather than cached from startup (CODING_STANDARDS
 * "HTTP layer") — unlike the workspace path, nothing about the theme is
 * process configuration. No key written means the author has not chosen,
 * and `undefined` is what carries that rather than a default value nobody
 * picked.
 */
export function getTheme(dataRoot: string): Theme | undefined {
  const settings = readSettings(dataRoot, settingsSchema)
  return settings?.interfacePreferences?.theme
}

export async function setTheme(dataRoot: string, theme: Theme): Promise<void> {
  await writeSettings(dataRoot, { interfacePreferences: { theme } })
}
