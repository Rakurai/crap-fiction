import { getSchema } from '@tiptap/core'
import Bold from '@tiptap/extension-bold'
import Document from '@tiptap/extension-document'
import HardBreak from '@tiptap/extension-hard-break'
import Heading from '@tiptap/extension-heading'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import Italic from '@tiptap/extension-italic'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import type { Schema } from 'prosemirror-model'

type DocumentNodeName = 'doc' | 'paragraph' | 'text' | 'heading' | 'horizontalRule' | 'hardBreak'
type DocumentMarkName = 'bold' | 'italic'

/**
 * The manuscript's document model: the subset of TipTap's extension set that
 * round-trips through Markdown semantically (SPEC "The document schema is
 * constrained to what round-trips through Markdown semantically"). Reused
 * as-is once an editor is mounted, so the schema proven here is the schema
 * that ships.
 *
 * The line break is in the schema because it round-trips and because it is prose:
 * a broken line inside a paragraph is a thing authors write on purpose — verse, an
 * address, a line of dialogue held apart — and reading it back as a space would
 * quietly rewrite the story. Nothing else joins for that reason: a list, a table or
 * a link is structure the manuscript does not hold, and each is read as the prose
 * it contains instead.
 *
 * `getSchema` types its result as the unparameterized `Schema`, since it
 * cannot infer node and mark names from a heterogeneous extension array.
 * The extension list above is the invariant that makes this narrower type
 * true, so the cast lives here rather than at every module that reads
 * `documentSchema.nodes` or `documentSchema.marks`.
 */
export const documentSchema = getSchema([Document, Text, Paragraph, Heading, Bold, Italic, HorizontalRule, HardBreak]) as Schema<
  DocumentNodeName,
  DocumentMarkName
>
