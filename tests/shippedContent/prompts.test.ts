import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FragmentVariableMismatchError, loadPromptFragments, parseFragment, renderFragment } from '../../src/server/model/prompts.js'
import { ShippedDataError } from '../../src/server/store/index.js'

describe('a fragment', () => {
  it('fails naming itself when its declared variables disagree with its template placeholders, or with the values supplied at render time', () => {
    expect(() => parseFragment('sections/broken', ['manuscript'], 'no placeholder names the declared variable')).toThrowError(
      FragmentVariableMismatchError,
    )
    expect(() => parseFragment('sections/broken', ['manuscript'], 'no placeholder names the declared variable')).toThrowError(/sections\/broken/)

    const manuscript = parseFragment('sections/manuscript', ['manuscript'], '{{manuscript}}')
    expect(() => renderFragment(manuscript, {})).toThrowError(FragmentVariableMismatchError)
    expect(() => renderFragment(manuscript, {})).toThrowError(/sections\/manuscript/)
    expect(() => renderFragment(manuscript, { manuscript: 'text', extra: 'unwanted' })).toThrowError(/sections\/manuscript/)
  })
})

describe('loadPromptFragments', () => {
  let contentRoot: string

  beforeEach(() => {
    contentRoot = mkdtempSync(path.join(tmpdir(), 'studio-content-'))
    mkdirSync(path.join(contentRoot, 'prompts', 'sections'), { recursive: true })
  })

  afterEach(() => {
    rmSync(contentRoot, { recursive: true, force: true })
  })

  function writeSection(name: string, variables: readonly string[], template: string): void {
    const frontmatter = variables.length === 0 ? 'variables: []' : `variables:\n${variables.map((variable) => `  - ${variable}`).join('\n')}`
    writeFileSync(path.join(contentRoot, 'prompts', 'sections', `${name}.md`), `---\n${frontmatter}\n---\n${template}\n`, 'utf8')
  }

  it('fails at startup naming the file when a required fragment is absent, rather than rendering as empty text', () => {
    writeSection('charter', ['charter'], '{{charter}}')
    writeSection('role', ['persona'], '{{persona}}')
    writeSection('addressed', [], 'you were addressed directly')
    writeSection('authorContext', ['authorContext'], '{{authorContext}}')
    writeSection('storyContext', ['storyContext'], '{{storyContext}}')

    expect(() => loadPromptFragments(contentRoot)).toThrowError(ShippedDataError)
    expect(() => loadPromptFragments(contentRoot)).toThrowError(/sections[/\\]manuscript\.md/)
  })
})
