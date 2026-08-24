import { diffWordsWithSpace, type Change } from 'diff'
import type { AppliedChangeContent } from '../../shared/appliedChange.js'
import { countWords } from '../../shared/storyLength.js'

/** "A little prose around" a changed passage — enough to place it, never a paragraph's worth. */
const CONTEXT_WORDS = 8

/**
 * SPEC "Applying a recommendation": where a change touches most of the
 * manuscript, showing it as passages would mean showing most of the
 * manuscript — which is keeping a copy of the story under another name. Past
 * this fraction of either side's own words, the change counts as the whole
 * rather than as passages in it. SPEC states the two cases and leaves the
 * boundary between them to the implementation; this is that boundary.
 */
const UNBOUNDED_FRACTION = 0.5

function wordsOf(parts: readonly Change[], select: (part: Change) => boolean | undefined): number {
  return parts.filter(select).reduce((sum, part) => sum + countWords(part.value), 0)
}

/** The last `maxWords` words of `text`, kept whole rather than cut mid-word. */
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

/** The first `maxWords` words of `text`, kept whole rather than cut mid-word. */
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

/**
 * Groups `diff`'s parts into hunks — a maximal run of added and removed parts
 * — each carrying the unchanged text immediately before and after it, which
 * becomes the passage's "a little prose around it". Two changes with nothing
 * unchanged between them are one hunk, since there is no boundary to place
 * between them.
 */
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

/**
 * SPEC "Applying a recommendation"/"Dependencies": `diff` produces the
 * comparison and this is the only place that reads it. It is asked only for
 * `diffWordsWithSpace`'s plain parts — never for a patch or a hunk header —
 * so there is no position-bearing shape to strip; there is simply none here
 * to begin with.
 *
 * The caller guarantees `before !== after`: this function does not check,
 * because a call with identical text is a call the applier should not have
 * made rather than a shape this function reads meaning out of.
 */
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
