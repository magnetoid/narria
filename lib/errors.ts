/**
 * Typed failures a surface must react to specifically instead of rendering as a
 * generic message. `code` is the contract that carries that distinction outward:
 * server actions return it beside `error`, and routes map it to a status.
 */

/** Extend as new typed failures appear — one entry per case a client can branch on. */
export type AppErrorCode = "rate_limited";

/** The error half of a server action's result. Success shapes stay per-action. */
export interface ActionError {
  error: string;
  code?: AppErrorCode;
}

// Keyed rather than listed so that widening AppErrorCode fails to type-check until
// the new code is whitelisted here too.
const APP_ERROR_CODES: Record<AppErrorCode, true> = { rate_limited: true };

/** Thrown by the `ai` facade, the one choke point every AI call flows through. */
export class RateLimitError extends Error {
  readonly code = "rate_limited" as const;

  constructor(
    readonly retryAfterSeconds: number,
    message = "Too many AI requests. Please wait a moment and try again.",
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

/** The `code` to hand a client, or undefined when there is none. Whitelisted rather
 *  than read straight off the error: Node and Postgres failures carry a `code` of
 *  their own ("ECONNREFUSED", "23505"), and those must not reach the UI dressed as
 *  part of this contract. */
export function errorCode(e: unknown): AppErrorCode | undefined {
  const code = (e as { code?: unknown } | null | undefined)?.code;
  return typeof code === "string" && Object.hasOwn(APP_ERROR_CODES, code)
    ? (code as AppErrorCode)
    : undefined;
}

/** Duck-typed rather than `instanceof`: a Next production build can hand each route
 *  bundle its own instance of this module, and an error thrown under one instance
 *  fails `instanceof` against another instance's class object. */
export function isRateLimitError(e: unknown): e is RateLimitError {
  return errorCode(e) === "rate_limited";
}
