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
  readonly applyRecommendation: (markdown: string) => void
}

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

function applyRecommendationText(editor: Editor, text: string) {
  applySourceText(editor, text)
  editor.view.dispatch(closeHistory(editor.state.tr))
}

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
      applyRecommendationText(editor, text)
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
