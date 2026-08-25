import type { Hono } from 'hono'
import { createApp } from '../../src/server/app.js'
import type { StudioEnv } from '../../src/server/env.js'
import { createLogger } from '../../src/server/logger.js'
import type { Charter } from '../../src/server/model/charter.js'
import { callSites } from '../../src/server/model/callSites.js'
import type { RoleDefinition } from '../../src/server/model/roles.js'
import type { ModeDescriptor } from '../../src/server/modes.js'
import { DraftWriter } from '../../src/server/pieces.js'
import type { Room } from '../../src/server/room/room.js'
import { SHIPPED_HISTORY_POLICY } from '../../src/server/room/context.js'
import { DraftStore } from '../../src/server/store/index.js'
import type { RuntimeStatus } from '../../src/shared/runtimeStatus.js'
import { WorkspaceRegistry } from '../../src/server/workspace.js'
import { FixtureModelAdapter } from './modelAdapter.js'
import { buildTestRoom } from './room.js'

export type AppSpec = Readonly<{
  mode: ModeDescriptor
  roles: readonly RoleDefinition[]
  /** Scripted, never defaulted: a test that never asks for it passes `undefined`. */
  runtimeStatus: RuntimeStatus | undefined
  /** A room the test drives itself. Omitted where the scenario asks the room for nothing. */
  room?: Room
}>

export type TestApp = Readonly<{ app: Hono; workspace: WorkspaceRegistry }>

/**
 * Every value only a prompt or a dispatch could read is left unusable rather than
 * plausible, so a scenario that reaches one fails at the reach instead of passing on
 * harness data. The roster comes from the mode and roles the test itself stated,
 * because the routes report it.
 */
const UNREACHED_CHARTER: Charter = {
  outcomes: {
    noComment: 'unreached: no prompt is rendered in this scenario',
    commentary: 'unreached: no prompt is rendered in this scenario',
    applicableSuggestion: 'unreached: no prompt is rendered in this scenario',
  },
  recommendationIsOneChange: 'unreached: no prompt is rendered in this scenario',
  directQuestionOwedAnswer: 'unreached: no prompt is rendered in this scenario',
  noReasoningAboutTheAuthorsQuestion: 'unreached: no prompt is rendered in this scenario',
}

function idleRoom(dataRoot: string, mode: ModeDescriptor, roles: readonly RoleDefinition[]): Room {
  return buildTestRoom(dataRoot, {
    mode,
    roles,
    charter: UNREACHED_CHARTER,
    policy: SHIPPED_HISTORY_POLICY,
    modelAccess: FixtureModelAdapter.bySite({}, undefined),
    now: () => {
      throw new Error('this scenario opened no operation, so nothing should have read the clock')
    },
  })
}

export function buildTestApp(dataRoot: string, spec: AppSpec): TestApp {
  const env: StudioEnv = Object.freeze({
    dataRoot,
    port: 4000,
    modelRuntimeUrl: 'http://localhost:1234',
    logLevel: 'silent' as const,
  })

  const workspace = WorkspaceRegistry.openAt(dataRoot)
  const room = spec.room ?? idleRoom(dataRoot, spec.mode, spec.roles)
  const modelAccess = FixtureModelAdapter.bySite({}, spec.runtimeStatus)

  const app = createApp(
    env,
    workspace,
    spec.mode,
    new DraftWriter(new DraftStore()),
    callSites(spec.roles),
    modelAccess,
    room,
    createLogger(env.logLevel),
  )
  return { app, workspace }
}
