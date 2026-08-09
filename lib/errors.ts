/**
 * Central error type used across the API layer. Services/repositories throw
 * plain Errors for internal failures; routes are responsible for mapping
 * known cases to an AppError with a proper code before responding.
 */
export class AppError extends Error {
  code: string;
  details?: Record<string, string[]>;
  statusCode: number;

  constructor(
    code: string,
    message: string,
    statusCode = 400,
    details?: Record<string, string[]>,
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

// Common codes reused across modules — extend as new modules need new codes.
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;