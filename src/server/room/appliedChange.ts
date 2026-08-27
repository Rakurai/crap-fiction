import { diffWordsWithSpace, type Change } from 'diff'
import type { AppliedChangeContent } from '../../shared/appliedChange.js'
import { countWords } from '../../shared/storyLength.js'
import { loadConfig } from '../config.js'

const { contextWords: CONTEXT_WORDS, unboundedFraction: UNBOUNDED_FRACTION } = loadConfig().appliedChange

function wordsOf(parts: readonly Change[], select: (part: Change) => boolean | undefined): number {
  return parts.filter(select).reduce((sum, part) => sum + countWords(part.value), 0)
}

function tailWords(text: string, maxWords: number): string {
  const segments = [...new Intl.Segmenter(undefined, { granularity: 'word' }).segment(text)]
  let seen = 0
  let from = text.length
  for (let i = segments.length - 1; i >= 0; i--) {
    const segment = segments[i]
    if (segment === undefined) break
    from = segment.index
    if (segment.isWordLike) seen++
    if (seen >= maxWords) break
  }
  return text.slice(from)
}

function headWords(text: string, maxWords: number): string {
  const segments = [...new Intl.Segmenter(undefined, { granularity: 'word' }).segment(text)]
  let seen = 0
  let to = 0
  for (const segment of segments) {
    to = segment.index + segment.segment.length
    if (segment.isWordLike) seen++
    if (seen >= maxWords) break
  }
  return text.slice(0, to)
}

type Hunk = { removed: string; added: string; leading: string; trailing: string }

function hunksFrom(parts: readonly Change[]): readonly Hunk[] {
  const hunks: Hunk[] = []
  let i = 0
  while (i < parts.length) {
    const part = parts[i]
    if (part === undefined || (!part.added && !part.removed)) {
      i++
      continue
    }

    let removed = ''
    let added = ''
    let j = i
    while (j < parts.length) {
      const candidate = parts[j]
      if (candidate === undefined || (!candidate.added && !candidate.removed)) break
      if (candidate.removed) removed += candidate.value
      else added += candidate.value
      j++
    }

    const before = parts[i - 1]
    const after = parts[j]
    hunks.push({
      removed,
      added,
      leading: before !== undefined && !before.added && !before.removed ? tailWords(before.value, CONTEXT_WORDS) : '',
      trailing: after !== undefined && !after.added && !after.removed ? headWords(after.value, CONTEXT_WORDS) : '',
    })
    i = j
  }
  return hunks
}

export function computeAppliedChangeContent(before: string, after: string): AppliedChangeContent {
  const parts = diffWordsWithSpace(before, after)

  const beforeWords = countWords(before)
  const afterWords = countWords(after)
  const removedWords = wordsOf(parts, (part) => part.removed)
  const addedWords = wordsOf(parts, (part) => part.added)

  const unbounded =
    (beforeWords > 0 && removedWords / beforeWords > UNBOUNDED_FRACTION) ||
    (afterWords > 0 && addedWords / afterWords > UNBOUNDED_FRACTION)

  if (unbounded) return { kind: 'rewrittenWhole' }

  const passages = hunksFrom(parts).map((hunk) => ({
    before: hunk.leading + hunk.removed + hunk.trailing,
    after: hunk.leading + hunk.added + hunk.trailing,
  }))

  return { kind: 'passages', passages }
}
