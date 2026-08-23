import { z } from 'zod'
import { settingsPath } from './settingsFile.js'
import { readYamlArtifact, writeYamlArtifact } from './store.js'

export const themeSchema = z.enum(['light', 'dark'])

export type Theme = z.infer<typeof themeSchema>

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
  const settings = readYamlArtifact(settingsPath(dataRoot), settingsSchema)
  return settings?.interfacePreferences?.theme
}

export async function setTheme(dataRoot: string, theme: Theme): Promise<void> {
  await writeYamlArtifact(settingsPath(dataRoot), { interfacePreferences: { theme } })
}
