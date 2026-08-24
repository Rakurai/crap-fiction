import { z } from 'zod'
import { themeSchema, type Theme } from '../shared/theme.js'
import { readSettingsSection, writeSettingsSection } from './store/index.js'

const preferencesSchema = z.object({ theme: themeSchema.optional() })

export function getTheme(dataRoot: string): Theme | undefined {
  return readSettingsSection(dataRoot, 'interfacePreferences', preferencesSchema)?.theme
}

export async function setTheme(dataRoot: string, theme: Theme): Promise<void> {
  await writeSettingsSection(dataRoot, 'interfacePreferences', { theme })
}
