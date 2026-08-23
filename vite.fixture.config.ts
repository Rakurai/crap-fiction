import { defineConfig } from 'vite'
import { studioConfig } from './vite.config.js'

/**
 * The studio answering from the fixture model implementation (SPEC
 * "Verification"), served exactly as the real one is so what a journey walks
 * through is the studio and not an arrangement built for the journey. Reaching
 * it takes naming this file — `npm run dev:fixture` — which is why the studio
 * the author runs cannot arrive here by any setting.
 */
export default defineConfig(studioConfig('tests/support/fixtureStudio.ts'))
