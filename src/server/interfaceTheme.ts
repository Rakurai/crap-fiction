import { z } from 'zod'
import { themeSchema, type Theme } from '../shared/theme.js'
import { readSettingsSection, type SettingsStore } from './store/index.js'

const preferencesSchema = z.object({ theme: themeSchema.optional() })

export class InterfaceTheme {
  readonly #dataRoot: string
  readonly #settings: SettingsStore

  constructor(dataRoot: string, settings: SettingsStore) {
    this.#dataRoot = dataRoot
    this.#settings = settings
  }

  get(): Theme | undefined {
    return readSettingsSection(this.#dataRoot, 'interfacePreferences', preferencesSchema)?.theme
  }

  async set(theme: Theme): Promise<void> {
    await this.#settings.writeSection(this.#dataRoot, 'interfacePreferences', { theme })
  }
}
