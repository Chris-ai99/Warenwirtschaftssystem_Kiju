import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createRandomId } from "./random-id";

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function assertCondition(
  condition: unknown,
  status: number,
  code: string,
  message: string,
  details?: unknown,
): asserts condition {
  if (!condition) {
    throw new AppError(status, code, message, details);
  }
}

export function errorResponse(error: unknown) {
  const requestId = createRandomId();

  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? null,
          requestId,
        },
      },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Eingabe ist ungültig.",
          details: error.flatten(),
          requestId,
        },
      },
      { status: 400 },
    );
  }

  console.error(error);
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Ein unerwarteter Fehler ist aufgetreten.",
        details: null,
        requestId,
      },
    },
    { status: 500 },
  );
}
