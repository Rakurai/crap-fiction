// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useManuscript } from '../../src/client/useManuscript.js'

function typeParagraph(editor: NonNullable<ReturnType<typeof useManuscript>['editor']>, text: string) {
  editor.commands.insertContentAt(editor.state.doc.content.size - 1, text)
}

describe('useManuscript', () => {
  it('leaves undo history intact across a round trip through the source view', () => {
    const { result } = renderHook(() => useManuscript('First paragraph.'))

    act(() => typeParagraph(result.current.editor!, ' Second paragraph.'))
    expect(result.current.markdown).toContain('Second paragraph.')

    act(() => result.current.showSource())
    act(() => result.current.showRendered())
    expect(result.current.markdown).toContain('Second paragraph.') // round trip preserves meaning

    act(() => result.current.editor!.commands.undo()) // undoes the switch itself, a no-op replace
    expect(result.current.markdown).toContain('Second paragraph.')

    act(() => result.current.editor!.commands.undo()) // undoes the paragraph typed before the switch
    expect(result.current.markdown).not.toContain('Second paragraph.')
  })

  it('reaches the editor as one transaction on return from source, regardless of timing', () => {
    const { result } = renderHook(() => useManuscript('Hello.'))
    const editor = result.current.editor!

    act(() => typeParagraph(editor, ' World.'))
    act(() => result.current.showSource()) // no delay before showRendered — a fast round trip
    act(() => result.current.showRendered())

    act(() => editor.commands.undo())
    expect(result.current.markdown).toContain('World.') // the switch alone was undone

    act(() => editor.commands.undo())
    expect(result.current.markdown).not.toContain('World.') // now the earlier edit is undone
  })

  it('captures the outgoing scroll ratio and restores it on the incoming view without the caller sequencing anything', () => {
    // renderHook's `result.current` only settles after the passive-effect
    // phase, which runs after the hook's own layout effect that this test
    // exercises — so the current view is tracked from the render itself.
    let latestView = 'rendered'
    const { result } = renderHook(() => {
      const manuscript = useManuscript('Some prose.')
      latestView = manuscript.view
      return manuscript
    })
    const container = document.createElement('div')
    // The source and rendered views are different DOM content with different
    // heights; jsdom does no layout, so the heights are modelled explicitly.
    Object.defineProperty(container, 'scrollHeight', {
      configurable: true,
      get: () => (latestView === 'source' ? 400 : 200),
    })
    Object.defineProperty(container, 'scrollTop', { value: 100, writable: true, configurable: true })
    act(() => {
      result.current.containerRef.current = container
    })

    act(() => result.current.showSource()) // captures ratio 0.5 against the outgoing (rendered) height of 200

    expect(container.scrollTop).toBe(200) // ratio 0.5 reapplied against the incoming (source) height of 400
  })
})
