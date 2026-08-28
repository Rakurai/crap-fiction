import { bootstrap } from './bootstrap.js'
import { getAssignment } from './model/assignments.js'
import { LMStudioAdapter } from './model/lmStudioAdapter.js'

const { app } = bootstrap(
  (env, config, logger, trace) =>
    new LMStudioAdapter(env.modelRuntimeUrl, (site) => getAssignment(env.dataRoot, site), config.model, logger, trace),
)

export default app
