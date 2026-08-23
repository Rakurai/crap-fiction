import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import writeFileAtomic from 'write-file-atomic'
import { Document, parseDocument } from 'yaml'
import { z } from 'zod'

export class TolerantReadError extends Error {
  constructor(file: string, entry: string, reason: string) {
    super(`${file}: ${entry}: ${reason}`)
    this.name = 'TolerantReadError'
  }
}

/**
 * SPEC "Files": the closed list of tolerances a hand-edited file gets, applied
 * to the parsed value before it reaches the schema. Everything else — a value
 * of the wrong kind, YAML that does not parse — is left for the schema to
 * reject as a stated failure. An unknown key needs no entry here: it is never
 * rejected by an unstrict object schema, and surviving a write is a property
 * of writeYamlArtifact operating on the parsed Document rather than of this
 * transform.
 */
function tolerate(schema: z.core.$ZodType, raw: unknown): unknown {
  let core: z.core.$ZodType = schema
  let optionalSection = false
  while (core instanceof z.ZodOptional || core instanceof z.ZodDefault) {
    optionalSection = true
    core = core.unwrap()
  }

  if (raw === undefined) {
    if (optionalSection && core instanceof z.ZodArray) return []
    if (optionalSection && core instanceof z.ZodObject) return {}
    return undefined
  }

  if (core instanceof z.ZodArray) {
    const items = Array.isArray(raw) ? raw : [raw]
    return items.map((item) => tolerate(core.element, item))
  }

  if (core instanceof z.ZodObject) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return raw
    const shape = core.shape
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(shape)) {
      result[key] = tolerate(shape[key], (raw as Record<string, unknown>)[key])
    }
    return result
  }

  if (core instanceof z.ZodString) {
    return typeof raw === 'string' ? raw.trim() : raw
  }

  return raw
}

/**
 * Reads a hand-editable YAML artifact through the tolerances SPEC's "Files"
 * section closes the list on, then validates. A missing file is a declared,
 * meaningful absence — `undefined` — never an empty object standing in for
 * one. Anything else wrong is a TolerantReadError naming the file and the
 * entry, never a value the author did not write.
 */
export function readYamlArtifact<T>(filePath: string, schema: z.ZodType<T>): T | undefined {
  if (!existsSync(filePath)) return undefined

  const text = readFileSync(filePath, 'utf8')
  const document = parseDocument(text)
  if (document.errors.length > 0) {
    throw new TolerantReadError(filePath, '(document)', document.errors[0]?.message ?? 'invalid YAML')
  }

  const raw = document.toJS() ?? {}
  const tolerated = tolerate(schema, raw)
  const result = schema.safeParse(tolerated)
  if (!result.success) {
    const issue = result.error.issues[0]
    const entry = issue !== undefined && issue.path.length > 0 ? issue.path.join('.') : '(document)'
    throw new TolerantReadError(filePath, entry, issue?.message ?? 'invalid value')
  }

  return result.data
}

/**
 * Writes a hand-editable YAML artifact atomically: reads the existing
 * document when there is one so `mutate` edits it in place, which is what
 * lets a comment, a key's order and a key the schema does not know survive
 * the write (SPEC "Files"). The temp file lands beside the target, per
 * `write-file-atomic`'s default, and nowhere else.
 */
export async function writeYamlArtifact(filePath: string, mutate: (document: Document) => void): Promise<void> {
  const document = existsSync(filePath) ? parseDocument(readFileSync(filePath, 'utf8')) : new Document({})
  mutate(document)
  mkdirSync(path.dirname(filePath), { recursive: true })
  await writeFileAtomic(filePath, document.toString())
}
