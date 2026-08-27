import type { Hono } from 'hono'
import { createApp } from '../../src/server/app.js'
import type { StudioEnv } from '../../src/server/env.js'
import { createLogger } from '../../src/server/logger.js'
import type { Charter } from '../../src/server/model/charter.js'
import type { Fragment, PromptFragments } from '../../src/server/model/prompts.js'
import type { RoleDefinition } from '../../src/server/model/roles.js'
import type { ModeDescriptor } from '../../src/server/modes.js'
import { PieceDocumentWriter } from '../../src/server/pieces.js'
import type { Room } from '../../src/server/room/room.js'
import { SHIPPED_HISTORY_POLICY } from '../../src/server/room/context.js'
import { ShippedContentCatalog } from '../../src/server/shippedContent.js'
import { AuthorContextStore, DraftStore, StoryContextStore } from '../../src/server/store/index.js'
import type { RuntimeStatus } from '../../src/shared/runtimeStatus.js'
import { WorkspaceRegistry } from '../../src/server/workspace.js'
import { FixtureModelAdapter } from './modelAdapter.js'
import { PROMPT_FRAGMENTS_FIXTURE } from './roomFixtures.js'
import { buildTestRoom } from './room.js'

export type AppSpec = Readonly<{
  modes: readonly ModeDescriptor[]
  roles: readonly RoleDefinition[]
  runtimeStatus: RuntimeStatus | undefined
  room: Room
  authorContextReference: string
}>

export type TestApp = Readonly<{ app: Hono; workspace: WorkspaceRegistry }>

const UNREACHED = 'unreached: no prompt is rendered in this scenario'

const UNREACHED_CHARTER: Charter = UNREACHED

function unreachedFragments(): PromptFragments {
  const marked = <K extends string>(kind: Readonly<Record<K, Fragment>>): Record<K, Fragment> =>
    Object.fromEntries(
      Object.entries<Fragment>(kind).map(([name, fragment]) => [name, { ...fragment, template: `${UNREACHED} ${fragment.template}` }]),
    ) as Record<K, Fragment>

  return {
    sections: marked(PROMPT_FRAGMENTS_FIXTURE.sections),
    lines: marked(PROMPT_FRAGMENTS_FIXTURE.lines),
    tasks: marked(PROMPT_FRAGMENTS_FIXTURE.tasks),
    roles: marked(PROMPT_FRAGMENTS_FIXTURE.roles),
    surfaces: marked(PROMPT_FRAGMENTS_FIXTURE.surfaces),
  }
}

export const UNREACHED_REFERENCE = UNREACHED

export function idleRoom(dataRoot: string, modes: readonly ModeDescriptor[], roles: readonly RoleDefinition[]): Room {
  return buildTestRoom(dataRoot, {
    modes,
    roles,
    charter: UNREACHED_CHARTER,
    fragments: unreachedFragments(),
    policy: SHIPPED_HISTORY_POLICY,
    modelAccess: FixtureModelAdapter.bySite({}, undefined),
    now: () => {
      throw new Error('this scenario opened no operation, so nothing should have read the clock')
    },
    authorContextReference: UNREACHED,
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
  const modelAccess = FixtureModelAdapter.bySite({}, spec.runtimeStatus)
  const catalog = ShippedContentCatalog.assemble({
    modes: spec.modes,
    roles: spec.roles,
    charter: UNREACHED_CHARTER,
    fragments: unreachedFragments(),
    authorContextReference: spec.authorContextReference ?? 'Notes about the author that generalize beyond any single piece.',
  })

  const app = createApp(
    env,
    workspace,
    catalog,
    new PieceDocumentWriter(new DraftStore(), new StoryContextStore(), new AuthorContextStore(), dataRoot),
    modelAccess,
    spec.room,
    createLogger(env.logLevel),
  )
  return { app, workspace }
}
