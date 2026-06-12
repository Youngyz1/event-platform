"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { loadStripe } from "@stripe/stripe-js";
import type {
  PaymentRequest as StripePaymentRequest,
  PaymentRequestPaymentMethodEvent,
} from "@stripe/stripe-js";
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const PRESETS = [25, 50, 100, 150, 200, 500];
const TIP_PERCENTAGES = [0, 10, 15, 20];

const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "NL", name: "Netherlands" },
  { code: "IE", name: "Ireland" },
  { code: "NZ", name: "New Zealand" },
  { code: "ZA", name: "South Africa" },
  { code: "NG", name: "Nigeria" },
  { code: "GH", name: "Ghana" },
  { code: "KE", name: "Kenya" },
  { code: "JM", name: "Jamaica" },
  { code: "TT", name: "Trinidad & Tobago" },
];

type PaymentMethod = "google_pay" | "card";

type DonatePageProps = {
  fundraiserTitle: string;
  fundraiserSlug: string;
  organizerName: string;
  banner: string;
  raised: number;
  goal: number;
};

type PaymentDetails = {
  email: string;
  firstName: string;
  lastName: string;
  cardName: string;
  country: string;
  postalCode: string;
  saveCard: boolean;
  anonymous: boolean;
};

type PaymentSectionProps = {
  details: PaymentDetails;
  donationAmount: number;
  fundraiserSlug: string;
  fundraiserTitle: string;
  onDetailsChange: (details: PaymentDetails) => void;
  onSuccess: () => void;
  paymentMethod: PaymentMethod;
  tipAmount: number;
  total: number;
  setPaymentMethod: (method: PaymentMethod) => void;
};

const stripeElementOptions = {
  style: {
    base: {
      color: "#18181b",
      fontFamily: "inherit",
      fontSize: "16px",
      "::placeholder": {
        color: "#a1a1aa",
      },
    },
    invalid: {
      color: "#dc2626",
    },
  },
};

function formatMoney(amount: number) {
  return `$${amount.toFixed(2)}`;
}

function LockIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function ShieldCheck() {
  return (
    <svg className="h-4 w-4 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function GPayMark() {
  return (
    <span className="inline-flex items-center gap-0.5 rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-[11px] font-black leading-none tracking-tight">
      <span className="text-blue-600">G</span>
      <span className="text-red-500">P</span>
      <span className="text-yellow-500">a</span>
      <span className="text-green-500">y</span>
    </span>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

function StripeField({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-12 rounded-xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus-within:border-green-500">
      {children}
    </div>
  );
}

function PaymentSection({
  details,
  donationAmount,
  fundraiserSlug,
  fundraiserTitle,
  onDetailsChange,
  onSuccess,
  paymentMethod,
  tipAmount,
  total,
  setPaymentMethod,
}: PaymentSectionProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [paymentRequest, setPaymentRequest] = useState<StripePaymentRequest | null>(null);
  const [googlePayReady, setGooglePayReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const totalCents = Math.max(0, Math.round(total * 100));
  const displayName = `${details.firstName} ${details.lastName}`.trim();
  const donorName = details.anonymous ? "Anonymous" : displayName || details.cardName || "Anonymous";
  const billingName = details.cardName.trim() || displayName || "Anonymous";

  function updateDetails(patch: Partial<PaymentDetails>) {
    onDetailsChange({ ...details, ...patch });
    setError("");
  }

  async function createIntent(overrides?: { donorEmail?: string; donorName?: string }) {
    const response = await fetch("/api/donate/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: donationAmount,
        tip: tipAmount,
        fundraiserSlug,
        fundraiserTitle,
        donorName: overrides?.donorName || donorName,
        donorEmail: overrides?.donorEmail || details.email.trim(),
        anonymous: details.anonymous,
        saveCard: details.saveCard,
      }),
    });

    const data = await response.json();
    if (!response.ok || data.error || !data.clientSecret) {
      throw new Error(data.error || "Could not start the payment.");
    }

    return data.clientSecret as string;
  }

  useEffect(() => {
    if (!stripe || totalCents < 100) {
      setPaymentRequest(null);
      setGooglePayReady(false);
      return;
    }

    let active = true;
    const request = stripe.paymentRequest({
      country: "US",
      currency: "usd",
      total: {
        label: "Total due today",
        amount: totalCents,
      },
      displayItems: [
        { label: "Your donation", amount: Math.round(donationAmount * 100) },
        { label: "Tip", amount: Math.round(tipAmount * 100) },
      ],
      requestPayerEmail: true,
      requestPayerName: true,
      disableWallets: ["applePay", "link", "browserCard"],
    });

    const handlePaymentMethod = async (event: PaymentRequestPaymentMethodEvent) => {
      setSubmitting(true);
      setError("");

      try {
        const clientSecret = await createIntent({
          donorEmail: event.payerEmail || details.email.trim(),
          donorName: details.anonymous ? "Anonymous" : event.payerName || donorName,
        });

        const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
          clientSecret,
          { payment_method: event.paymentMethod.id },
          { handleActions: false }
        );

        if (confirmError) {
          event.complete("fail");
          throw new Error(confirmError.message || "Google Pay could not be completed.");
        }

        event.complete("success");

        if (paymentIntent?.status === "requires_action") {
          const { error: actionError } = await stripe.confirmCardPayment(clientSecret);
          if (actionError) {
            throw new Error(actionError.message || "Payment authentication failed.");
          }
        }

        onSuccess();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Payment failed. Please try again.";
        setError(message);
      } finally {
        setSubmitting(false);
      }
    };

    request.on("paymentmethod", handlePaymentMethod);

    request.canMakePayment().then((result) => {
      if (!active) return;
      setPaymentRequest(request);
      setGooglePayReady(Boolean(result?.googlePay));
    });

    return () => {
      active = false;
      request.off("paymentmethod", handlePaymentMethod);
    };
  }, [
    details,
    donationAmount,
    donorName,
    fundraiserSlug,
    fundraiserTitle,
    onSuccess,
    stripe,
    tipAmount,
    totalCents,
  ]);

  async function handleCardSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements) return;

    setError("");

    if (paymentMethod === "google_pay") {
      if (donationAmount < 1) {
        setError("Please select a donation amount.");
        return;
      }

      if (!paymentRequest || !googlePayReady) {
        setError("Google Pay is not available in this browser. Choose credit or debit to continue here.");
        return;
      }

      try {
        paymentRequest.show();
      } catch {
        setError("Google Pay could not be opened. Please try again or choose credit or debit.");
      }
      return;
    }

    if (donationAmount < 1) {
      setError("Please select a donation amount.");
      return;
    }

    if (!details.email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (!details.firstName.trim() || !details.lastName.trim()) {
      setError("Please enter your first and last name.");
      return;
    }

    if (!details.cardName.trim()) {
      setError("Please enter the name on the card.");
      return;
    }

    if (!details.postalCode.trim()) {
      setError("Please enter your postal code.");
      return;
    }

    const card = elements.getElement(CardNumberElement);
    if (!card) {
      setError("Card details are still loading.");
      return;
    }

    setSubmitting(true);
    try {
      const clientSecret = await createIntent();
      const { error: confirmError } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card,
          billing_details: {
            email: details.email.trim(),
            name: billingName,
            address: {
              country: details.country,
              postal_code: details.postalCode.trim(),
            },
          },
        },
      });

      if (confirmError) {
        throw new Error(confirmError.message || "Payment failed. Please try again.");
      }

      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payment failed. Please try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleCardSubmit} className="min-w-0 space-y-5">
      <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h3 className="text-base font-black">Payment method</h3>
          <div className="flex items-center gap-1 text-xs text-zinc-400">
            <LockIcon />
            <span>Secured by Stripe</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-200">
          <label className="flex cursor-pointer items-center gap-3 border-b border-zinc-200 px-4 py-4 transition hover:bg-zinc-50">
            <input
              type="radio"
              name="paymentMethod"
              checked={paymentMethod === "google_pay"}
              onChange={() => setPaymentMethod("google_pay")}
              className="h-4 w-4 accent-green-600"
            />
            <GPayMark />
            <span className="text-sm font-semibold">Google Pay</span>
          </label>

          {paymentMethod === "google_pay" && (
            <div className="space-y-3 border-b border-zinc-200 bg-zinc-50 px-4 py-4">
              {googlePayReady && paymentRequest ? (
                <p className="rounded-xl border border-green-100 bg-white px-4 py-3 text-sm text-green-800">
                  Google Pay is ready. Donate now will open secure confirmation for {formatMoney(total)}.
                </p>
              ) : (
                <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-500">
                  Google Pay is not available in this browser. Choose credit or debit to continue here.
                </p>
              )}
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-3 px-4 py-4 transition hover:bg-zinc-50">
            <input
              type="radio"
              name="paymentMethod"
              checked={paymentMethod === "card"}
              onChange={() => setPaymentMethod("card")}
              className="h-4 w-4 accent-green-600"
            />
            <svg className="h-5 w-5 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 10h18M7 15h4" />
            </svg>
            <span className="text-sm font-semibold">Credit or debit</span>
          </label>

          {paymentMethod === "card" && (
            <div className="space-y-3 border-t border-zinc-200 bg-zinc-50 px-4 py-4">
              <label>
                <FieldLabel>Email address</FieldLabel>
                <input
                  type="email"
                  value={details.email}
                  onChange={(event) => updateDetails({ email: event.target.value })}
                  placeholder="Email address"
                  autoComplete="email"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-green-500"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <FieldLabel>First name</FieldLabel>
                  <input
                    type="text"
                    value={details.firstName}
                    onChange={(event) => updateDetails({ firstName: event.target.value })}
                    placeholder="First name"
                    autoComplete="given-name"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-green-500"
                  />
                </label>
                <label>
                  <FieldLabel>Last name</FieldLabel>
                  <input
                    type="text"
                    value={details.lastName}
                    onChange={(event) => updateDetails({ lastName: event.target.value })}
                    placeholder="Last name"
                    autoComplete="family-name"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-green-500"
                  />
                </label>
              </div>

              <label>
                <FieldLabel>Card number</FieldLabel>
                <StripeField>
                  <CardNumberElement options={stripeElementOptions} />
                </StripeField>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <FieldLabel>MM/YY</FieldLabel>
                  <StripeField>
                    <CardExpiryElement options={stripeElementOptions} />
                  </StripeField>
                </label>
                <label>
                  <FieldLabel>CVV</FieldLabel>
                  <StripeField>
                    <CardCvcElement options={stripeElementOptions} />
                  </StripeField>
                </label>
              </div>

              <label>
                <FieldLabel>Name on card</FieldLabel>
                <input
                  type="text"
                  value={details.cardName}
                  onChange={(event) => updateDetails({ cardName: event.target.value })}
                  placeholder="Name on card"
                  autoComplete="cc-name"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-green-500"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <FieldLabel>Country</FieldLabel>
                  <select
                    value={details.country}
                    onChange={(event) => updateDetails({ country: event.target.value })}
                    autoComplete="country"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-green-500"
                  >
                    {COUNTRIES.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <FieldLabel>Postal code</FieldLabel>
                  <input
                    type="text"
                    value={details.postalCode}
                    onChange={(event) => updateDetails({ postalCode: event.target.value })}
                    placeholder="Postal code"
                    autoComplete="postal-code"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-green-500"
                  />
                </label>
              </div>

              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={details.saveCard}
                  onChange={(event) => updateDetails({ saveCard: event.target.checked })}
                  className="mt-0.5 h-4 w-4 accent-green-600"
                />
                <span className="text-sm text-zinc-600">Save card for future donations</span>
              </label>
            </div>
          )}
        </div>

        <label className="mt-5 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={details.anonymous}
            onChange={(event) => updateDetails({ anonymous: event.target.checked })}
            className="mt-0.5 h-4 w-4 accent-green-600"
          />
          <span className="text-sm text-zinc-600">Don't display my name publicly</span>
        </label>

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}
      </div>

      <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-6">
        <h3 className="mb-4 text-base font-black">Order summary</h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Your donation</span>
            <span className="font-black">{donationAmount >= 1 ? formatMoney(donationAmount) : "$0.00"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Tip (optional)</span>
            <span className="font-semibold text-zinc-600">{formatMoney(tipAmount)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-zinc-100 pt-3">
            <span className="font-black">Total due today</span>
            <span className="text-lg font-black text-green-700">{formatMoney(total)}</span>
          </div>
        </div>
        <button
          type="submit"
          disabled={
            submitting ||
            !stripe ||
            donationAmount < 1 ||
            (paymentMethod === "google_pay" && (!paymentRequest || !googlePayReady))
          }
          className="mt-5 w-full rounded-2xl bg-green-700 py-4 text-base font-black text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-green-300 active:scale-[.99]"
        >
          {submitting ? "Processing..." : "Donate now"}
        </button>
      </div>
    </form>
  );
}

export default function DonatePage({
  fundraiserTitle,
  fundraiserSlug,
  organizerName,
  banner,
  raised,
  goal,
}: DonatePageProps) {
  const [selectedAmount, setSelectedAmount] = useState(50);
  const [customAmount, setCustomAmount] = useState("");
  const [tipPct, setTipPct] = useState(15);
  const [customTip, setCustomTip] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [success, setSuccess] = useState(false);
  const [details, setDetails] = useState<PaymentDetails>({
    email: "",
    firstName: "",
    lastName: "",
    cardName: "",
    country: "US",
    postalCode: "",
    saveCard: false,
    anonymous: false,
  });

  const finalAmount = customAmount ? Number(customAmount) : selectedAmount;
  const donationAmount = Number.isFinite(finalAmount) && finalAmount > 0 ? finalAmount : 0;
  const tipAmount = customTip
    ? Number(customTip)
    : tipPct > 0
      ? Math.round(donationAmount * (tipPct / 100) * 100) / 100
      : 0;
  const safeTipAmount = Number.isFinite(tipAmount) && tipAmount > 0 ? tipAmount : 0;
  const total = donationAmount + safeTipAmount;
  const pct = goal > 0 ? Math.min(Math.round((raised / goal) * 100), 100) : 0;

  const elementsOptions = useMemo(
    () => ({
      appearance: {
        theme: "stripe" as const,
        variables: {
          colorPrimary: "#15803d",
          borderRadius: "12px",
          fontFamily: "inherit",
        },
      },
    }),
    []
  );

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
        <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="mt-5 text-2xl font-black">Thank you!</h1>
          <p className="mt-3 text-zinc-500">
            Your donation of <span className="font-black text-green-700">{formatMoney(total)}</span> to{" "}
            <span className="font-semibold">{fundraiserTitle}</span> has been received.
          </p>
          <Link
            href={`/fundraisers/${fundraiserSlug}`}
            className="mt-8 inline-block rounded-2xl bg-green-700 px-8 py-3 font-black text-white transition hover:bg-green-800"
          >
            Back to fundraiser
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="border-b border-zinc-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link
            href={`/fundraisers/${fundraiserSlug}`}
            className="flex items-center gap-2 text-sm text-zinc-500 transition hover:text-zinc-800"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to fundraiser
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <LockIcon />
            Secure checkout
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[1fr_360px] lg:gap-10 lg:py-14">
        <div className="min-w-0 space-y-5">
          <div className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-4">
            <img src={banner} alt={fundraiserTitle} className="h-16 w-24 shrink-0 rounded-xl object-cover" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">You're supporting</p>
              <h2 className="mt-0.5 truncate text-base font-black">{fundraiserTitle}</h2>
              <p className="mt-0.5 truncate text-sm text-zinc-500">
                Your donation will benefit {organizerName}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <h3 className="mb-4 text-base font-black">Choose an amount</h3>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {PRESETS.map((preset) => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => {
                    setSelectedAmount(preset);
                    setCustomAmount("");
                  }}
                  className={`rounded-xl border py-3 text-sm font-black transition ${
                    selectedAmount === preset && !customAmount
                      ? "border-green-500 bg-green-50 text-green-700"
                      : "border-zinc-200 hover:border-green-300"
                  }`}
                >
                  ${preset}
                </button>
              ))}
            </div>
            <div className="relative mt-3">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-zinc-400">$</span>
              <input
                type="number"
                min="1"
                step="1"
                value={customAmount}
                onChange={(event) => {
                  setCustomAmount(event.target.value);
                  setSelectedAmount(0);
                }}
                placeholder="Other amount"
                className="w-full rounded-xl border border-zinc-200 py-3 pl-8 pr-16 font-black outline-none transition focus:border-green-500"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-zinc-400">.00</span>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <h3 className="mb-1 text-base font-black">
              Add a tip <span className="text-sm font-normal text-zinc-400">(optional)</span>
            </h3>
            <p className="mb-4 text-xs text-zinc-400">Tips help us keep the platform running.</p>
            <div className="flex flex-wrap gap-2">
              {TIP_PERCENTAGES.map((percentage) => (
                <button
                  type="button"
                  key={percentage}
                  onClick={() => {
                    setTipPct(percentage);
                    setCustomTip("");
                  }}
                  className={`rounded-xl border px-4 py-2 text-sm font-black transition ${
                    tipPct === percentage && !customTip
                      ? "border-green-500 bg-green-50 text-green-700"
                      : "border-zinc-200 hover:border-green-300"
                  }`}
                >
                  {percentage === 0 ? "None" : `${percentage}%`}
                </button>
              ))}
            </div>
            {tipPct > 0 && !customTip && donationAmount >= 1 && (
              <p className="mt-2 text-xs text-zinc-400">
                = {formatMoney(safeTipAmount)} tip on ${donationAmount} donation
              </p>
            )}
          </div>

          <Elements stripe={stripePromise} options={elementsOptions}>
            <PaymentSection
              details={details}
              donationAmount={donationAmount}
              fundraiserSlug={fundraiserSlug}
              fundraiserTitle={fundraiserTitle}
              onDetailsChange={setDetails}
              onSuccess={() => setSuccess(true)}
              paymentMethod={paymentMethod}
              tipAmount={safeTipAmount}
              total={total}
              setPaymentMethod={setPaymentMethod}
            />
          </Elements>

          <p className="text-center text-xs text-zinc-400">
            By clicking 'Donate now', you agree to our{" "}
            <a href="/privacy" className="underline hover:text-zinc-600">Privacy Policy</a>.
            Donations are processed securely via Stripe.
          </p>
        </div>

        <div className="min-w-0 h-fit space-y-4 lg:sticky lg:top-8">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <h3 className="mb-4 text-base font-black">Your donation</h3>
            <div className="mb-5">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">${raised.toLocaleString()} raised</span>
                <span className="font-black text-green-700">{pct}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
              {goal > 0 && <p className="mt-1 text-xs text-zinc-400">Goal: ${goal.toLocaleString()}</p>}
            </div>

            <div className="divide-y divide-zinc-100">
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-zinc-600">Your donation</span>
                <span className="text-sm font-black">{donationAmount >= 1 ? formatMoney(donationAmount) : "$0.00"}</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-zinc-600">Tip (optional)</span>
                <span className="text-sm font-semibold text-zinc-500">{formatMoney(safeTipAmount)}</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-sm font-black">Total due today</span>
                <span className="text-lg font-black text-green-700">{formatMoney(total)}</span>
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-zinc-400">
              Donations processed securely via Stripe.{" "}
              <a href="/privacy" className="underline hover:text-zinc-600">Privacy Policy</a>.
            </p>
          </div>

          <div className="flex items-start gap-2 rounded-2xl border border-green-100 bg-green-50 p-4">
            <ShieldCheck />
            <p className="text-xs leading-5 text-green-800">
              <span className="font-black">Donation Protection Guarantee -</span>{" "}
              We guarantee a full refund if something is not right.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
