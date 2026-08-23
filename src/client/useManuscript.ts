import { Bold } from '@tiptap/extension-bold'
import { Document } from '@tiptap/extension-document'
import { Heading } from '@tiptap/extension-heading'
import { History } from '@tiptap/extension-history'
import { HorizontalRule } from '@tiptap/extension-horizontal-rule'
import { Italic } from '@tiptap/extension-italic'
import { Paragraph } from '@tiptap/extension-paragraph'
import { Text } from '@tiptap/extension-text'
import { useEditor, type Editor } from '@tiptap/react'
import { useCallback, useState } from 'react'
import { editorContentToMarkdown, markdownToEditorContent } from '../document/markdown.js'
import { countWords } from '../shared/storyLength.js'

/**
 * The extension set is the interactive twin of `documentSchema`
 * (src/document/schema.ts): the same node and mark types, plus History,
 * which contributes editor behaviour rather than a schema type. Nothing
 * here parses or serializes Markdown by hand — that stays behind
 * `markdownToEditorContent`/`editorContentToMarkdown`, so a `Node` built by
 * one schema instance never crosses into an editor built from another.
 */
const EXTENSIONS = [Document, Text, Paragraph, Heading, Bold, Italic, HorizontalRule, History]

export type ManuscriptView = 'rendered' | 'source' | 'reading'

export type ManuscriptViewModel = {
  readonly editor: Editor | null
  readonly view: ManuscriptView
  readonly sourceText: string
  readonly length: number
  readonly setSourceText: (text: string) => void
  readonly showRendered: () => void
  readonly showSource: () => void
  readonly showReading: () => void
}

/**
 * Owns the one thing SPEC "The prose surface" asks of the editing surface
 * beyond what TipTap already carries: which of the three ways to see the
 * manuscript is current, and moving between them without losing meaning.
 * Selection, clipboard, history and formatting stay the editor's own.
 */
export function useManuscript(initialMarkdown: string): ManuscriptViewModel {
  const [view, setView] = useState<ManuscriptView>('rendered')
  const [sourceText, setSourceText] = useState('')
  const [length, setLength] = useState(() => countWords(initialMarkdown))

  const editor = useEditor({
    extensions: EXTENSIONS,
    content: markdownToEditorContent(initialMarkdown),
    onUpdate: ({ editor: current }) => {
      setLength(countWords(current.getText({ blockSeparator: '\n\n' })))
    },
  })

  const updateSourceText = useCallback((text: string) => {
    setSourceText(text)
    setLength(countWords(text))
  }, [])

  const showRendered = useCallback(() => {
    if (editor === null) return
    if (view === 'source') {
      editor.commands.setContent(markdownToEditorContent(sourceText), { emitUpdate: true })
    } else {
      editor.setEditable(true)
    }
    setView('rendered')
  }, [editor, view, sourceText])

  const showSource = useCallback(() => {
    if (editor === null || view === 'source') return
    setSourceText(editorContentToMarkdown(editor.getJSON()))
    setView('source')
  }, [editor, view])

  const showReading = useCallback(() => {
    if (editor === null) return
    if (view === 'source') {
      editor.commands.setContent(markdownToEditorContent(sourceText), { emitUpdate: true })
    }
    editor.setEditable(false)
    setView('reading')
  }, [editor, view, sourceText])

  return { editor, view, sourceText, length, setSourceText: updateSourceText, showRendered, showSource, showReading }
}
