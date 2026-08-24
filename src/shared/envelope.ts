import { z } from 'zod'

export type ApiError = { readonly code: string; readonly message: string }

export type ApiResponse<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: ApiError }

export function ok<T>(data: T): ApiResponse<T> {
  return { success: true, data }
}

export function fail(code: string, message: string): ApiResponse<never> {
  return { success: false, error: { code, message } }
}

export function apiResponseSchema<T extends z.ZodType>(data: T) {
  return z.discriminatedUnion('success', [
    z.object({ success: z.literal(true), data }),
    z.object({ success: z.literal(false), error: z.object({ code: z.string(), message: z.string() }) }),
  ])
}
