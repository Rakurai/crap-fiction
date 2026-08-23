import { getSchema } from '@tiptap/core'
import Bold from '@tiptap/extension-bold'
import Document from '@tiptap/extension-document'
import Heading from '@tiptap/extension-heading'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import Italic from '@tiptap/extension-italic'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import type { Schema } from 'prosemirror-model'

type DocumentNodeName = 'doc' | 'paragraph' | 'text' | 'heading' | 'horizontalRule'
type DocumentMarkName = 'bold' | 'italic'

/**
 * The manuscript's document model: the subset of TipTap's extension set that
 * round-trips through Markdown semantically (SPEC "The document schema is
 * constrained to what round-trips through Markdown semantically"). Reused
 * as-is once an editor is mounted, so the schema proven here is the schema
 * that ships.
 *
 * `getSchema` types its result as the unparameterized `Schema`, since it
 * cannot infer node and mark names from a heterogeneous extension array.
 * The extension list above is the invariant that makes this narrower type
 * true, so the cast lives here rather than at every module that reads
 * `documentSchema.nodes` or `documentSchema.marks`.
 */
export const documentSchema = getSchema([Document, Text, Paragraph, Heading, Bold, Italic, HorizontalRule]) as Schema<
  DocumentNodeName,
  DocumentMarkName
>
