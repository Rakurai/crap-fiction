import { defineConfig } from 'vite'
import { studioConfig } from './vite.config.js'

export default defineConfig(studioConfig('tests/support/fixtureStudio.ts'))
