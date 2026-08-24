import type { z } from 'zod'

export type SchemaIssue = Readonly<{ entry: string; message: string }>

export function firstSchemaIssue(error: z.core.$ZodError): SchemaIssue {
  const [issue] = error.issues
  if (issue === undefined) throw new Error('a ZodError carries at least one issue')
  const entry = issue.path.length > 0 ? issue.path.join('.') : '(document)'
  return { entry, message: issue.message }
}
