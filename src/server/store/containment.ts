import { realpathSync } from 'node:fs'
import path from 'node:path'
import { RouteFailure } from '../routeFailure.js'

export class PathEscapesRootError extends RouteFailure {
  constructor(root: string, candidate: string) {
    super('PATH_ESCAPES_ROOT', 'invalid', `path escapes root: "${candidate}" is not inside "${root}"`)
    this.name = 'PathEscapesRootError'
  }
}

function isInside(root: string, target: string): boolean {
  return target === root || target.startsWith(root + path.sep)
}

function isAbsent(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const { code } = err as { code?: unknown }
  return code === 'ENOENT' || code === 'ENOTDIR'
}

function realLocationOf(target: string): string {
  const unresolved: string[] = []
  let at = target
  for (;;) {
    try {
      return path.join(realpathSync(at), ...unresolved)
    } catch (err) {
      if (!isAbsent(err)) throw err
      const parent = path.dirname(at)
      if (parent === at) return target
      unresolved.unshift(path.basename(at))
      at = parent
    }
  }
}

export function resolveWithinRoot(root: string, candidate: string): string {
  const resolvedRoot = path.resolve(root)
  const resolvedCandidate = path.resolve(resolvedRoot, candidate)

  if (!isInside(resolvedRoot, resolvedCandidate)) {
    throw new PathEscapesRootError(resolvedRoot, candidate)
  }

  if (!isInside(realLocationOf(resolvedRoot), realLocationOf(resolvedCandidate))) {
    throw new PathEscapesRootError(resolvedRoot, candidate)
  }

  return resolvedCandidate
}
