"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { StripeProvider, PaymentForm, OrderSummary } from "@/components/payments";

const SeatMap = dynamic(() => import("@/components/SeatMap"), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────

type Ticket = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

type Event = {
  id: string;
  title: string;
  slug: string;
  source_url?: string | null;
};

type SeatData = {
  id: string;
  section: string;
  row_label: string;
  seat_number: number;
  status: "available" | "reserved" | "sold";
  price_override: number | null;
};

type VenueLayout = {
  id: string;
  name: string;
  sections: { name: string; rows: number; seatsPerRow: number }[];
};

type Step = "tickets" | "seats" | "review";

// ─── Main checkout component ───────────────────────────────────────────────────

export default function TicketCheckout({
  event,
  tickets,
  lowestPrice,
}: {
  event: Event;
  tickets: Ticket[];
  lowestPrice: number | null;
}) {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("tickets");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(
    tickets[0] || null
  );
  const [quantity, setQuantity] = useState(1);
  const [paid, setPaid] = useState(searchParams.get("success") === "true");

  // Seat map state
  const [venueLayout, setVenueLayout] = useState<VenueLayout | null>(null);
  const [allSeats, setAllSeats] = useState<SeatData[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<SeatData[]>([]);
  const [loadingSeats, setLoadingSeats] = useState(true);
  const [seatMapAvailable, setSeatMapAvailable] = useState(false);

  // Buyer info (collected inside PaymentForm via PaymentElement)
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");

  // Stripe inline payment
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [preparingPayment, setPreparingPayment] = useState(false);
  // UUID minted when the user clicks Continue — ties this browser attempt
  // to the Stripe idempotency key so retries reuse the same intent while
  // going-back-then-returning always creates a fresh one.
  const [checkoutAttemptId, setCheckoutAttemptId] = useState<string | null>(null);

  // Load seat map if venue has assigned seating
  useEffect(() => {
    if (!event.id) return;
    fetch(`/api/seats?event_id=${event.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.layout) {
          setVenueLayout(data.layout);
          setAllSeats(data.seats || []);
          setSeatMapAvailable(true);
        }
        setLoadingSeats(false);
      })
      .catch(() => setLoadingSeats(false));
  }, [event.id]);

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function formatPrice(price: number) {
    return price === 0
      ? "Free"
      : new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(price);
  }

  const effectivePrice =
    selectedSeats.length > 0
      ? selectedSeats.reduce(
          (sum, s) => sum + (s.price_override ?? selectedTicket?.price ?? 0),
          0
        )
      : selectedTicket
      ? selectedTicket.price * quantity
      : 0;

  const seatLabel =
    selectedSeats.length > 0
      ? selectedSeats
          .map((s) => `${s.section}-${s.row_label}${s.seat_number}`)
          .join(", ")
      : null;

  // ─── Prepare Stripe PaymentIntent ────────────────────────────────────────────
  // acceptAttemptId: the UUID minted for this particular checkout attempt.
  // Using a parameter (vs reading state) avoids closure staleness.
  async function preparePayment(attemptId: string) {
    if (effectivePrice === 0) return; // free tickets skip Stripe
    if (clientSecret) return;         // already created for this attempt
    setPreparingPayment(true);

    // Reserve seats before charging
    if (selectedSeats.length > 0) {
      const res = await fetch("/api/seats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seatIds: selectedSeats.map((s) => s.id) }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Some seats are no longer available. Please re-select.");
        setPreparingPayment(false);
        setStep("seats");
        return;
      }
    }

    const res = await fetch("/api/create-payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticketName: selectedTicket?.name,
        ticketPrice: effectivePrice / (selectedSeats.length || quantity),
        eventTitle: event.title,
        eventSlug: event.slug,
        eventId: event.id,
        ticketId: selectedTicket?.id,
        seatId: selectedSeats[0]?.id || null,
        seatLabel: seatLabel || null,
        quantity: selectedSeats.length || quantity,
        buyerEmail: buyerEmail || null,
        buyerName: buyerName || null,
        currency: "usd",
        checkoutAttemptId: attemptId,
      }),
    });

    const data = await res.json();
    if (data.clientSecret) {
      setClientSecret(data.clientSecret);
      setQrCode(data.qrCode ?? null);
    } else {
      alert("Could not initialise payment. Please try again.");
    }
    setPreparingPayment(false);
  }

  function goToReview() {
    // Mint a fresh UUID for every new checkout attempt so:
    //  1. The same attempt (page still open) reuses the same Stripe intent.
    //  2. A new attempt (user went back and came back) gets a brand-new intent.
    const attemptId = crypto.randomUUID();
    setCheckoutAttemptId(attemptId);
    setStep("review");
    preparePayment(attemptId);
  }

  // ─── Free ticket handler ─────────────────────────────────────────────────────

  async function handleFreeTicket() {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticketName: selectedTicket?.name,
        ticketPrice: 0,
        eventTitle: event.title,
        eventSlug: event.slug,
        eventId: event.id,
        ticketId: selectedTicket?.id,
        seatId: selectedSeats[0]?.id || null,
        seatLabel: seatLabel || null,
        quantity: selectedSeats.length || quantity,
        buyerEmail: buyerEmail || null,
        buyerName: buyerName || null,
      }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      setPaid(true);
    }
  }

  // ─── Step indicator ──────────────────────────────────────────────────────────

  const steps: { id: Step; label: string }[] = [
    { id: "tickets", label: "Tickets" },
    ...(seatMapAvailable ? [{ id: "seats" as Step, label: "Seats" }] : []),
    { id: "review", label: "Review" },
  ];
  const currentStepIdx = steps.findIndex((s) => s.id === step);

  // ─── Success state ───────────────────────────────────────────────────────────

  if (paid) {
    return (
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 text-center shadow-sm sm:p-8 lg:sticky lg:top-24">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-2xl font-black">Ticket Booked!</h2>
        <p className="text-zinc-500 mt-2 text-sm">
          Check your email for your ticket confirmation.
        </p>
        {qrCode && (
          <a
            href={`/ticket-confirmation?qr=${qrCode}&event=${event.slug}`}
            className="mt-4 inline-block rounded-2xl bg-orange-500 px-6 py-3 text-sm font-black text-white transition hover:bg-orange-600"
          >
            View Ticket →
          </a>
        )}
        <a
          href={`/events/${event.slug}`}
          className="mt-3 block text-sm text-zinc-400 hover:text-zinc-600 transition"
        >
          Back to Event
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white shadow-sm lg:sticky lg:top-24 overflow-hidden">
      {/* Step indicator */}
      <div className="border-b border-zinc-100 px-6 py-4">
        <div className="flex items-center gap-2">
          {steps.map((s, idx) => (
            <div key={s.id} className="flex items-center gap-2">
              <button
                onClick={() => idx < currentStepIdx && setStep(s.id)}
                className={`flex items-center gap-2 text-sm font-bold transition ${
                  s.id === step
                    ? "text-orange-600"
                    : idx < currentStepIdx
                    ? "text-zinc-400 hover:text-zinc-600 cursor-pointer"
                    : "text-zinc-300 cursor-not-allowed"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-black ${
                    s.id === step
                      ? "bg-orange-500 text-white"
                      : idx < currentStepIdx
                      ? "bg-green-500 text-white"
                      : "bg-zinc-200 text-zinc-500"
                  }`}
                >
                  {idx < currentStepIdx ? "✓" : idx + 1}
                </span>
                {s.label}
              </button>
              {idx < steps.length - 1 && (
                <span className="text-zinc-200">→</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 sm:p-8">
        {/* ── STEP 1: Ticket Selection ─────────────────────────────────────── */}
        {step === "tickets" && (
          <div className="space-y-5">
            {lowestPrice !== null && (
              <>
                <p className="text-zinc-500 mb-1">Starting from</p>
                <h2 className="text-5xl font-black">{formatPrice(lowestPrice)}</h2>
              </>
            )}

            {tickets.length > 0 && (
              <div className="space-y-3 mt-6">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className={`border rounded-2xl p-4 cursor-pointer transition ${
                      selectedTicket?.id === ticket.id
                        ? "border-orange-500 bg-orange-50"
                        : "border-zinc-200 hover:border-zinc-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold">{ticket.name}</h3>
                        <p className="text-zinc-500 text-sm">
                          {ticket.quantity} available
                        </p>
                      </div>
                      <p className="font-bold">{formatPrice(ticket.price)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!seatMapAvailable && selectedTicket && (
              <div className="flex items-center gap-4 mt-4">
                <span className="font-semibold">Quantity</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-8 h-8 rounded-full border border-zinc-300 font-bold hover:bg-zinc-100"
                  >
                    −
                  </button>
                  <span className="font-bold text-lg">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-8 h-8 rounded-full border border-zinc-300 font-bold hover:bg-zinc-100"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {selectedTicket && (
              <p className="text-zinc-500 text-sm mt-2">
                Total:{" "}
                <span className="font-bold text-black">
                  {formatPrice(effectivePrice)}
                </span>
              </p>
            )}

            {selectedTicket ? (
              <button
                onClick={() =>
                  seatMapAvailable ? setStep("seats") : goToReview()
                }
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-2xl font-bold text-lg mt-4 transition"
              >
                {seatMapAvailable ? "Choose Your Seat →" : "Continue →"}
              </button>
            ) : event.source_url ? (
              <a
                href={event.source_url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 block w-full rounded-2xl bg-orange-500 py-4 text-center text-lg font-bold text-white transition hover:bg-orange-600"
              >
                Get Tickets
              </a>
            ) : (
              <p className="mt-4 rounded-2xl bg-zinc-100 p-4 text-center font-semibold text-zinc-500">
                Tickets are not available yet.
              </p>
            )}
          </div>
        )}

        {/* ── STEP 2: Seat Selection ───────────────────────────────────────── */}
        {step === "seats" && seatMapAvailable && (
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-black">Choose Your Seat</h3>
              <p className="text-zinc-500 text-sm mt-1">
                Ticket: <strong>{selectedTicket?.name}</strong> · Click seats to
                select
              </p>
            </div>

            {loadingSeats ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : venueLayout ? (
              <SeatMap
                seats={allSeats}
                sections={venueLayout.sections}
                basePrice={selectedTicket?.price ?? 0}
                maxSelectable={quantity}
                onSelectionChange={setSelectedSeats}
              />
            ) : null}

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setStep("tickets")}
                className="flex-1 border border-zinc-300 text-zinc-700 py-3 rounded-2xl font-bold hover:bg-zinc-50 transition"
              >
                ← Back
              </button>
              <button
                onClick={goToReview}
                disabled={selectedSeats.length === 0}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-200 disabled:text-zinc-400 text-white py-3 rounded-2xl font-bold transition"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Review & Pay ─────────────────────────────────────────── */}
        {step === "review" && (
          <div className="space-y-5">
            <h3 className="text-xl font-black">Review &amp; Pay</h3>

            {/* Order summary */}
            <OrderSummary
              title="Order summary"
              accentColor="#f97316"
              items={[
                { label: "Ticket", value: selectedTicket?.name ?? "" },
                ...(seatLabel ? [{ label: "Seat(s)", value: seatLabel }] : []),
                { label: "Qty", value: String(selectedSeats.length || quantity) },
              ]}
              total={effectivePrice}
              currency="USD"
            />

            {/* Free ticket */}
            {effectivePrice === 0 ? (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Full name (optional)"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-500 transition"
                />
                <input
                  type="email"
                  placeholder="Email for ticket delivery (optional)"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-500 transition"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() =>
                      setStep(seatMapAvailable ? "seats" : "tickets")
                    }
                    className="flex-1 border border-zinc-300 text-zinc-700 py-3 rounded-2xl font-bold hover:bg-zinc-50 transition"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleFreeTicket}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-2xl font-bold transition"
                  >
                    Book Free Ticket
                  </button>
                </div>
              </div>
            ) : preparingPayment ? (
              /* Loading while PaymentIntent is being created */
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-zinc-400">Setting up secure payment…</p>
              </div>
            ) : clientSecret ? (
              /* ── Stripe PaymentElement (inline, no redirect) ── */
              <StripeProvider clientSecret={clientSecret} accentColor="#f97316">
                <PaymentForm
                  submitLabel={`Pay ${formatPrice(effectivePrice)}`}
                  accentColor="#f97316"
                  collectName
                  collectEmail
                  initialName={buyerName}
                  initialEmail={buyerEmail}
                  onNameChange={setBuyerName}
                  onEmailChange={setBuyerEmail}
                  onSuccess={() => setPaid(true)}
                  onBack={() => {
                    setStep(seatMapAvailable ? "seats" : "tickets");
                    setClientSecret(null);
                    setCheckoutAttemptId(null); // next attempt gets a new UUID
                    setQrCode(null);
                  }}
                />
              </StripeProvider>
            ) : (
              /* Fallback — intent creation failed */
              <div className="space-y-3">
                <p className="text-sm text-red-500 text-center">
                  Could not load payment form. Please go back and try again.
                </p>
                <button
                  onClick={() => {
                    setClientSecret(null);
                    setCheckoutAttemptId(null);
                    goToReview();
                  }}
                  className="w-full border border-zinc-300 text-zinc-700 py-3 rounded-2xl font-bold hover:bg-zinc-50 transition"
                >
                  Retry
                </button>
                <button
                  onClick={() =>
                    setStep(seatMapAvailable ? "seats" : "tickets")
                  }
                  className="w-full text-sm text-zinc-400 hover:text-zinc-600 transition"
                >
                  ← Back
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}