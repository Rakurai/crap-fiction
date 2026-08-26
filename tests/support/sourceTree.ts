import { readdirSync } from 'node:fs'
import path from 'node:path'

export const REPO_ROOT = path.join(import.meta.dirname, '..', '..')

/** Every TypeScript source under `dir`, at any depth, as absolute paths. */
export function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [full] : []
  })
}

/** The same, named from the repository root rather than from the caller. */
export function sourcesUnder(...segments: readonly string[]): string[] {
  return sourceFiles(path.join(REPO_ROOT, ...segments))
}
