/**
 * lib/ticket-pricing.ts
 *
 * Server-side ticket pricing authority (remediation for C1).
 *
 * Security model:
 *   Client  -> identifiers only (eventId, ticketId, seatId, quantity)
 *   Server  -> database lookup -> trusted unit price -> server-computed total
 *
 * The browser is NEVER authoritative for ticket prices. Any client-supplied
 * `ticketPrice` / `amount` / `total` / `currency` for a TICKET purchase is
 * ignored for computation (a contradictory value yields 400 where cheap to
 * detect, otherwise it is simply not used).
 *
 * Donations are different: the donor chooses the amount. Donation amounts are
 * still validated here (finite, min, max, currency allow-list) but they are
 * not looked up from the database because there is no fixed price.
 *
 * This module is dependency-free (no `@/` imports) so it can be unit-tested
 * with plain `node --experimental-strip-types` without path aliases.
 */

export const TICKET_CURRENCY = "usd" as const;

/** Currencies accepted for donor-chosen donation amounts. */
export const SUPPORTED_DONATION_CURRENCIES = [
  "usd",
  "eur",
  "gbp",
  "cad",
  "aud",
] as const;

export type SupportedDonationCurrency =
  (typeof SUPPORTED_DONATION_CURRENCIES)[number];

/** Minimum donation in major units ($1). Prevents dust/test abuse. */
export const MIN_DONATION_AMOUNT = 1;
/** Maximum single donation/payment in major units. Caps fat-finger / abuse. */
export const MAX_DONATION_AMOUNT = 1_000_000;

/** Ticket quantity bounds. Integer-only, prevents 0/negative/oversell bursts. */
export const MIN_TICKET_QUANTITY = 1;
export const MAX_TICKET_QUANTITY = 10;

/** Seats whose reservation expired are treated as available by theLet DB. */
export type SeatStatus = "available" | "reserved" | "sold";

export interface TicketRow {
  id: string;
  event_id: string | null;
  name: string | null;
  price: number | string | null;
  quantity: number | null;
}

export interface SeatRow {
  id: string;
  event_id: string;
  status: SeatStatus | string;
  price_override: number | string | null;
  ticket_id: string | null;
}

export interface EventRow {
  id: string;
  slug: string | null;
  title: string | null;
}

export interface ResolvedTicketPrice {
  /** Trusted unit price in major units (dollars). */
  unitPrice: number;
  /** Trusted total in major units (unitPrice * qty), rounded to cents. */
  total: number;
  /** Trusted total in integer cents for Stripe. */
  totalCents: number;
  /** Trusted currency (always TICKET_CURRENCY — DB has no currency column). */
  currency: typeof TICKET_CURRENCY;
  /** Trusted display names from the database (for receipts/metadata). */
  ticketName: string;
  eventTitle: string;
  eventSlug: string;
}

function toNumber(value: unknown): number {
  return typeof value === "string" ? Number(value) : (value as number);
}

/**
 * Validate a ticket quantity. Rejects 0, negatives, fractions, NaN,
 * non-numeric input, and quantities above MAX_TICKET_QUANTITY.
 */
export function validateTicketQuantity(raw: unknown):
  | { ok: true; quantity: number }
  | { ok: false; error: string } {
  const quantity = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;

  if (typeof quantity !== "number" || !Number.isFinite(quantity)) {
    return { ok: false, error: "Quantity must be a number." };
  }
  if (!Number.isInteger(quantity)) {
    return { ok: false, error: "Quantity must be a whole number." };
  }
  if (quantity < MIN_TICKET_QUANTITY) {
    return { ok: false, error: "Quantity must be at least 1." };
  }
  if (quantity > MAX_TICKET_QUANTITY) {
    return {
      ok: false,
      error: `Quantity cannot exceed ${MAX_TICKET_QUANTITY} per order.`,
    };
  }
  return { ok: true, quantity };
}

/**
 * Validate a donor-chosen donation amount (no fixed DB price exists).
 * Returns the amount in major units rounded to cents.
 */
export function validateDonationAmount(raw: unknown):
  | { ok: true; amount: number }
  | { ok: false; error: string } {
  const amount = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;

  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return { ok: false, error: "Invalid payment amount." };
  }
  const rounded = Math.round(amount * 100) / 100;
  if (rounded < MIN_DONATION_AMOUNT) {
    return {
      ok: false,
      error: `Minimum donation is $${MIN_DONATION_AMOUNT}.`,
    };
  }
  if (rounded > MAX_DONATION_AMOUNT) {
    return { ok: false, error: "Amount exceeds the maximum allowed." };
  }
  return { ok: true, amount: rounded };
}

/** Validate a donation currency against the allow-list. */
export function validateDonationCurrency(raw: unknown):
  | { ok: true; currency: SupportedDonationCurrency }
  | { ok: false; error: string } {
  const normalized =
    typeof raw === "string" ? raw.trim().toLowerCase() : "usd";
  const allowed: readonly string[] = SUPPORTED_DONATION_CURRENCIES;
  if (!allowed.includes(normalized)) {
    return { ok: false, error: "Unsupported currency." };
  }
  return { ok: true, currency: normalized as SupportedDonationCurrency };
}

/**
 * Resolve the trusted unit price for a ticket purchase from database rows
 * the caller has already fetched with the service-role client.
 *
 * Returns `{ ok: false }` with a machine-readable `code` the route maps to
 * an HTTP status:
 *  - "ticket_not_found"      -> 404 (also covers ticket/event mismatch)
 *  - "event_not_found"       -> 404
 *  - "ticket_unavailable"    -> 400 (price missing/invalid, sold out)
 *  - "seat_unavailable"      -> 400 (seat taken, wrong event, or sold)
 *  - "tables_removed"        -> 410 (migration_65 dropped ticketing schema)
 *
 * A seat-level `price_override` takes precedence over the ticket price when
 * a seat is supplied, matching the `seats.price_override` column semantics.
 */
export function resolveTicketPrice(args: {
  ticket: TicketRow | null;
  event: EventRow | null;
  seat?: SeatRow | null;
  eventId: string;
  quantity: number;
}):
  | { ok: true; value: ResolvedTicketPrice }
  | { ok: false; code: string; error: string } {
  const { ticket, event, seat, eventId, quantity } = args;

  if (!ticket) {
    return {
      ok: false,
      code: "ticket_not_found",
      error: "Ticket not found for this event.",
    };
  }
  if (ticket.event_id && ticket.event_id !== eventId) {
    // Do not reveal whether the ticket exists elsewhere.
    return {
      ok: false,
      code: "ticket_not_found",
      error: "Ticket not found for this event.",
    };
  }
  if (!event) {
    return { ok: false, code: "event_not_found", error: "Event not found." };
  }

  let unitPrice = toNumber(ticket.price);
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    return {
      ok: false,
      code: "ticket_unavailable",
      error: "This ticket is not purchasable.",
    };
  }

  // Inventory: tickets.quantity is total stock (null = unlimited legacy row).
  // Soft gate only — the hard guarantee is the atomic consume at fulfillment
  // (migration_73); concurrent intents can still race between here and there.
  if (typeof ticket.quantity === "number" && ticket.quantity <= 0) {
    return {
      ok: false,
      code: "ticket_unavailable",
      error: "This ticket is sold out.",
    };
  }
  if (
    typeof ticket.quantity === "number" &&
    Number.isInteger(quantity) &&
    ticket.quantity < quantity
  ) {
    return {
      ok: false,
      code: "ticket_unavailable",
      error: "Not enough tickets available.",
    };
  }

  if (seat) {
    if (seat.event_id !== eventId) {
      return {
        ok: false,
        code: "seat_unavailable",
        error: "Seat is no longer available.",
      };
    }
    if (seat.status !== "available") {
      return {
        ok: false,
        code: "seat_unavailable",
        error: "Seat is no longer available.",
      };
    }
    if (seat.price_override !== null && seat.price_override !== undefined) {
      const override = toNumber(seat.price_override);
      if (!Number.isFinite(override) || override <= 0) {
        return {
          ok: false,
          code: "seat_unavailable",
          error: "Seat is no longer available.",
        };
      }
      unitPrice = override;
    }
  }

  // Round to cents at the boundary so Stripe always gets an integer.
  const roundedUnit = Math.round(unitPrice * 100) / 100;
  const total = Math.round(roundedUnit * quantity * 100) / 100;
  const totalCents = Math.round(total * 100);
  if (!Number.isFinite(totalCents) || totalCents <= 0) {
    return {
      ok: false,
      code: "ticket_unavailable",
      error: "This ticket is not purchasable.",
    };
  }

  return {
    ok: true,
    value: {
      unitPrice: roundedUnit,
      total,
      totalCents,
      currency: TICKET_CURRENCY,
      ticketName: ticket.name || "Ticket",
      eventTitle: event.title || "",
      eventSlug: event.slug || "",
    },
  };
}

/**
 * Detect a contradictory client-supplied price without trusting it.
 * Used only to return a clear 400 for obvious tampering probes; the payment
 * computation never uses the client value either way.
 */
export function clientPriceContradicts(
  clientPrice: unknown,
  trustedUnitPrice: number
): boolean {
  if (clientPrice === undefined || clientPrice === null || clientPrice === "") {
    return false;
  }
  const n = Number(clientPrice);
  if (!Number.isFinite(n)) return true;
  return Math.abs(n - trustedUnitPrice) > 0.005;
}
