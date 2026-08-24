import { bootstrap } from '../../src/server/bootstrap.js'
import { FIXTURE_ANSWERS } from './fixtureAnswers.js'
import { FixtureModelAdapter } from './modelAdapter.js'

const { app } = bootstrap(() => FixtureModelAdapter.bySite(FIXTURE_ANSWERS, { reachable: true, models: ['fixture'] }))

export default app
