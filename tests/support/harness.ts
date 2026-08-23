import type { Hono } from 'hono'
import { createApp } from '../../src/server/app.js'
import type { StudioEnv } from '../../src/server/env.js'
import { createLogger } from '../../src/server/logger.js'
import { callSites } from '../../src/server/model/callSites.js'
import type { RoleDefinition } from '../../src/server/model/roles.js'
import type { ModeDescriptor } from '../../src/server/modes.js'
import { DraftWriter } from '../../src/server/pieces.js'
import type { Room } from '../../src/server/room/room.js'
import { DraftStore } from '../../src/server/store/index.js'
import type { RuntimeStatus } from '../../src/shared/runtimeStatus.js'
import { WorkspaceRegistry } from '../../src/server/workspace.js'
import { FixtureModelAdapter } from './modelAdapter.js'
import { buildTestRoom, MODE_FIXTURE, ROLES_FIXTURE } from './room.js'

export type HarnessOverrides = Readonly<{
  mode?: ModeDescriptor
  roles?: readonly RoleDefinition[]
  runtimeStatus?: RuntimeStatus | undefined
  room?: Room
}>

export type TestApp = Readonly<{ app: Hono; workspace: WorkspaceRegistry }>

/**
 * SPEC "Seams": the one place every route test builds `createApp`'s
 * collaborators. `dataRoot` is the test's own temp directory; the mode, the
 * roles, the runtime status the `/models` route reports, and the room are
 * named overrides for the test that cares what one of them says. Nothing
 * here fabricates a response, an assignment or a model for a room a test
 * never overrides — that room's own model access cannot resolve a call at all.
 * The harness's own model access answers `/models` with `runtimeStatus`, which
 * is the whole of what any route reaches it for, and a test that never says what
 * the runtime reports gets a `/models` that fails rather than a reachable
 * runtime nobody scripted; `call` is scripted for no site, so a call that
 * somehow reached it would fail the same way.
 */
export function buildTestApp(dataRoot: string, overrides: HarnessOverrides = {}): TestApp {
  const mode = overrides.mode ?? MODE_FIXTURE
  const roles = overrides.roles ?? ROLES_FIXTURE
  const room = overrides.room ?? buildTestRoom(dataRoot, { mode, roles })

  const env: StudioEnv = Object.freeze({
    dataRoot,
    port: 4000,
    modelRuntimeUrl: 'http://localhost:1234',
    logLevel: 'silent' as const,
  })

  const workspace = WorkspaceRegistry.openAt(dataRoot)

  const modelAccess = FixtureModelAdapter.bySite({}, overrides.runtimeStatus)

  const app = createApp(env, workspace, mode, new DraftWriter(new DraftStore()), callSites(roles), modelAccess, room, createLogger(env.logLevel))
  return { app, workspace }
}
