import { z } from 'zod'

/** The interface theme, named the same way at both ends of the wire. */
export const themeSchema = z.enum(['light', 'dark'])

export type Theme = z.infer<typeof themeSchema>
