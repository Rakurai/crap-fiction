import raw from '../../config.yaml'
import { validateConfig } from '../shared/config.js'

export const config = validateConfig(raw, 'config.yaml')
