import { bootstrap } from '../../src/server/bootstrap.js'
import { FIXTURE_ANSWERS } from './fixtureAnswers.js'
import { FixtureModelAdapter } from './modelAdapter.js'

/**
 * SPEC "Verification": the running studio answering from the fixture model
 * implementation rather than from a runtime, for the journeys that need a round
 * to settle and an application to return prose without a model on the machine.
 *
 * It is a whole second entry point rather than a mode of the first, and it lives
 * under `tests/` rather than under `src/`, because the studio the author runs
 * must have no way to ask for this. `vite.fixture.config.ts` names it; nothing
 * the deployment loads does, which `tests/repo/importGraph.test.ts` holds.
 *
 * It reads the same four STUDIO_* variables the real entry does, and whoever
 * starts it supplies a data root of its own: fixture readings written into the
 * author's own workspace would be indistinguishable, afterwards, from readings a
 * runtime gave them.
 *
 * What it answers is `./fixtureAnswers.ts`, which the journeys read too — the
 * prose a browser is about to look for is the prose scripted there, named once.
 * Whether the specialists produce genuinely different readings is a question for
 * a real runtime, and the studio the author runs is where it is asked.
 */
const { app } = bootstrap(() => FixtureModelAdapter.bySite(FIXTURE_ANSWERS, { reachable: true, models: ['fixture'] }))

export default app
