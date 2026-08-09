/**
 * Consistent API response envelope, per the brief's format:
 * success -> { data, meta? }, error -> { error: { code, message, details? } }
 */
import { NextResponse } from 'next/server';
import { AppError, ErrorCodes } from './errors';

export function successResponse<T>(data: T, meta?: Record<string, unknown>, status = 200) {
  return NextResponse.json({ data, ...(meta ? { meta } : {}) }, { status });
}

export function errorResponse(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      { status: error.statusCode },
    );
  }

  // Unknown/unexpected errors: never leak internals (per §12 error handling requirements).
  console.error(error);
  return NextResponse.json(
    {
      error: {
        code: ErrorCodes.INTERNAL_ERROR,
        message: 'An unexpected error occurred.',
      },
    },
    { status: 500 },
  );
}