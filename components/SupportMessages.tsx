"use client";

import { useEffect, useRef, useState } from "react";

type SupportMessage = {
  id: string;
  author_name: string | null;
  body: string;
  created_at: string;
  donor_amount?: number | null;
};

type SupportMessagesProps = {
  fundraiserId: string;
  // Provided after a successful donation redirect
  donorName?: string;
  donorEmail?: string;
  donorAmount?: number;
  stripeSessionId?: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
    </svg>
  );
}

export default function SupportMessages({
  fundraiserId,
  donorName = "",
  donorEmail = "",
  donorAmount,
  stripeSessionId = "",
}: SupportMessagesProps) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const mountedRef = useRef(false);

  const canComment = Boolean(stripeSessionId);

  useEffect(() => {
    mountedRef.current = true;
    let active = true;

    async function load() {
      setLoading(true);
      const params = new URLSearchParams({
        targetType: "fundraiser",
        targetId: fundraiserId,
        includeDonorAmounts: "true",
      });
      const res = await fetch(`/api/comments?${params}`, { cache: "no-store" });
      const result = await res.json();
      if (!active || !mountedRef.current) return;
      setMessages(result.comments || []);
      setLoading(false);
    }

    load();
    return () => {
      active = false;
      mountedRef.current = false;
    };
  }, [fundraiserId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");

    if (body.trim().length < 2) {
      setSubmitError("Please write a message before posting.");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetType: "fundraiser",
        targetId: fundraiserId,
        authorName: donorName || "Anonymous",
        authorEmail: donorEmail || null,
        body: body.trim(),
        stripeSessionId,
      }),
    });
    const result = await res.json();

    if (!mountedRef.current) return;

    if (!res.ok) {
      setSubmitError(result.error || "Could not post your message.");
      setSubmitting(false);
      return;
    }

    setMessages((prev) => [result.comment, ...prev]);
    setBody("");
    setSubmitted(true);
    setSubmitting(false);
  }

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <HeartIcon className="h-6 w-6 text-green-500 shrink-0" />
        <p className="text-sm font-black uppercase tracking-wide text-green-700">Community</p>
      </div>
      <h2 className="mt-2 text-3xl font-black">Words of Support</h2>
      <p className="mt-3 text-zinc-600">Please donate to share words of support.</p>

      {/* Post-donation message form */}
      {canComment && !submitted && (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-black text-green-800">
              Thank you{donorName ? `, ${donorName}` : ""}!
              {donorAmount ? ` Your $${donorAmount} donation` : " Your donation"} has been received.
              Share a few words of support below.
            </p>
          </div>

          <div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={1000}
              required
              rows={4}
              placeholder="Write a message of support…"
              className="w-full resize-none rounded-2xl border border-zinc-300 px-4 py-3 outline-none focus:border-green-500"
            />
            <div className="mt-2 flex justify-end text-sm text-zinc-400">
              {body.length}/1000
            </div>
          </div>

          {submitError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-green-600 px-6 py-3 font-black text-white transition hover:bg-green-700 disabled:bg-green-300"
          >
            {submitting ? "Posting…" : "Share your support"}
          </button>
        </form>
      )}

      {/* Submitted confirmation */}
      {submitted && (
        <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-sm font-semibold text-green-800">
          ✓ Your message has been posted. Thank you for your support!
        </div>
      )}

      {/* Messages list */}
      <div className="mt-8 space-y-4">
        {loading ? (
          <div className="rounded-2xl bg-zinc-50 p-5 text-zinc-500">Loading messages…</div>
        ) : messages.length === 0 ? (
          <div className="rounded-2xl bg-zinc-50 p-5 text-zinc-500">
            No comments yet. Be the first to start the conversation.
          </div>
        ) : (
          messages.map((msg) => {
            const name = msg.author_name || "Anonymous";
            return (
              <article key={msg.id} className="rounded-2xl border border-zinc-200 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 font-black text-green-700">
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h3 className="font-black">{name}</h3>
                      {msg.donor_amount != null && msg.donor_amount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-black text-green-700">
                          <HeartIcon className="h-3 w-3" />
                          Donated ${msg.donor_amount}
                        </span>
                      )}
                      <p className="text-sm text-zinc-500">{formatDate(msg.created_at)}</p>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap leading-7 text-zinc-700">
                      {msg.body}
                    </p>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
