import crypto from "node:crypto";
import type http from "node:http";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

// Rate limiting state
interface RateLimitBucket {
  count: number;
  resetTime: number;
}
const authRateLimits = new Map<string, RateLimitBucket>();
const apiRateLimits = new Map<string, RateLimitBucket>();

/**
 * Timing-safe string comparison.
 */
function safeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Constant time comparison against dummy
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Extracts client IP from request headers or socket.
 */
export function getClientIp(req: http.IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "127.0.0.1";
}

/**
 * Checks in-memory sliding window rate limits.
 */
export function checkRateLimit(
  map: Map<string, RateLimitBucket>,
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  let bucket = map.get(key);

  if (!bucket || now >= bucket.resetTime) {
    bucket = { count: 1, resetTime: now + windowMs };
    map.set(key, bucket);
    return { allowed: true, remaining: limit - 1, resetMs: windowMs };
  }

  bucket.count++;
  const remaining = Math.max(0, limit - bucket.count);
  const resetMs = Math.max(0, bucket.resetTime - now);

  return {
    allowed: bucket.count <= limit,
    remaining,
    resetMs,
  };
}

/**
 * Parses cookies from request header.
 */
export function parseCookies(req: http.IncomingMessage): Record<string, string> {
  const list: Record<string, string> = {};
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return list;

  cookieHeader.split(";").forEach((cookie) => {
    let [name, ...rest] = cookie.split("=");
    name = name?.trim();
    if (!name) return;
    const value = rest.join("=").trim();
    list[name] = decodeURIComponent(value);
  });

  return list;
}

/**
 * Verifies request authentication via Header or Cookie.
 */
export function verifyAuth(req: http.IncomingMessage): { authenticated: boolean; actor: string } {
  const ip = getClientIp(req);
  const rateLimit = checkRateLimit(apiRateLimits, ip, 300, 60000); // 300 requests per min
  if (!rateLimit.allowed) {
    logger.warn(`[Auth] Rate limit exceeded for IP ${ip}`);
    return { authenticated: false, actor: "rate-limited" };
  }

  // 1. Check Authorization header (Bearer token)
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    if (safeCompare(token, env.SCHEDULER_ADMIN_KEY)) {
      return { authenticated: true, actor: `bearer:${ip}` };
    }
  }

  // 2. Check x-scheduler-key header
  const customHeader = req.headers["x-scheduler-key"];
  if (typeof customHeader === "string") {
    if (safeCompare(customHeader.trim(), env.SCHEDULER_ADMIN_KEY)) {
      return { authenticated: true, actor: `apikey:${ip}` };
    }
  }

  // 3. Check Session Cookie
  const cookies = parseCookies(req);
  const cookieToken = cookies["scheduler_admin_token"];
  if (cookieToken) {
    if (safeCompare(cookieToken.trim(), env.SCHEDULER_ADMIN_KEY)) {
      return { authenticated: true, actor: `cookie:${ip}` };
    }
  }

  return { authenticated: false, actor: "anonymous" };
}

/**
 * Authenticates login credentials with brute-force protection.
 */
export function authenticateLogin(
  req: http.IncomingMessage,
  providedKey: string
): { success: boolean; token?: string; error?: string } {
  const ip = getClientIp(req);
  const authLimit = checkRateLimit(authRateLimits, `auth:${ip}`, 10, 60000); // max 10 failed logins / min
  if (!authLimit.allowed) {
    return { success: false, error: "Too many failed login attempts. Please wait 1 minute." };
  }

  if (safeCompare(providedKey.trim(), env.SCHEDULER_ADMIN_KEY)) {
    return { success: true, token: env.SCHEDULER_ADMIN_KEY };
  }

  return { success: false, error: "Invalid administrative access key." };
}
