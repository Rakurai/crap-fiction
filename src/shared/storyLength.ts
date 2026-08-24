export function countWords(text: string): number {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' })
  let count = 0
  for (const segment of segmenter.segment(text)) {
    if (segment.isWordLike) count++
  }
  return count
}
