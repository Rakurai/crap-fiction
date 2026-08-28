import { readFileSync } from 'node:fs'
import path from 'node:path'
import { parse } from 'yaml'
import { validateConfig, type StudioConfig } from '../shared/config.js'

const CONFIG_PATH = path.join(import.meta.dirname, '..', '..', 'config.yaml')

let cached: StudioConfig | undefined

export function loadConfig(): StudioConfig {
  cached ??= validateConfig(parse(readFileSync(CONFIG_PATH, 'utf8')), CONFIG_PATH)
  return cached
}
