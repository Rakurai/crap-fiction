import type { Edit } from '../../shared/applyResult.js'

type EditDiagnosis = 'unmatched' | 'ambiguous' | 'occurrenceOutOfRange' | 'overlapping' | 'emptyAnchor'

export type EditVerdict =
  | Readonly<{ outcome: 'resolved'; find: string }>
  | Readonly<{ outcome: 'defective'; find: string; diagnosis: EditDiagnosis }>

export type DiagnosisCounts = Readonly<Partial<Record<EditDiagnosis, number>>>

type EditResolution =
  | Readonly<{ outcome: 'resolved'; text: string }>
  | Readonly<{ outcome: 'defective'; verdicts: readonly EditVerdict[] }>

type Span = Readonly<{ start: number; end: number; replace: string }>

function occurrencesOf(target: string, find: string): readonly number[] {
  const found: number[] = []
  let from = 0
  while (from <= target.length) {
    const at = target.indexOf(find, from)
    if (at === -1) break
    found.push(at)
    from = at + find.length
  }
  return found
}

function spanFor(target: string, edit: Edit): Span | EditDiagnosis {
  if (edit.find === '') {
    if (target !== '') return 'emptyAnchor'
    if (edit.occurrence !== undefined && edit.occurrence !== 0) return 'occurrenceOutOfRange'
    return { start: 0, end: 0, replace: edit.replace }
  }

  const found = occurrencesOf(target, edit.find)
  const [first] = found
  if (first === undefined) return 'unmatched'
  if (edit.occurrence === undefined) {
    if (found.length > 1) return 'ambiguous'
    return { start: first, end: first + edit.find.length, replace: edit.replace }
  }
  const at = found[edit.occurrence]
  if (at === undefined) return 'occurrenceOutOfRange'
  return { start: at, end: at + edit.find.length, replace: edit.replace }
}

function overlaps(one: Span, other: Span): boolean {
  if (one.start === other.start && one.end === other.end) return true
  return one.start < other.end && other.start < one.end
}

export function diagnosisCounts(verdicts: readonly EditVerdict[]): DiagnosisCounts {
  const counts: Partial<Record<EditDiagnosis, number>> = {}
  for (const verdict of verdicts) {
    if (verdict.outcome === 'resolved') continue
    counts[verdict.diagnosis] = (counts[verdict.diagnosis] ?? 0) + 1
  }
  return counts
}

function spliced(target: string, spans: readonly Span[]): string {
  const ordered = [...spans].sort((one, other) => one.start - other.start)
  let text = ''
  let at = 0
  for (const span of ordered) {
    text += target.slice(at, span.start) + span.replace
    at = span.end
  }
  return text + target.slice(at)
}

function overlappingAmong(resolved: readonly (Span | EditDiagnosis)[]): ReadonlySet<number> {
  const found = new Set<number>()
  for (let i = 0; i < resolved.length; i++) {
    const one = resolved[i]
    if (one === undefined || typeof one === 'string') continue
    for (let j = i + 1; j < resolved.length; j++) {
      const other = resolved[j]
      if (other === undefined || typeof other === 'string') continue
      if (!overlaps(one, other)) continue
      found.add(i)
      found.add(j)
    }
  }
  return found
}

function verdictFor(find: string, span: Span | EditDiagnosis, overlapping: boolean): EditVerdict {
  if (typeof span === 'string') return { outcome: 'defective', find, diagnosis: span }
  if (overlapping) return { outcome: 'defective', find, diagnosis: 'overlapping' }
  return { outcome: 'resolved', find }
}

export function resolveEdits(target: string, edits: readonly Edit[]): EditResolution {
  const placed = edits.map((edit) => ({ find: edit.find, span: spanFor(target, edit) }))
  const overlapping = overlappingAmong(placed.map((entry) => entry.span))
  const verdicts = placed.map((entry, index) => verdictFor(entry.find, entry.span, overlapping.has(index)))

  if (verdicts.some((verdict) => verdict.outcome === 'defective')) return { outcome: 'defective', verdicts }
  return { outcome: 'resolved', text: spliced(target, placed.flatMap((entry) => (typeof entry.span === 'string' ? [] : [entry.span]))) }
}
