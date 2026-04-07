/**
 * Retry utility for transient model API errors.
 *
 * On a 503 (Service Unavailable) the initial model call is retried up to 4
 * times with increasing back-off: 1 s → 5 s → 15 s → 30 s.
 *
 * IMPORTANT: this wrapper only retries the function call itself (i.e. getting
 * the stream/response object back). It does NOT retry mid-stream errors — once
 * chunks or tool calls have been consumed, replaying the request could
 * duplicate output or re-trigger side-effects.
 *
 * When all retries are exhausted a `ModelUnavailableError` is thrown. The
 * caller is responsible for all HTTP response handling (writing SSE events,
 * calling res.end(), etc.) so there are no double-write risks.
 */

export const RETRY_DELAYS_MS = [1000, 5000, 15000, 30000];

/** Thrown when 503 retries are fully exhausted. */
export class ModelUnavailableError extends Error {
  readonly attempts: number;
  readonly cause: unknown;
  constructor(attempts: number, cause: unknown) {
    super(`Model service unavailable after ${attempts} attempts (1s→5s→15s→30s)`);
    this.name = "ModelUnavailableError";
    this.attempts = attempts;
    this.cause = cause;
  }
}

function is503(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as Record<string, unknown>;
  // Direct status codes (various SDK shapes)
  if (e.status === 503 || e.statusCode === 503 || e.httpStatus === 503) return true;
  // Nested cause (e.g. GoogleGenerativeAIError wrapping an HttpError)
  if (e.cause && is503(e.cause)) return true;
  // Gemini SDK often encodes status in the message string
  const msg = String(e.message ?? "");
  return /\b503\b/.test(msg) || /service[\s_-]?unavailable/i.test(msg) || /UNAVAILABLE/i.test(msg);
}

/**
 * Wraps a model API call with 503 retry logic.
 * Non-503 errors are re-thrown immediately without retrying.
 * On persistent 503, throws `ModelUnavailableError`.
 *
 * @param signal - optional AbortSignal to cancel pending retries on client disconnect
 */
export async function withRetryOn503<T>(
  fn: () => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (signal?.aborted) throw new Error("Request aborted");

    try {
      return await fn();
    } catch (error: unknown) {
      if (!is503(error)) throw error; // Not a 503 — propagate immediately

      lastError = error;

      if (attempt < RETRY_DELAYS_MS.length) {
        const delayMs = RETRY_DELAYS_MS[attempt];
        console.warn(
          `[Model] ⚠️  503 Service Unavailable — attempt ${attempt + 1}/${RETRY_DELAYS_MS.length + 1}, retrying in ${delayMs / 1000}s...`
        );
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, delayMs);
          signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new Error("Request aborted")); });
        });
      }
    }
  }

  console.warn(
    "[Model] ❌ 503 persists after all retries (1s → 5s → 15s → 30s). Returning to standby."
  );
  throw new ModelUnavailableError(RETRY_DELAYS_MS.length + 1, lastError);
}
