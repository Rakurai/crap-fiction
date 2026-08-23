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
