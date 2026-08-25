import { readShippedCharter } from '../store/index.js'

export type Charter = string

export function loadCharter(contentRoot: string): Charter {
  return readShippedCharter(contentRoot)
}
