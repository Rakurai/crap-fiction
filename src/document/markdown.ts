import type { JSONContent } from '@tiptap/core'
import MarkdownIt, { type MarkdownIt as MarkdownItInstance, type StateCore } from 'markdown-it'
import { MarkdownParser, MarkdownSerializer } from 'prosemirror-markdown'
import type { Node } from 'prosemirror-model'
import { documentSchema } from './schema.js'

/**
 * Constructs not in the document schema are read as the prose they contain
 * rather than refused (SPEC "Markdown source offering one of them is read
 * as the prose it contains rather than refused"). This is the enumerated,
 * closed list of tolerances, applied at this parsing seam only:
 *
 * - lists and block quotes lose their wrapper; their paragraphs remain
 * - links lose their href; their text remains
 * - images and inline code become the plain text they carry (alt, code)
 * - a hard break becomes a word-separating space, matching a soft break
 * - raw HTML is inert with `html: false`, so it reads as literal text
 */
function tolerateUnadmittedLeaves(state: StateCore): void {
  for (const token of state.tokens) {
    if (token.type !== 'inline' || !token.children) continue
    for (const child of token.children) {
      if (child.type === 'image' || child.type === 'code_inline') {
        child.type = 'text'
      } else if (child.type === 'hardbreak') {
        child.type = 'text'
        child.content = ' '
      }
    }
  }
}

function createTokenizer(): MarkdownItInstance {
  const tokenizer = MarkdownIt('commonmark', { html: false })
  tokenizer.core.ruler.push('tolerateUnadmittedLeaves', tolerateUnadmittedLeaves)
  return tokenizer
}

const parser = new MarkdownParser(documentSchema, createTokenizer(), {
  paragraph: { block: 'paragraph' },
  heading: { block: 'heading', getAttrs: (tok) => ({ level: Number(tok.tag.slice(1)) }) },
  hr: { node: 'horizontalRule' },
  em: { mark: 'italic' },
  strong: { mark: 'bold' },
  bullet_list: { ignore: true },
  ordered_list: { ignore: true },
  list_item: { ignore: true },
  blockquote: { ignore: true },
  link: { ignore: true },
})

const serializer = new MarkdownSerializer(
  {
    doc(state, node) {
      state.renderContent(node)
    },
    paragraph(state, node) {
      state.renderInline(node)
      state.closeBlock(node)
    },
    heading(state, node) {
      state.write(`${state.repeat('#', Number(node.attrs.level))} `)
      state.renderInline(node, false)
      state.closeBlock(node)
    },
    horizontalRule(state, node) {
      state.write('---')
      state.closeBlock(node)
    },
    text(state, node) {
      state.text(node.text ?? '')
    },
  },
  {
    bold: { open: '**', close: '**', mixable: true, expelEnclosingWhitespace: true },
    italic: { open: '_', close: '_', mixable: true, expelEnclosingWhitespace: true },
  },
)

/** Parses Markdown into the manuscript's document model. */
export function markdownToDocument(markdown: string): Node {
  return parser.parse(markdown)
}

/** Serializes the manuscript's document model back into Markdown. */
export function documentToMarkdown(document: Node): string {
  return serializer.serialize(document)
}

/**
 * The editor integration's own view of the manuscript: TipTap's `content`
 * option and `getJSON()` both traffic in this shape rather than a
 * ProseMirror `Node`, so the seam between the document model and the editor
 * is JSON, never a `Node` built by one schema instance handed to another's.
 */
export function markdownToEditorContent(markdown: string): JSONContent {
  return markdownToDocument(markdown).toJSON()
}

export function editorContentToMarkdown(content: JSONContent): string {
  return documentToMarkdown(documentSchema.nodeFromJSON(content))
}
