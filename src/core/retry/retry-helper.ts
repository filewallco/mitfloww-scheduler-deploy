import {
  DEFAULT_INITIAL_BACKOFF_MS,
  DEFAULT_MAX_BACKOFF_MS,
  DEFAULT_MAX_RETRIES,
} from "../../config/constants.js";
import { logger } from "../../utils/logger.js";

export interface RetryOptions {
  maxRetries?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  operationName?: string;
  shouldRetry?: (error: unknown) => boolean;
  signal?: AbortSignal;
}

/**
 * Classifies an AWS / Cloudflare R2 error as transient (retryable) or terminal (non-retryable).
 */
export function isRetryableR2Error(error: unknown): boolean {
  if (!error) return false;

  const err = error as Record<string, unknown>;
  const name = String(err.name || "");
  const code = String(err.Code || err.code || "");
  const statusCode = Number(err.$metadata ? (err.$metadata as any).httpStatusCode : err.statusCode || 0);

  // Terminal client errors - DO NOT RETRY
  const nonRetryableCodes = [
    "NoSuchBucket",
    "InvalidBucketName",
    "AccessDenied",
    "InvalidAccessKeyId",
    "SignatureDoesNotMatch",
    "InvalidArgument",
    "MalformedXML",
    "InvalidPart",
    "EntityTooLarge",
    "InvalidRequest",
  ];

  if (nonRetryableCodes.includes(code) || nonRetryableCodes.includes(name)) {
    return false;
  }

  if (statusCode === 400 || statusCode === 401 || statusCode === 403 || statusCode === 404) {
    return false;
  }

  // Retryable server errors, throttling, and network interruptions
  if (
    statusCode === 429 ||
    statusCode === 500 ||
    statusCode === 502 ||
    statusCode === 503 ||
    statusCode === 504 ||
    name === "TimeoutError" ||
    name === "NetworkingError" ||
    name === "SlowDown" ||
    name === "TooManyRequests" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "ENOTFOUND" ||
    code === "EAI_AGAIN"
  ) {
    return true;
  }

  // Default to retrying unknown errors up to maxRetries
  return true;
}

export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const initialBackoff = options.initialBackoffMs ?? DEFAULT_INITIAL_BACKOFF_MS;
  const maxBackoff = options.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS;
  const opName = options.operationName ?? "operation";
  const shouldRetry = options.shouldRetry ?? isRetryableR2Error;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    if (options.signal?.aborted) {
      logger.info(`[Retry] ${opName} aborted before attempt ${attempt}.`);
      break;
    }

    try {
      return await operation(attempt);
    } catch (err) {
      lastError = err;

      if (attempt > maxRetries) {
        break;
      }

      if (options.signal?.aborted) {
        logger.info(`[Retry] ${opName} aborted after error on attempt ${attempt}. Cancelling retries.`);
        break;
      }

      if (!shouldRetry(err)) {
        logger.debug(`[Retry] Non-retryable error encountered for ${opName}. Bailing immediately.`, { error: err });
        break;
      }

      // Exponential backoff with jitter
      const exponential = initialBackoff * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 0.3 * exponential;
      const delayMs = Math.min(exponential + jitter, maxBackoff);

      logger.warn(`[Retry] ${opName} failed on attempt ${attempt}/${maxRetries}. Retrying in ${Math.round(delayMs)}ms`, {
        attempt,
        delayMs,
        error: err instanceof Error ? err.message : String(err),
      });

      // Abort-aware delay: wake up immediately if abort signal fires
      await new Promise<void>((resolve) => {
        if (options.signal?.aborted) return resolve();
        const timer = setTimeout(resolve, delayMs);
        const onAbort = () => {
          clearTimeout(timer);
          resolve();
        };
        options.signal?.addEventListener("abort", onAbort, { once: true });
      });

      if (options.signal?.aborted) {
        logger.info(`[Retry] ${opName} aborted during backoff delay.`);
        break;
      }
    }
  }

  throw lastError;
}
