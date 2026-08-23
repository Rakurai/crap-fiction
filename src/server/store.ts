import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import writeFileAtomic from 'write-file-atomic'
import { Document, parse, parseDocument } from 'yaml'
import { z } from 'zod'

export class TolerantReadError extends Error {
  constructor(file: string, entry: string, reason: string) {
    super(`${file}: ${entry}: ${reason}`)
    this.name = 'TolerantReadError'
  }
}

export class ShippedDataError extends Error {
  constructor(file: string, entry: string, reason: string) {
    super(`${file}: ${entry}: ${reason}`)
    this.name = 'ShippedDataError'
  }
}

/**
 * SPEC "Files": the closed list of tolerances a hand-edited file gets, applied
 * to the parsed value before it reaches the schema. Everything else — a value
 * of the wrong kind, YAML that does not parse — is left for the schema to
 * reject as a stated failure. An unknown key needs no entry here: it is never
 * rejected by an unstrict object schema, and surviving a write is a property
 * of writeYamlArtifact operating on the parsed Document rather than of this
 * transform. `ZodDefault` is deliberately not unwrapped: a default is a value
 * the schema would supply, not one the tolerant reader is entitled to invent
 * in its place.
 */
function tolerate(schema: z.core.$ZodType, raw: unknown): unknown {
  let core: z.core.$ZodType = schema
  let optionalSection = false
  while (core instanceof z.ZodOptional) {
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function setPaths(document: Document, prefix: readonly string[], values: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(values)) {
    const at = [...prefix, key]
    if (isPlainObject(value)) {
      setPaths(document, at, value)
    } else {
      document.setIn(at, value)
    }
  }
}

/**
 * Writes a hand-editable YAML artifact atomically: reads the existing
 * document when there is one and sets only the paths named in `values`,
 * which is what lets a comment, a key's order and a key the schema does not
 * know survive the write (SPEC "Files"). Callers name typed domain values to
 * write; the parsed document never crosses this interface. The temp file
 * lands beside the target, per `write-file-atomic`'s default, and nowhere
 * else.
 */
export async function writeYamlArtifact(filePath: string, values: Record<string, unknown>): Promise<void> {
  const document = existsSync(filePath) ? parseDocument(readFileSync(filePath, 'utf8')) : new Document({})
  setPaths(document, [], values)
  mkdirSync(path.dirname(filePath), { recursive: true })
  await writeFileAtomic(filePath, document.toString())
}

/**
 * Reads every `.yaml` file in `dir` as one shipped-data entry, validated
 * strictly against `schema`: the author never hand-edits shipped data, so
 * none of readYamlArtifact's tolerances apply, and invalid or absent shipped
 * data is a startup failure naming the file and the entry (SPEC "Files").
 */
export function readYamlDirectory<T>(dir: string, schema: z.ZodType<T>): readonly T[] {
  const files = readdirSync(dir).filter((name) => name.endsWith('.yaml'))
  const items = files.map((name) => {
    const filePath = path.join(dir, name)
    const raw = parse(readFileSync(filePath, 'utf8'))
    const result = schema.safeParse(raw)
    if (!result.success) {
      const issue = result.error.issues[0]
      const entry = issue !== undefined && issue.path.length > 0 ? issue.path.join('.') : '(document)'
      throw new ShippedDataError(filePath, entry, issue?.message ?? 'invalid value')
    }
    return result.data
  })

  if (items.length === 0) {
    throw new ShippedDataError(dir, '(directory)', 'no data found')
  }

  return items
}

/**
 * Reads a plain-text artifact and the moment it was last written, in one
 * read, or `undefined` for a declared, meaningful absence.
 */
export function readTextArtifact(filePath: string): { text: string; modifiedMs: number } | undefined {
  if (!existsSync(filePath)) return undefined
  return { text: readFileSync(filePath, 'utf8'), modifiedMs: statSync(filePath).mtimeMs }
}

/** Writes a plain-text artifact atomically, creating its directory if needed. */
export async function writeTextArtifact(filePath: string, text: string): Promise<void> {
  mkdirSync(path.dirname(filePath), { recursive: true })
  await writeFileAtomic(filePath, text)
}

/** Whether an artifact exists, without naming a path or handle to the caller. */
export function artifactExists(filePath: string): boolean {
  return existsSync(filePath)
}

/** The moment an existing artifact was last written. */
export function artifactModifiedMs(filePath: string): number {
  return statSync(filePath).mtimeMs
}

/** The subdirectory names directly inside `dir`, or none if `dir` does not exist. */
export function subdirectories(dir: string): readonly string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
}
