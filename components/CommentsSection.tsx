"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type CommentTarget = "event" | "fundraiser";

type CommentItem = {
  id: string;
  author_name: string | null;
  body: string;
  created_at: string;
};

type CommentsSectionProps = {
  targetType: CommentTarget;
  targetId: string;
  title?: string;
  accent?: "orange" | "green";
};

const accentClasses = {
  orange: {
    label: "text-orange-600",
    button: "bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300",
    ring: "focus:border-orange-500",
    avatar: "bg-orange-100 text-orange-700",
  },
  green: {
    label: "text-green-700",
    button: "bg-green-600 hover:bg-green-700 disabled:bg-green-300",
    ring: "focus:border-green-500",
    avatar: "bg-green-100 text-green-700",
  },
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function CommentsSection({
  targetType,
  targetId,
  title = "Comments",
  accent = "orange",
}: CommentsSectionProps) {
  const styles = accentClasses[accent];
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const mountedRef = useRef(false);

  const characterCount = body.length;
  const helperText = useMemo(
    () =>
      targetType === "event"
        ? "Ask a question, share a note, or help others know what to expect."
        : "Leave encouragement, a question, or a public update for this fundraiser.",
    [targetType]
  );

  useEffect(() => {
    mountedRef.current = true;
    let active = true;

    async function loadComments() {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        targetType,
        targetId,
      });

      const response = await fetch(`/api/comments?${params.toString()}`, {
        cache: "no-store",
      });
      const result = await response.json();

      if (!active || !mountedRef.current) return;

      if (!response.ok) {
        setError(result.error || "Could not load comments.");
      } else {
        setComments(result.comments || []);
      }

      setLoading(false);
    }

    loadComments();

    return () => {
      active = false;
      mountedRef.current = false;
    };
  }, [targetType, targetId]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (body.trim().length < 2) {
      setError("Please write a comment before posting.");
      return;
    }

    setSubmitting(true);

    const response = await fetch("/api/comments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        targetType,
        targetId,
        authorName,
        authorEmail,
        body,
      }),
    });
    const result = await response.json();

    if (!mountedRef.current) return;

    if (!response.ok) {
      setError(result.error || "Could not post your comment.");
      setSubmitting(false);
      return;
    }

    setComments((current) => [result.comment, ...current]);
    setAuthorName("");
    setAuthorEmail("");
    setBody("");
    setSubmitting(false);
  }

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8">
      <p className={`text-sm font-black uppercase tracking-wide ${styles.label}`}>
        Community
      </p>
      <h2 className="mt-2 text-3xl font-black">{title}</h2>
      <p className="mt-3 text-zinc-600">{helperText}</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <input
            value={authorName}
            onChange={(event) => setAuthorName(event.target.value)}
            maxLength={120}
            placeholder="Name (optional)"
            className={`w-full rounded-2xl border border-zinc-300 px-4 py-3 outline-none ${styles.ring}`}
          />
          <input
            value={authorEmail}
            onChange={(event) => setAuthorEmail(event.target.value)}
            maxLength={255}
            type="email"
            placeholder="Email (optional, not shown)"
            className={`w-full rounded-2xl border border-zinc-300 px-4 py-3 outline-none ${styles.ring}`}
          />
        </div>

        <div>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={1000}
            required
            rows={4}
            placeholder="Write a public comment"
            className={`w-full resize-none rounded-2xl border border-zinc-300 px-4 py-3 outline-none ${styles.ring}`}
          />
          <div className="mt-2 flex items-center justify-between gap-3 text-sm text-zinc-500">
            <span>Comments appear publicly on this page.</span>
            <span>{characterCount}/1000</span>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className={`rounded-full px-6 py-3 font-black text-white transition ${styles.button}`}
        >
          {submitting ? "Posting..." : "Post Comment"}
        </button>
      </form>

      <div className="mt-8 space-y-4">
        {loading ? (
          <div className="rounded-2xl bg-zinc-50 p-5 text-zinc-500">Loading comments...</div>
        ) : comments.length === 0 ? (
          <div className="rounded-2xl bg-zinc-50 p-5 text-zinc-500">
            No comments yet. Be the first to start the conversation.
          </div>
        ) : (
          comments.map((comment) => {
            const displayName = comment.author_name || "Anonymous";

            return (
              <article key={comment.id} className="rounded-2xl border border-zinc-200 p-5">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-black ${styles.avatar}`}
                  >
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h3 className="font-black">{displayName}</h3>
                      <p className="text-sm text-zinc-500">{formatDate(comment.created_at)}</p>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap leading-7 text-zinc-700">
                      {comment.body}
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
