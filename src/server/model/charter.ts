import { readShippedCharter } from '../store/index.js'

/** The rules shared by every participant, composed whole into a specialist or generalist call. */
export type Charter = string

export function loadCharter(contentRoot: string): Charter {
  return readShippedCharter(contentRoot)
}
