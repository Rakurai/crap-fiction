import { bootstrap } from './bootstrap.js'
import { getAssignment } from './model/assignments.js'
import { LMStudioAdapter } from './model/lmStudioAdapter.js'

/**
 * The studio the author runs. It reaches models one way — the runtime at the
 * address the environment named, over the assignments in the author's own data
 * root — and there is no branch here and no variable anywhere that would let it
 * reach them any other way. A studio answering from the fixture model
 * implementation is stood up by naming a different entry (SPEC
 * "Verification"), never by configuring this one.
 */
const { app } = bootstrap(
  (env, logger) => new LMStudioAdapter(env.modelRuntimeUrl, (site) => getAssignment(env.dataRoot, site), logger),
)

export default app
