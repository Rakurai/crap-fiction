import { z } from 'zod'

export const durableContextSchema = z.record(z.string().min(1), z.array(z.string().min(1)))

export type DurableContext = Readonly<z.infer<typeof durableContextSchema>>
