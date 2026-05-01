import { NextResponse } from "next/server";
import { errorResponse } from "./errors";

export async function route(handler: () => Promise<Response> | Response) {
  try {
    return await handler();
  } catch (error) {
    return errorResponse(error);
  }
}

export async function parseJson<T>(request: Request, parser: { parse: (value: unknown) => T }) {
  const body = await request.json().catch(() => ({}));
  return parser.parse(body);
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}
