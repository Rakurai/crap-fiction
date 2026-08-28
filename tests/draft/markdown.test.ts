import { describe, expect, it } from 'vitest'
import { canonicalMarkdown, documentToMarkdown, editorContentToMarkdown, markdownToDocument, markdownToEditorContent } from '../../src/document/markdown.js'
import { documentSchema } from '../../src/document/schema.js'

const { doc, paragraph, heading, horizontalRule, hardBreak } = documentSchema.nodes
const { bold, italic } = documentSchema.marks
const text = documentSchema.text.bind(documentSchema)

function roundTripsThrough(built: ReturnType<typeof doc.createChecked>): void {
  const markdown = documentToMarkdown(built)
  const reparsed = markdownToDocument(markdown)
  expect(reparsed.toJSON()).toEqual(built.toJSON())
}

describe('markdown round-trip over the constrained schema', () => {
  it('round-trips a paragraph with strong and emphasis', () => {
    const built = doc.createChecked(null, [
      paragraph.createChecked(null, [
        text('plain, '),
        text('strong', [bold.create()]),
        text(', and '),
        text('emphatic', [italic.create()]),
        text('.'),
      ]),
    ])
    roundTripsThrough(built)
  })

  it('round-trips headings at every admitted level', () => {
    const built = doc.createChecked(
      null,
      [1, 2, 3, 4, 5, 6].map((level) => heading.createChecked({ level }, [text(`Level ${level}`)])),
    )
    roundTripsThrough(built)
  })

  it('round-trips a thematic break between paragraphs', () => {
    const built = doc.createChecked(null, [
      paragraph.createChecked(null, [text('before the break')]),
      horizontalRule.createChecked(),
      paragraph.createChecked(null, [text('after the break')]),
    ])
    roundTripsThrough(built)
  })

  it('round-trips overlapping strong and emphasis in one run', () => {
    const built = doc.createChecked(null, [
      paragraph.createChecked(null, [text('both', [bold.create(), italic.create()])]),
    ])
    roundTripsThrough(built)
  })

  it('round-trips real Markdown combining every admitted construct', () => {
    const source = [
      '# Chapter One',
      '',
      'The *cups* rattled, and the **saucer** cracked.',
      '',
      '---',
      '',
      '## A quieter scene',
      '',
      'Nothing else happened that night.',
      '',
    ].join('\n')

    const once = markdownToDocument(source)
    const twice = markdownToDocument(documentToMarkdown(once))
    expect(twice.toJSON()).toEqual(once.toJSON())

    expect(once.child(0).type.name).toBe('heading')
    expect(once.child(0).attrs.level).toBe(1)
    expect(once.child(1).type.name).toBe('paragraph')
    expect(once.child(1).textContent).toBe('The cups rattled, and the saucer cracked.')
    expect(once.child(2).type.name).toBe('horizontalRule')
    expect(once.child(3).type.name).toBe('heading')
    expect(once.child(3).attrs.level).toBe(2)
  })

  it('opens a bulleted list as the prose it contains', () => {
    const source = '- first cup\n- second cup\n- third cup\n'
    const result = markdownToDocument(source)

    expect(result.childCount).toBe(3)
    for (const child of [result.child(0), result.child(1), result.child(2)]) {
      expect(child.type.name).toBe('paragraph')
    }
    expect(result.child(0).textContent).toBe('first cup')
    expect(result.child(1).textContent).toBe('second cup')
    expect(result.child(2).textContent).toBe('third cup')
  })

  it('opens an ordered list and a block quote as their prose, not refusing them', () => {
    const source = '1. one\n2. two\n\n> a remembered line\n'
    const result = markdownToDocument(source)

    expect(result.childCount).toBe(3)
    expect(result.child(0).textContent).toBe('one')
    expect(result.child(1).textContent).toBe('two')
    expect(result.child(2).textContent).toBe('a remembered line')
    for (let i = 0; i < result.childCount; i++) {
      expect(result.child(i).type.name).toBe('paragraph')
    }
  })

  it('opens a link as its text, dropping the address rather than the words', () => {
    const result = markdownToDocument('Read the [full letter](https://example.com/letter) before you answer.')

    expect(result.child(0).textContent).toBe('Read the full letter before you answer.')
    expect(result.child(0).marks?.length ?? 0).toBe(0)
  })

  it('opens an image as the alt text it carries', () => {
    const result = markdownToDocument('A photograph: ![her at the window](photo.png) is all that remains.')

    expect(result.child(0).textContent).toBe('A photograph: her at the window is all that remains.')
  })

  it('opens inline code as the plain text it carries', () => {
    const result = markdownToDocument('Run `npm test` before you commit.')

    expect(result.child(0).textContent).toBe('Run npm test before you commit.')
  })

  it('reads a hard line break as itself, not as a space', () => {
    const result = markdownToDocument('the first line\\\nthe second\n')
    const only = result.child(0)

    expect(result.childCount).toBe(1)
    expect(only.type.name).toBe('paragraph')
    expect(only.childCount).toBe(3)
    expect(only.child(1).type.name).toBe('hardBreak')
    expect(only.child(0).text).toBe('the first line')
    expect(only.child(2).text).toBe('the second')
  })

  it('round-trips a hard line break inside a paragraph', () => {
    const built = doc.createChecked(null, [
      paragraph.createChecked(null, [text('Wilfred Owen, 1917'), hardBreak.createChecked(), text('and nobody since')]),
    ])
    roundTripsThrough(built)
  })

  it('drops a hard line break with nothing after it', () => {
    const built = doc.createChecked(null, [
      paragraph.createChecked(null, [text('a line, and then the page ends'), hardBreak.createChecked()]),
    ])

    const markdown = documentToMarkdown(built)
    expect(markdown).toBe('a line, and then the page ends')
    expect(markdownToDocument(markdown).child(0).childCount).toBe(1)
  })

  it('opens a table as the prose of its cells, refusing nothing', () => {
    const source = ['| who | wanted |', '| --- | --- |', '| Ada | the ending |', ''].join('\n')
    const result = markdownToDocument(source)

    expect(result.textContent).toContain('Ada')
    expect(result.textContent).toContain('the ending')
    for (let i = 0; i < result.childCount; i++) {
      expect(result.child(i).type.name).toBe('paragraph')
    }
  })

  it('opens raw HTML as the literal text it is written as', () => {
    const result = markdownToDocument('She said <em>nothing</em> at all.\n')

    expect(result.child(0).textContent).toBe('She said <em>nothing</em> at all.')
    expect(result.child(0).child(0).marks.length).toBe(0)
  })

  it('opens YAML front matter as the prose it contains', () => {
    const source = ['---', 'title: The Ending', '---', '', 'The first line of the piece.', ''].join('\n')
    const result = markdownToDocument(source)

    expect(result.child(0).type.name).toBe('horizontalRule')
    expect(result.textContent).toContain('title: The Ending')
    expect(result.textContent).toContain('The first line of the piece.')
  })

  it('writes back a manuscript with the address, the image and the code fencing gone', () => {
    const source = 'Read the [full letter](https://example.com/letter), see ![her](photo.png), and <b>note</b> `this`.\n'

    const written = documentToMarkdown(markdownToDocument(source))

    for (const gone of ['](', '![', '`']) {
      expect(written).not.toContain(gone)
    }
    expect(written).toBe('Read the full letter, see her, and <b>note</b> this.')
  })

  it('reads equivalent spellings of the same prose into the one spelling the serializer writes, and leaves that one alone', () => {
    const written = canonicalMarkdown('She left them *there*.\n\nBoth cups.\n')

    expect(written).toBe('She left them _there_.\n\nBoth cups.')
    expect(canonicalMarkdown(written)).toBe(written)
  })

  it('round-trips through the editor-content bridge the same way as the document model', () => {
    const source = '# Chapter One\n\nThe *cups* rattled, and the **saucer** cracked.\n'
    const content = markdownToEditorContent(source)
    expect(editorContentToMarkdown(content)).toBe(documentToMarkdown(markdownToDocument(source)))
  })
})
