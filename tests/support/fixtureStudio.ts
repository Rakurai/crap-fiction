import { bootstrap } from '../../src/server/bootstrap.js'
import { ModelAccess } from '../../src/server/model/modelAccess.js'
import { FixtureModelAdapter } from './modelAdapter.js'

/**
 * SPEC "Verification": the running studio answering from the fixture model
 * implementation rather than from a runtime, for a journey that needs a round to
 * settle without a model on the machine.
 *
 * It is a whole second entry point rather than a mode of the first, and it lives
 * under `tests/` rather than under `src/`, because the studio the author runs
 * must have no way to ask for this. `vite.fixture.config.ts` names it; nothing
 * the deployment loads does, which `tests/boundaries/fixtureStudioReach.test.ts`
 * holds.
 *
 * It reads the same four STUDIO_* variables the real entry does, and whoever
 * starts it supplies a data root of its own: fixture readings written into the
 * author's own workspace would be indistinguishable, afterwards, from readings a
 * runtime gave them.
 *
 * Every call site is assigned, and every one answers the same commentary: what
 * the fixture is for is a round that reaches every participant and settles, and
 * a reading of the author's actual prose is not something a fixture can have.
 * Whether the specialists produce genuinely different readings is a question for
 * a real runtime, and the studio the author runs is where it is asked.
 */
const { app } = bootstrap(
  () =>
    new ModelAccess(
      FixtureModelAdapter.uniform(
        { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'a reading from the fixture model implementation' } } },
        { reachable: true, models: ['fixture'] },
      ),
      (site) => site,
    ),
)

export default app
