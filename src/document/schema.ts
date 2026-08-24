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

// `getSchema` returns an unparameterized `Schema`; the extension list is what makes the cast true.
export const documentSchema = getSchema([Document, Text, Paragraph, Heading, Bold, Italic, HorizontalRule, HardBreak]) as Schema<
  DocumentNodeName,
  DocumentMarkName
>
