import type { Edit } from '../../shared/applyResult.js'

export type EditDefect = 'unresolved' | 'emptyAnchor' | 'overlapping'

export type EditDefects = Readonly<Partial<Record<EditDefect, number>>>

export type EditResolution =
  | Readonly<{ outcome: 'resolved'; text: string }>
  | Readonly<{ outcome: 'defective'; defects: EditDefects }>

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

function spanFor(target: string, edit: Edit): Span | EditDefect {
  if (edit.find === '') {
    if (target !== '') return 'emptyAnchor'
    if ((edit.occurrence ?? 0) !== 0) return 'unresolved'
    return { start: 0, end: 0, replace: edit.replace }
  }

  const found = occurrencesOf(target, edit.find)
  const at = edit.occurrence === undefined ? (found.length === 1 ? found[0] : undefined) : found[edit.occurrence]
  if (at === undefined) return 'unresolved'
  return { start: at, end: at + edit.find.length, replace: edit.replace }
}

function overlaps(one: Span, other: Span): boolean {
  return one.start < other.end && other.start < one.end
}

function tally(defects: readonly EditDefect[]): EditDefects {
  const counts: Partial<Record<EditDefect, number>> = {}
  for (const defect of defects) counts[defect] = (counts[defect] ?? 0) + 1
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

function overlappingAmong(verdicts: readonly (Span | EditDefect)[]): ReadonlySet<number> {
  const found = new Set<number>()
  for (let i = 0; i < verdicts.length; i++) {
    const one = verdicts[i]
    if (one === undefined || typeof one === 'string') continue
    for (let j = i + 1; j < verdicts.length; j++) {
      const other = verdicts[j]
      if (other === undefined || typeof other === 'string') continue
      if (!overlaps(one, other)) continue
      found.add(i)
      found.add(j)
    }
  }
  return found
}

export function resolveEdits(target: string, edits: readonly Edit[]): EditResolution {
  const verdicts = edits.map((edit) => spanFor(target, edit))
  const overlapping = overlappingAmong(verdicts)

  const defects: EditDefect[] = []
  const spans: Span[] = []
  verdicts.forEach((verdict, index) => {
    if (typeof verdict === 'string') defects.push(verdict)
    else if (overlapping.has(index)) defects.push('overlapping')
    else spans.push(verdict)
  })

  if (defects.length > 0) return { outcome: 'defective', defects: tally(defects) }
  return { outcome: 'resolved', text: spliced(target, spans) }
}
