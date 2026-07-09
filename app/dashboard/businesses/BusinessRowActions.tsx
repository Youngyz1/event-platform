"use client";

import { useState } from "react";
import Link from "next/link";

type Business = {
  id: string;
  name: string;
  slug: string;
  status: string;
  listing_tier: string;
};

export default function BusinessRowActions({
  business,
  onDelete,
}: {
  business: Business;
  onDelete: (formData: FormData) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  async function handleCheckout() {
    setLoading(true);
    try {
      const res = await fetch("/api/checkout/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: business.id }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to create checkout session.");
        setLoading(false);
      }
    } catch (err) {
      console.error("Checkout error:", err);
      alert("An error occurred. Please try again.");
      setLoading(false);
    }
  }

  const needsPayment = business.status === "pending_payment" || business.status === "expired";

  return (
    <div className="flex items-center justify-end gap-2">
      {needsPayment && (
        <button
          onClick={handleCheckout}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-black text-white hover:bg-orange-700 disabled:opacity-50 transition"
        >
          {loading ? "Loading..." : business.status === "expired" ? "Renew" : "Pay & Activate"}
        </button>
      )}

      {business.status === "active" && (
        <Link
          href={`/businesses/${business.slug}`}
          target="_blank"
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
        >
          View Public
        </Link>
      )}

      <Link
        href={`/dashboard/businesses/${business.id}/edit`}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
      >
        Edit
      </Link>

      <form
        action={onDelete}
        onSubmit={(e) => {
          if (!confirm("Are you sure you want to delete this business listing?")) {
            e.preventDefault();
          }
        }}
        className="inline-block"
      >
        <input type="hidden" name="id" value={business.id} />
        <button
          type="submit"
          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 transition"
        >
          Delete
        </button>
      </form>
    </div>
  );
}
