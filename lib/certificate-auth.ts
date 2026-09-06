import { createHash, timingSafeEqual } from "node:crypto";

/**
 * lib/certificate-auth.ts — shared certificate authorization helpers (H5).
 *
 * A predictable donation ID must NEVER authorize access to a protected
 * certificate. Guest access is granted only via server-verified payment
 * identifiers (see route), plus these pure classifiers used by both the
 * route and the security checks.
 */

/** Stripe PaymentIntent ids (`pi_...`) are verified live via the Stripe API. */
export function isStripePaymentIntentId(value: string): boolean {
  return value.startsWith("pi_");
}

/** Stripe Checkout Session ids (`cs_...`) are verified live via Stripe. */
export function isStripeSessionId(value: string): boolean {
  return value.startsWith("cs_");
}

/** Only settled donations may receive payment certificates. */
export function isPaidDonationStatus(status: unknown): boolean {
  return status === "completed" || status === "succeeded";
}

/**
 * Constant-time string equality (hashes first so `timingSafeEqual` never sees
 * a length mismatch, which would throw and leak length).
 */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}
