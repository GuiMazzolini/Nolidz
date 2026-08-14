import { NextRequest } from "next/server";

/** A JSON request against a route handler. */
export function jsonRequest(
  method: string,
  body?: unknown,
  {
    url = "http://localhost:3000/api/test",
    ip = "203.0.113.1",
  }: { url?: string; ip?: string } = {}
): NextRequest {
  return new NextRequest(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      // The rate limiter buckets on this; a fixed value keeps tests in one
      // bucket so budgets are predictable.
      "x-forwarded-for": ip,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

/** A request whose body is not valid JSON, for the parse-failure path. */
export function malformedRequest(method = "POST"): NextRequest {
  return new NextRequest("http://localhost:3000/api/test", {
    method,
    headers: { "Content-Type": "application/json" },
    body: "{not json",
  });
}

export async function readJson<T = unknown>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

/** Status and parsed body together, which is what most assertions want. */
export async function readResponse<T = unknown>(
  res: Response
): Promise<{ status: number; body: T }> {
  return { status: res.status, body: (await res.json()) as T };
}
