// Auth error codes for consistent error handling
export const AUTH_ERROR_CODES = {
  IDENTITY_ALREADY_LINKED: 'IDENTITY_ALREADY_LINKED',
  EMAIL_ALREADY_IN_USE: 'EMAIL_ALREADY_IN_USE',
  CANNOT_REMOVE_LAST_AUTH: 'CANNOT_REMOVE_LAST_AUTH',
  MERGE_VERIFICATION_REQUIRED: 'MERGE_VERIFICATION_REQUIRED',
  MERGE_VERIFICATION_EXPIRED: 'MERGE_VERIFICATION_EXPIRED',
  MERGE_IN_PROGRESS: 'MERGE_IN_PROGRESS',
  ACCOUNT_ALREADY_MERGED: 'ACCOUNT_ALREADY_MERGED'
} as const

export type AuthErrorCode = typeof AUTH_ERROR_CODES[keyof typeof AUTH_ERROR_CODES]

// User-friendly error messages
export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  [AUTH_ERROR_CODES.IDENTITY_ALREADY_LINKED]: 'This account is already linked to a different user',
  [AUTH_ERROR_CODES.EMAIL_ALREADY_IN_USE]: 'This email is already associated with another account',
  [AUTH_ERROR_CODES.CANNOT_REMOVE_LAST_AUTH]: 'Cannot remove last authentication method',
  [AUTH_ERROR_CODES.MERGE_VERIFICATION_REQUIRED]: 'You must verify ownership of both accounts',
  [AUTH_ERROR_CODES.MERGE_VERIFICATION_EXPIRED]: 'Verification code has expired',
  [AUTH_ERROR_CODES.MERGE_IN_PROGRESS]: 'A merge is already in progress for this account',
  [AUTH_ERROR_CODES.ACCOUNT_ALREADY_MERGED]: 'This account has been merged into another'
}

// HTTP status codes for each error type
export const AUTH_ERROR_HTTP_STATUS: Record<AuthErrorCode, number> = {
  [AUTH_ERROR_CODES.IDENTITY_ALREADY_LINKED]: 409,
  [AUTH_ERROR_CODES.EMAIL_ALREADY_IN_USE]: 409,
  [AUTH_ERROR_CODES.CANNOT_REMOVE_LAST_AUTH]: 400,
  [AUTH_ERROR_CODES.MERGE_VERIFICATION_REQUIRED]: 401,
  [AUTH_ERROR_CODES.MERGE_VERIFICATION_EXPIRED]: 410,
  [AUTH_ERROR_CODES.MERGE_IN_PROGRESS]: 423,
  [AUTH_ERROR_CODES.ACCOUNT_ALREADY_MERGED]: 410
}

/**
 * Create a structured error response for auth errors
 */
export function createAuthError(code: AuthErrorCode, details?: Record<string, unknown>) {
  return {
    error: {
      code,
      message: AUTH_ERROR_MESSAGES[code],
      ...details
    }
  }
}
