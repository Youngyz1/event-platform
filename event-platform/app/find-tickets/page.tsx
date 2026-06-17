"use client";

import { useState } from "react";
import Link from "next/link";


type Order = {
  id: string;
  qr_code: string;
  status: string;
  seat_label: string | null;
  quantity: number;
  total_amount: number;
  created_at: string;
  checked_in_at: string | null;
  events: {
    title: string;
    event_date: string | null;
    venue: string | null;
    city: string | null;
    banner: string | null;
    slug: string | null;
  } | null;
};

const statusStyle: Record<string, { label: string; classes: string }> = {
  valid: { label: "Valid", classes: "bg-green-100 text-green-700" },
  used: { label: "Used", classes: "bg-zinc-100 text-zinc-500" },
  cancelled: { label: "Cancelled", classes: "bg-red-100 text-red-600" },
  refunded: { label: "Refunded", classes: "bg-orange-100 text-orange-600" },
};

export default function FindTicketsPage() {
  const [email, setEmail] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSearched(false);

    try {
      const res = await fetch(`/api/my-tickets?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setOrders(data.orders || []);
        setSearched(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
       

      <section className="max-w-2xl mx-auto px-6 py-16">
        <div className="mb-10">
          <p className="text-sm font-black uppercase tracking-wide text-orange-600">Tickets</p>
          <h1 className="text-4xl font-black mt-2">Find My Tickets</h1>
          <p className="text-zinc-500 mt-3">
            Enter the email address you used when purchasing your ticket.
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSearch} className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm mb-8">
          <label className="block font-semibold mb-2">Email address</label>
          <div className="flex gap-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="flex-1 border border-zinc-200 rounded-xl px-4 py-3 outline-none focus:border-orange-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white px-6 py-3 rounded-xl font-bold transition"
            >
              {loading ? "Searching..." : "Find Tickets"}
            </button>
          </div>
          {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
        </form>

        {/* Results */}
        {searched && orders.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-zinc-300">
            <p className="text-4xl mb-4">🎟️</p>
            <h2 className="text-xl font-black">No tickets found</h2>
            <p className="text-zinc-500 mt-2">
              No orders found for <strong>{email}</strong>.<br />
              Make sure you use the same email from your confirmation.
            </p>
          </div>
        )}

        {orders.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-500 font-semibold">
              {orders.length} ticket{orders.length !== 1 ? "s" : ""} found for <strong>{email}</strong>
            </p>
            {orders.map((order) => {
              const status = statusStyle[order.status] ?? statusStyle.valid;
              return (
                <div
                  key={order.id}
                  className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition"
                >
                  <div className="flex gap-4">
                    {/* Event banner */}
                    <div className="w-28 flex-shrink-0 bg-zinc-100">
                      <img
                        src={
                          order.events?.banner ||
                          "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=400&auto=format&fit=crop"
                        }
                        alt={order.events?.title || "Event"}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 py-4 pr-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-black text-zinc-900 leading-tight">
                          {order.events?.title || "Event"}
                        </h3>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${status.classes}`}>
                          {status.label}
                        </span>
                      </div>

                      {order.events?.event_date && (
                        <p className="text-sm text-orange-600 font-semibold mt-1">
                          {new Date(order.events.event_date).toLocaleDateString("en-US", {
                            weekday: "short", month: "short", day: "numeric",
                          })}
                        </p>
                      )}

                      {(order.events?.venue || order.events?.city) && (
                        <p className="text-sm text-zinc-500 mt-0.5">
                          {[order.events.venue, order.events.city].filter(Boolean).join(", ")}
                        </p>
                      )}

                      <div className="flex items-center justify-between mt-3">
                        <p className="text-sm text-zinc-400">
                          {order.quantity} ticket{order.quantity > 1 ? "s" : ""}
                          {order.seat_label && ` · ${order.seat_label}`}
                          {" · "}
                          {order.total_amount === 0 ? "Free" : `$${order.total_amount.toFixed(2)}`}
                        </p>
                        <Link
                          href={`/ticket-confirmation?qr=${order.qr_code}&event=${order.events?.slug || ""}`}
                          className="text-sm font-bold text-orange-500 hover:text-orange-600 transition"
                        >
                          View Ticket →
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Login prompt */}
        <div className="mt-10 text-center">
          <p className="text-zinc-500 text-sm">
            Have an account?{" "}
            <Link href="/my-tickets" className="text-orange-500 font-semibold hover:underline">
              View all your tickets →
            </Link>
          </p>
        </div>
      </section>

    </main>
  );
}
