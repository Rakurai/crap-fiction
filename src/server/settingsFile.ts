import path from 'node:path'

/**
 * SPEC "Files": `settings.yaml` holds the workspace path and interface
 * preferences beside each other under the data root. One function names
 * where it lives so `WorkspaceRegistry` and the theme module read and write
 * the same file rather than each computing its own path to it.
 */
export function settingsPath(dataRoot: string): string {
  return path.join(dataRoot, 'config', 'settings.yaml')
}
