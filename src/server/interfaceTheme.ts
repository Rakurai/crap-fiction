import { z } from 'zod'
import { themeSchema, type Theme } from '../shared/theme.js'
import { readSettingsSection, writeSettingsSection } from './store/index.js'

const preferencesSchema = z.object({ theme: themeSchema.optional() })

export class InterfaceTheme {
  readonly #dataRoot: string

  constructor(dataRoot: string) {
    this.#dataRoot = dataRoot
  }

  get(): Theme | undefined {
    return readSettingsSection(this.#dataRoot, 'interfacePreferences', preferencesSchema)?.theme
  }

  async set(theme: Theme): Promise<void> {
    await writeSettingsSection(this.#dataRoot, 'interfacePreferences', { theme })
  }
}
