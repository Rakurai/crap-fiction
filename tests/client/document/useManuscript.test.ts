import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useManuscript } from '../../../src/client/useManuscript.js'

type Editor = NonNullable<ReturnType<typeof useManuscript>['editor']>

function editorOf(manuscript: ReturnType<typeof useManuscript>): Editor {
  const { editor } = manuscript
  if (editor === null) throw new Error('the editor did not mount')
  return editor
}

function typeParagraph(editor: Editor, text: string) {
  editor.commands.insertContentAt(editor.state.doc.content.size - 1, text)
}

describe('useManuscript', () => {
  it('leaves undo history intact across a round trip through the source view', () => {
    const { result } = renderHook(() => useManuscript('First paragraph.'))

    act(() => typeParagraph(editorOf(result.current), ' Second paragraph.'))
    expect(result.current.markdown).toContain('Second paragraph.')

    act(() => result.current.showSource())
    act(() => result.current.showRendered())
    expect(result.current.markdown).toContain('Second paragraph.')

    act(() => editorOf(result.current).commands.undo())
    expect(result.current.markdown).toContain('Second paragraph.')

    act(() => editorOf(result.current).commands.undo())
    expect(result.current.markdown).not.toContain('Second paragraph.')
  })

  it('applies a recommendation as one transaction, the same as a round trip through the source view', () => {
    const { result } = renderHook(() => useManuscript('First paragraph.'))

    act(() => typeParagraph(editorOf(result.current), ' Second paragraph.'))
    expect(result.current.markdown).toContain('Second paragraph.')

    act(() => result.current.applyRecommendation('First paragraph. Second paragraph. Third paragraph.'))
    expect(result.current.markdown).toContain('Third paragraph.')

    act(() => editorOf(result.current).commands.undo())
    expect(result.current.markdown).not.toContain('Third paragraph.')
    expect(result.current.markdown).toContain('Second paragraph.')

    act(() => editorOf(result.current).commands.undo())
    expect(result.current.markdown).not.toContain('Second paragraph.')
  })

  it('bounds an application on both sides, so prose typed after it undoes separately', () => {
    const { result } = renderHook(() => useManuscript('First paragraph.'))

    act(() => result.current.applyRecommendation('First paragraph. Second paragraph.'))
    expect(result.current.markdown).toContain('Second paragraph.')

    act(() => typeParagraph(editorOf(result.current), ' Third paragraph.'))
    expect(result.current.markdown).toContain('Third paragraph.')

    act(() => editorOf(result.current).commands.undo())
    expect(result.current.markdown).not.toContain('Third paragraph.')
    expect(result.current.markdown).toContain('Second paragraph.')

    act(() => editorOf(result.current).commands.undo())
    expect(result.current.markdown).not.toContain('Second paragraph.')
  })

  it('captures the outgoing scroll ratio and restores it on the incoming view without the caller sequencing anything', () => {
    // `result.current` settles only after the passive-effect phase, which runs after the
    // layout effect under test, so the view is tracked from the render itself.
    let latestView = 'rendered'
    const { result } = renderHook(() => {
      const manuscript = useManuscript('Some prose.')
      latestView = manuscript.view
      return manuscript
    })
    const container = document.createElement('div')
    Object.defineProperty(container, 'scrollHeight', {
      configurable: true,
      get: () => (latestView === 'source' ? 400 : 200),
    })
    Object.defineProperty(container, 'scrollTop', { value: 100, writable: true, configurable: true })
    act(() => {
      result.current.containerRef.current = container
    })

    act(() => result.current.showSource())

    expect(container.scrollTop).toBe(200)
  })
})
