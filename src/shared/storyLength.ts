/**
 * SPEC dependency roster: story length is counted with the platform's
 * `Intl.Segmenter` rather than a whitespace split, so word boundaries follow
 * Unicode rules instead of this repository's own guess at one.
 */
export function countWords(text: string): number {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' })
  let count = 0
  for (const segment of segmenter.segment(text)) {
    if (segment.isWordLike) count++
  }
  return count
}
