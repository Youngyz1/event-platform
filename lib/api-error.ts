import { NextResponse } from "next/server";

/**
 * lib/api-error.ts — safe API error responses + server-side diagnostics (H4).
 *
 * Rule: 5xx responses NEVER include raw exception text (no Supabase / Stripe /
 * NOWPayments / SQL / path details leak to callers). 4xx validation messages
 * stay specific — they describe caller-controlled input, not internals.
 *
 * Diagnostics are preserved server-side via console.error with a correlation
 * id that is also returned to the caller (`requestId`), so a user report can
 * be matched to logs without exposing anything.
 *
 * Log hygiene: never pass passwords, tokens, API keys, payment secrets,
 * service-role keys, or full user objects here — log ids and codes only.
 */

function requestId(): string {
  try {
    return crypto.randomUUID().slice(0, 8);
  } catch {
    return Math.random().toString(36).slice(2, 10);
  }
}

function detailOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/** Server-side only. Safe to include internal detail — never sent to clients. */
export function logServerError(label: string, err: unknown, extra?: Record<string, unknown>): string {
  const id = requestId();
  try {
    console.error(`[${label}] requestId=${id}`, detailOf(err), extra ?? "");
  } catch {
    // Logging must never break the response path.
  }
  return id;
}

/**
 * Generic 500 with correlation id. Use for every unexpected failure instead
 * of `NextResponse.json({ error: error.message }, { status: 500 })`.
 */
export function internalError(label: string, err: unknown, extra?: Record<string, unknown>): NextResponse {
  const id = logServerError(label, err, extra);
  return NextResponse.json(
    { error: "Something went wrong. Please try again.", requestId: id },
    { status: 500, headers: { "Cache-Control": "no-store" } }
  );
}

/** Generic 400 for malformed bodies where echoing input would be unhelpful. */
export function badRequest(message = "Invalid request."): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}
