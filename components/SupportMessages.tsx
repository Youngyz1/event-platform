"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ProfileNotSetUpModal, {
  type ProfileActivity,
} from "@/components/ProfileNotSetUpModal";

type AuthorProfile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
} | null;

type SupportMessage = {
  id: string;
  author_name: string | null;
  body: string;
  created_at: string;
  user_id?: string | null;
  donor_amount?: number | null;
  author_profile?: AuthorProfile;
};

const PAGE_SIZE = 5;

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

type ModalState = {
  name: string;
  activity: ProfileActivity;
} | null;

export default function SupportMessages({
  fundraiserId,
}: {
  fundraiserId: string;
}) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    let active = true;

    async function load() {
      setLoading(true);
      const params = new URLSearchParams({
        targetType: "fundraiser",
        targetId: fundraiserId,
        includeDonorAmounts: "true",
        limit: String(PAGE_SIZE),
        offset: "0",
      });
      const res = await fetch(`/api/comments?${params}`, { cache: "no-store" });
      const result = await res.json();
      if (!active || !mountedRef.current) return;
      const rows: SupportMessage[] = result.comments || [];
      setMessages(rows);
      setHasMore(rows.length === PAGE_SIZE);
      setLoading(false);
    }

    load();
    return () => {
      active = false;
      mountedRef.current = false;
    };
  }, [fundraiserId]);

  async function loadMore() {
    setLoadingMore(true);
    const params = new URLSearchParams({
      targetType: "fundraiser",
      targetId: fundraiserId,
      includeDonorAmounts: "true",
      limit: String(PAGE_SIZE),
      offset: String(messages.length),
    });
    const res = await fetch(`/api/comments?${params}`, { cache: "no-store" });
    const result = await res.json();
    const rows: SupportMessage[] = result.comments || [];
    setMessages((current) => [...current, ...rows]);
    setHasMore(rows.length === PAGE_SIZE);
    setLoadingMore(false);
  }

  return (
    <section>
      <h2 className="text-lg font-black text-zinc-950">Comments</h2>
      <p className="mt-1 text-sm text-zinc-500">Please donate to comment.</p>

      <div className="mt-8 divide-y divide-zinc-100">
        {loading ? (
          <p className="py-5 text-zinc-500">Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className="py-5 text-zinc-500">
            No comments yet. Be the first to start the conversation.
          </p>
        ) : (
          messages.map((msg) => {
            const name = msg.author_name || "Anonymous";
            const profile = msg.author_profile ?? null;
            // Navigate to profile only if they have a customised profile
            // (display_name or avatar_url set). A guest with no user_id, or a
            // registered user who never set one up, both get the modal.
            const hasCustomizedProfile = Boolean(
              profile && (profile.display_name || profile.avatar_url)
            );
            const displayName = profile?.display_name || name;

            return (
              <article key={msg.id} className="py-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 font-black text-zinc-600">
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      {hasCustomizedProfile ? (
                        <Link
                          href={`/profile/${profile!.id}`}
                          className="font-black text-zinc-950 transition hover:text-emerald-600 hover:underline"
                        >
                          {displayName}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setModal({
                              name,
                              activity: {
                                type: "comment",
                                body: msg.body,
                                amount: msg.donor_amount,
                              },
                            })
                          }
                          className="text-left font-black text-zinc-950 hover:underline"
                        >
                          {name}
                        </button>
                      )}
                      {msg.donor_amount != null && msg.donor_amount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-black text-green-700">
                          <HeartIcon className="h-3 w-3" />$
                          {msg.donor_amount}
                        </span>
                      )}
                      <p className="text-sm text-zinc-500">
                        {formatDate(msg.created_at)}
                      </p>
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

      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="mt-4 w-full rounded-full border border-zinc-300 py-2 text-sm font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          {loadingMore ? "Loading..." : "Load more"}
        </button>
      )}

      <ProfileNotSetUpModal
        isOpen={modal !== null}
        onClose={() => setModal(null)}
        name={modal?.name ?? ""}
        activity={
          modal?.activity ?? { type: "comment", body: "", amount: null }
        }
      />
    </section>
  );
}