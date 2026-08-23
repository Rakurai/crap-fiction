import pino from 'pino'
import type { StudioEnv } from './env.js'

export type Logger = pino.Logger

/**
 * Writes to stderr and nowhere else — no file transport, no second
 * destination (SPEC "Substrate"). fd 2 is stderr regardless of what
 * process.stderr has been reassigned to.
 */
export function createLogger(logLevel: StudioEnv['logLevel']): Logger {
  return pino({ level: logLevel }, pino.destination(2))
}
