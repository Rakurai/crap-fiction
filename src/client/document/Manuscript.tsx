import { useEffect, useRef, useSyncExternalStore } from 'react'
import { Box } from '@mui/material'
import History from '@tiptap/extension-history'
import { closeHistory } from '@tiptap/pm/history'
import { EditorContent, useEditor } from '@tiptap/react'
import { editorContentToMarkdown, markdownToEditorContent } from '../../document/markdown.js'
import { documentExtensions } from '../../document/schema.js'
import type { DocumentSession } from '../pieceSession/documentSession.js'
import type { DocumentPresentation } from '../shell/state.js'
import { PROSE_MEASURE, proseRegister } from '../theme/registers.js'

const MANUSCRIPT_EXTENSIONS = [...documentExtensions, History]

export type ManuscriptProps = Readonly<{
  document: DocumentSession
  presentation: DocumentPresentation
  editable: boolean
}>

export function Manuscript({ document, presentation, editable }: ManuscriptProps) {
  const wasRendered = useRef(presentation === 'rendered')

  const editor = useEditor(
    {
      extensions: MANUSCRIPT_EXTENSIONS,
      content: markdownToEditorContent(document.getText()),
      editable,
      onUpdate: ({ editor: instance }) => document.setText(editorContentToMarkdown(instance.getJSON())),
    },
    [],
  )

  useEffect(() => {
    const enteringRendered = presentation === 'rendered' && !wasRendered.current
    wasRendered.current = presentation === 'rendered'
    if (!enteringRendered) return
    editor.commands.setContent(markdownToEditorContent(document.getText()), { emitUpdate: false })
  }, [presentation, editor, document])

  useEffect(() => {
    editor.setEditable(editable, false)
  }, [editor, editable])

  useEffect(
    () =>
      document.registerInstaller((replacement) => {
        editor
          .chain()
          .command(({ tr }) => {
            closeHistory(tr)
            return true
          })
          .setContent(markdownToEditorContent(replacement))
          .run()
        editor.view.dispatch(closeHistory(editor.state.tr))
      }),
    [document, editor],
  )

  return (
    <Box sx={{ height: '100%', width: '100%', overflowY: 'auto', containerType: 'inline-size' }}>
      <Box
        sx={(theme) => ({
          maxWidth: PROSE_MEASURE,
          width: '100%',
          mx: 'auto',
          px: 2,
          py: 4,
          opacity: editable ? 1 : 0.6,
          [theme.containerQueries.up('sm')]: { px: 6 },
          ...proseRegister,
          '& .tiptap': { outline: 'none' },
        })}
      >
        {presentation === 'rendered' ? <EditorContent editor={editor} /> : <SourceView document={document} editable={editable} />}
      </Box>
    </Box>
  )
}

function SourceView({ document, editable }: Readonly<{ document: DocumentSession; editable: boolean }>) {
  const text = useSyncExternalStore(document.subscribeText, document.getText)
  return (
    <Box
      component="textarea"
      value={text}
      onChange={(event) => document.setText(event.target.value)}
      readOnly={!editable}
      sx={{
        display: 'block',
        width: '100%',
        minHeight: '100%',
        border: 'none',
        outline: 'none',
        resize: 'none',
        background: 'transparent',
        color: 'inherit',
        font: 'inherit',
        p: 0,
      }}
    />
  )
}
