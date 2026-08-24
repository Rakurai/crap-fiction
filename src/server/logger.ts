import pino from 'pino'
import type { StudioEnv } from './env.js'

export type Logger = pino.Logger

export function createLogger(logLevel: StudioEnv['logLevel']): Logger {
  return pino({ level: logLevel }, pino.destination(2))
}
