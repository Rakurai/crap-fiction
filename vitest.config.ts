import yaml from '@rollup/plugin-yaml'
import type { PluginOption } from 'vite'
import { defineConfig } from 'vitest/config'

const DOM_TESTS = [
  'tests/model/CallSiteList.test.tsx',
  'tests/roster/useRoster.test.ts',
  'tests/roster/RoomEditor.test.tsx',
  'tests/roster/useSurfaceCast.test.ts',
  'tests/conversation/Conversation.test.tsx',
  'tests/conversation/ConversationSwitcher.test.tsx',
  'tests/conversation/useConversation.test.ts',
  'tests/applying/useApply.test.ts',
  'tests/editingSurface/ContextSurface.test.tsx',
  'tests/editingSurface/EditingSurface.test.tsx',
  'tests/draft/Manuscript.test.tsx',
  'tests/draft/useManuscript.test.ts',
  'tests/editingSurface/useDocumentSession.test.ts',
  'tests/pieceLifecycle/NewPieceForm.test.tsx',
  'tests/pieceLifecycle/OpenedPiece.test.tsx',
  'tests/authorContext/authorContextSelection.test.ts',
  'tests/load/load.test.ts',
  'tests/transport/pieceStream.test.ts',
  'tests/transport/roomClient.test.ts',
]

export default defineConfig({
  plugins: [yaml() as PluginOption],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'dom',
          include: DOM_TESTS,
          environment: 'jsdom',
          setupFiles: ['tests/support/domSetup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'node',
          include: ['tests/**/*.test.{ts,tsx}'],
          exclude: DOM_TESTS,
          environment: 'node',
        },
      },
    ],
  },
})
