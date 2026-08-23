import { z } from 'zod'
import { settingsPath } from '../settingsFile.js'
import { readYamlArtifact, writeYamlArtifact } from '../store.js'

const settingsSchema = z.object({
  modelAssignments: z.record(z.string(), z.string().min(1)).optional(),
})

/**
 * SPEC "Files": model assignment is a property of the author's machine
 * rather than of any story, so it lives in `settings.yaml` beside the
 * workspace path and the theme. It is author-editable data, re-read at the
 * moment a call is compiled rather than cached from startup — reassigning a
 * participant and asking the room again is the diagnostic loop the design
 * depends on, and holding it in memory would cost a restart per experiment.
 */
export function getAssignment(dataRoot: string, site: string): string | undefined {
  const settings = readYamlArtifact(settingsPath(dataRoot), settingsSchema)
  return settings?.modelAssignments?.[site]
}

export function listAssignments(dataRoot: string): ReadonlyMap<string, string> {
  const settings = readYamlArtifact(settingsPath(dataRoot), settingsSchema)
  return new Map(Object.entries(settings?.modelAssignments ?? {}))
}

/**
 * SPEC "Transport": a model is assigned one call site per request, never as
 * a read-modify-write over every other assignment, so an author pointing one
 * participant at a different model cannot lose one they did not touch.
 */
export async function setAssignment(dataRoot: string, site: string, model: string): Promise<void> {
  await writeYamlArtifact(settingsPath(dataRoot), { modelAssignments: { [site]: model } })
}
