import { History } from '@tiptap/extension-history'
import { closeHistory } from '@tiptap/pm/history'
import { useEditor, type Editor } from '@tiptap/react'
import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { editorContentToMarkdown, markdownToEditorContent } from '../document/markdown.js'
import { documentExtensions } from '../document/schema.js'
import { countWords } from '../shared/storyLength.js'

const EXTENSIONS = [...documentExtensions, History]

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
  readonly applyRecommendation: (markdown: string) => () => void
}

function applySourceText(editor: Editor, text: string) {
  editor
    .chain()
    .setContent(markdownToEditorContent(text), { emitUpdate: true, errorOnInvalidContent: true })
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
    enableContentCheck: true,
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
    (text: string): (() => void) => {
      if (editor === null) return () => {}
      const previousSourceText = sourceText
      const wasSourceView = view === 'source'
      applyRecommendationText(editor, text)
      if (wasSourceView) setSourceText(text)
      return () => {
        editor.commands.undo()
        if (wasSourceView) setSourceText(previousSourceText)
      }
    },
    [editor, view, sourceText],
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
