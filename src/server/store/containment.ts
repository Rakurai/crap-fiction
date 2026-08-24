import { existsSync, realpathSync } from 'node:fs'
import path from 'node:path'

export class PathEscapesRootError extends Error {
  constructor(root: string, candidate: string) {
    super(`path escapes root: "${candidate}" is not inside "${root}"`)
    this.name = 'PathEscapesRootError'
  }
}

function isInside(root: string, target: string): boolean {
  return target === root || target.startsWith(root + path.sep)
}

export function resolveWithinRoot(root: string, candidate: string): string {
  const resolvedRoot = path.resolve(root)
  const resolvedCandidate = path.resolve(resolvedRoot, candidate)

  if (!isInside(resolvedRoot, resolvedCandidate)) {
    throw new PathEscapesRootError(resolvedRoot, candidate)
  }

  if (existsSync(resolvedCandidate)) {
    const realRoot = realpathSync(resolvedRoot)
    const realCandidate = realpathSync(resolvedCandidate)
    if (!isInside(realRoot, realCandidate)) {
      throw new PathEscapesRootError(resolvedRoot, candidate)
    }
  }

  return resolvedCandidate
}
