import type { z } from 'zod'

export type SchemaIssue = Readonly<{ entry: string; message: string }>

/**
 * The one place a failed `safeParse` is described. A `ZodError` always
 * carries at least one issue and every issue always carries a message, so
 * nothing here stands in for an absent one — the guard exists only to
 * satisfy `noUncheckedIndexedAccess`, not to supply a value the schema
 * itself did not produce.
 */
export function firstSchemaIssue(error: z.core.$ZodError): SchemaIssue {
  const [issue] = error.issues
  if (issue === undefined) throw new Error('a ZodError carries at least one issue')
  const entry = issue.path.length > 0 ? issue.path.join('.') : '(document)'
  return { entry, message: issue.message }
}
