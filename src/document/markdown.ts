import type { JSONContent } from '@tiptap/core'
import MarkdownIt, { type MarkdownIt as MarkdownItInstance, type StateCore } from 'markdown-it'
import { MarkdownParser, MarkdownSerializer } from 'prosemirror-markdown'
import type { Node } from 'prosemirror-model'
import { documentSchema } from './schema.js'

function tolerateUnadmittedLeaves(state: StateCore): void {
  for (const token of state.tokens) {
    if (token.type !== 'inline' || !token.children) continue
    for (const child of token.children) {
      if (child.type === 'image' || child.type === 'code_inline') {
        child.type = 'text'
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
  hardbreak: { node: 'hardBreak' },
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
    // A backslash is the only hard-break spelling that survives a round trip;
    // two trailing spaces are stripped by anything that trims lines.
    hardBreak(state, node, parent, index) {
      for (let after = index + 1; after < parent.childCount; after++) {
        if (parent.child(after).type !== node.type) {
          state.write('\\\n')
          return
        }
      }
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

export function markdownToDocument(markdown: string): Node {
  return parser.parse(markdown)
}

export function documentToMarkdown(document: Node): string {
  return serializer.serialize(document)
}

/** The spelling this serializer writes, whichever equivalent Markdown the same prose arrived as. */
export function canonicalMarkdown(markdown: string): string {
  return documentToMarkdown(markdownToDocument(markdown))
}

export function markdownToEditorContent(markdown: string): JSONContent {
  return markdownToDocument(markdown).toJSON()
}

export function editorContentToMarkdown(content: JSONContent): string {
  return documentToMarkdown(documentSchema.nodeFromJSON(content))
}
