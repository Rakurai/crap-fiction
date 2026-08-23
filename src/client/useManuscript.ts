import { Bold } from '@tiptap/extension-bold'
import { Document } from '@tiptap/extension-document'
import { Heading } from '@tiptap/extension-heading'
import { History } from '@tiptap/extension-history'
import { HorizontalRule } from '@tiptap/extension-horizontal-rule'
import { Italic } from '@tiptap/extension-italic'
import { Paragraph } from '@tiptap/extension-paragraph'
import { Text } from '@tiptap/extension-text'
import { closeHistory } from '@tiptap/pm/history'
import { useEditor, type Editor } from '@tiptap/react'
import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react'
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
  readonly markdown: string
  readonly containerRef: RefObject<HTMLDivElement | null>
  readonly setSourceText: (text: string) => void
  readonly showRendered: () => void
  readonly showSource: () => void
  readonly showReading: () => void
  /**
   * CONTEXT "Apply": makes the manuscript embody a recommendation, applied to
   * the editor as one transaction so the editor's own undo reverses it as one
   * action — the same mechanism a round trip through the source view already
   * reaches the editor with, reused rather than reinvented.
   */
  readonly applyRecommendation: (markdown: string) => void
}

/**
 * Replaces the editor's content with the source text's meaning as one
 * transaction, and places a history boundary on it explicitly rather than
 * relying on the editor's own idle-time grouping — which the SPEC calls
 * trivial machinery, not custom machinery, and which would otherwise let a
 * fast round trip merge into whatever the author typed just before it.
 */
function applySourceText(editor: Editor, text: string) {
  editor
    .chain()
    .setContent(markdownToEditorContent(text), { emitUpdate: true })
    .command(({ tr }) => {
      closeHistory(tr)
      return true
    })
    .run()
}

/**
 * Owns the one thing SPEC "The prose surface" asks of the editing surface
 * beyond what TipTap already carries: which of the three ways to see the
 * manuscript is current, and moving between them without losing meaning or
 * the reading/scroll position. Selection, clipboard, history and formatting
 * stay the editor's own. Each `showX` is the one call a caller makes to
 * enter that view — it captures the outgoing scroll ratio and restores it
 * itself, so nothing outside this hook sequences the switch.
 */
export function useManuscript(initialMarkdown: string): ManuscriptViewModel {
  const [view, setView] = useState<ManuscriptView>('rendered')
  const [sourceText, setSourceText] = useState('')
  const [length, setLength] = useState(() => countWords(initialMarkdown))
  const [markdown, setMarkdown] = useState(initialMarkdown)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const pendingScrollRatio = useRef<number | null>(null)

  useLayoutEffect(() => {
    const container = containerRef.current
    const ratio = pendingScrollRatio.current
    if (container === null || ratio === null) return
    container.scrollTop = ratio * container.scrollHeight
    pendingScrollRatio.current = null
  }, [view])

  const captureScrollRatio = useCallback(() => {
    const container = containerRef.current
    pendingScrollRatio.current = container !== null && container.scrollHeight > 0 ? container.scrollTop / container.scrollHeight : 0
  }, [])

  const editor = useEditor({
    extensions: EXTENSIONS,
    // The rendered view's editing surface says what it is the way the source
    // view's textarea does by being one: a named, multi-line text field. A bare
    // contenteditable division is a division as far as anything reading the
    // page is concerned, so the prose surface would be addressable only by
    // where it sits — by assistive technology, and by anything else that
    // reaches the studio the way an author does.
    editorProps: { attributes: { role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Manuscript' } },
    content: markdownToEditorContent(initialMarkdown),
    onUpdate: ({ editor: current }) => {
      setLength(countWords(current.getText({ blockSeparator: '\n\n' })))
      setMarkdown(editorContentToMarkdown(current.getJSON()))
    },
  })

  const updateSourceText = useCallback((text: string) => {
    setSourceText(text)
    setLength(countWords(text))
    setMarkdown(text)
  }, [])

  const showRendered = useCallback(() => {
    if (editor === null) return
    captureScrollRatio()
    if (view === 'source') {
      applySourceText(editor, sourceText)
    } else {
      editor.setEditable(true)
    }
    setView('rendered')
  }, [editor, view, sourceText, captureScrollRatio])

  const showSource = useCallback(() => {
    if (editor === null || view === 'source') return
    captureScrollRatio()
    setSourceText(editorContentToMarkdown(editor.getJSON()))
    setView('source')
  }, [editor, view, captureScrollRatio])

  const showReading = useCallback(() => {
    if (editor === null) return
    captureScrollRatio()
    if (view === 'source') {
      applySourceText(editor, sourceText)
    }
    editor.setEditable(false)
    setView('reading')
  }, [editor, view, sourceText, captureScrollRatio])

  const applyRecommendation = useCallback(
    (text: string) => {
      if (editor === null) return
      applySourceText(editor, text)
      if (view === 'source') setSourceText(text)
    },
    [editor, view],
  )

  return {
    editor,
    view,
    sourceText,
    length,
    markdown,
    containerRef,
    setSourceText: updateSourceText,
    showRendered,
    showSource,
    showReading,
    applyRecommendation,
  }
}
