import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import writeFileAtomic from 'write-file-atomic'
import { Document, parse, parseDocument } from 'yaml'
import { z } from 'zod'
import { firstSchemaIssue } from '../schemaIssue.js'

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

// `ZodDefault` is deliberately not unwrapped here.
function tolerate(schema: z.core.$ZodType, raw: unknown): unknown {
  let core: z.core.$ZodType = schema
  let optionalSection = false
  while (core instanceof z.ZodOptional) {
    optionalSection = true
    core = core.unwrap()
  }

  if (raw === undefined) {
    if (optionalSection && core instanceof z.ZodArray) return []
    if (optionalSection && (core instanceof z.ZodObject || core instanceof z.ZodRecord)) return {}
    return undefined
  }

  if (core instanceof z.ZodArray) {
    const items = Array.isArray(raw) ? raw : [raw]
    return items.map((item) => tolerate(core.element, item))
  }

  if (core instanceof z.ZodRecord) {
    if (!isPlainObject(raw)) return raw
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(raw)) {
      result[key] = tolerate(core.valueType, value)
    }
    return result
  }

  if (core instanceof z.ZodObject) {
    if (!isPlainObject(raw)) return raw
    const shape = core.shape
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(shape)) {
      result[key] = tolerate(shape[key], raw[key])
    }
    return result
  }

  if (core instanceof z.ZodString) {
    return typeof raw === 'string' ? raw.trim() : raw
  }

  return raw
}

export function readYamlArtifact<T>(filePath: string, schema: z.ZodType<T>): T | undefined {
  if (!existsSync(filePath)) return undefined

  const text = readFileSync(filePath, 'utf8')
  const document = parseDocument(text)
  const [documentError] = document.errors
  if (documentError !== undefined) {
    throw new TolerantReadError(filePath, '(document)', documentError.message)
  }

  const raw = document.toJS() ?? {}
  const tolerated = tolerate(schema, raw)
  const result = schema.safeParse(tolerated)
  if (!result.success) {
    const { entry, message } = firstSchemaIssue(result.error)
    throw new TolerantReadError(filePath, entry, message)
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

export async function writeYamlArtifact(filePath: string, values: Record<string, unknown>): Promise<void> {
  const document = existsSync(filePath) ? parseDocument(readFileSync(filePath, 'utf8')) : new Document({})
  setPaths(document, [], values)
  mkdirSync(path.dirname(filePath), { recursive: true })
  await writeFileAtomic(filePath, document.toString())
}

function parseShippedYaml<T>(filePath: string, schema: z.ZodType<T>): T {
  const raw = parse(readFileSync(filePath, 'utf8'))
  const result = schema.safeParse(raw)
  if (!result.success) {
    const { entry, message } = firstSchemaIssue(result.error)
    throw new ShippedDataError(filePath, entry, message)
  }
  return result.data
}

export function readYamlDirectory<T>(dir: string, schema: z.ZodType<T>): readonly T[] {
  const files = readdirSync(dir).filter((name) => name.endsWith('.yaml'))
  const items = files.map((name) => parseShippedYaml(path.join(dir, name), schema))

  if (items.length === 0) {
    throw new ShippedDataError(dir, '(directory)', 'no data found')
  }

  return items
}

export function readYamlFile<T>(filePath: string, schema: z.ZodType<T>): T {
  if (!existsSync(filePath)) {
    throw new ShippedDataError(filePath, '(file)', 'not found')
  }
  return parseShippedYaml(filePath, schema)
}

export function readShippedTextFile(filePath: string): string {
  if (!existsSync(filePath)) {
    throw new ShippedDataError(filePath, '(file)', 'not found')
  }
  return readFileSync(filePath, 'utf8').trim()
}

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/

export function readContentFragmentFile<T>(filePath: string, schema: z.ZodType<T>): Readonly<T & { body: string }> {
  if (!existsSync(filePath)) {
    throw new ShippedDataError(filePath, '(file)', 'not found')
  }
  const match = FRONTMATTER_PATTERN.exec(readFileSync(filePath, 'utf8'))
  if (match === null) {
    throw new ShippedDataError(filePath, '(frontmatter)', 'missing or malformed frontmatter block')
  }
  const [, frontmatterText, body] = match
  const raw = parse(frontmatterText ?? '')
  const result = schema.safeParse(raw)
  if (!result.success) {
    const { entry, message } = firstSchemaIssue(result.error)
    throw new ShippedDataError(filePath, entry, message)
  }

  return { ...result.data, body: (body ?? '').trim() }
}

function parseContentDocument<T>(filePath: string, schema: z.ZodType<T>): Readonly<T & { id: string; persona: string }> {
  const { body: persona, ...rest } = readContentFragmentFile(filePath, schema)
  if (persona.length === 0) {
    throw new ShippedDataError(filePath, 'persona', 'must not be empty')
  }

  return { ...(rest as T), id: path.basename(filePath, '.md'), persona }
}

export function readContentDocuments<T>(dir: string, schema: z.ZodType<T>): readonly Readonly<T & { id: string; persona: string }>[] {
  const files = readdirSync(dir).filter((name) => name.endsWith('.md'))
  const items = files.map((name) => parseContentDocument(path.join(dir, name), schema))

  if (items.length === 0) {
    throw new ShippedDataError(dir, '(directory)', 'no data found')
  }

  return items
}

export function readTextArtifact(filePath: string): { text: string; modifiedMs: number } | undefined {
  if (!existsSync(filePath)) return undefined
  return { text: readFileSync(filePath, 'utf8'), modifiedMs: statSync(filePath).mtimeMs }
}

export async function writeTextArtifact(filePath: string, text: string): Promise<void> {
  mkdirSync(path.dirname(filePath), { recursive: true })
  await writeFileAtomic(filePath, text)
}

export function fileExists(filePath: string): boolean {
  return existsSync(filePath)
}

export function fileModifiedMs(filePath: string): number {
  return statSync(filePath).mtimeMs
}

export function directoryNames(dir: string): readonly string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
}

export function fileNames(dir: string, suffix: string): readonly string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(suffix))
    .map((entry) => entry.name)
}

export function readJsonArtifact<T>(filePath: string, schema: z.ZodType<T>): T | undefined {
  if (!existsSync(filePath)) return undefined

  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(filePath, 'utf8'))
  } catch (err) {
    throw new TolerantReadError(filePath, '(document)', err instanceof Error ? err.message : 'invalid JSON')
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    const { entry, message } = firstSchemaIssue(result.error)
    throw new TolerantReadError(filePath, entry, message)
  }

  return result.data
}

export async function writeJsonArtifact(filePath: string, value: unknown): Promise<void> {
  mkdirSync(path.dirname(filePath), { recursive: true })
  await writeFileAtomic(filePath, JSON.stringify(value, null, 2))
}

export async function deleteFile(filePath: string): Promise<void> {
  await rm(filePath, { force: true })
}
