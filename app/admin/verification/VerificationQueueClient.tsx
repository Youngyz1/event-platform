"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Check,
  ExternalLink,
  FileText,
  Loader2,
  ShieldAlert,
  X,
} from "lucide-react";
import AdminDrawer from "@/components/admin/AdminDrawer";
import AdminManagementToolbar from "@/components/admin/AdminManagementToolbar";
import RejectionReasonModal from "@/components/admin/RejectionReasonModal";

export type QueueDocument = {
  id: string;
  documentType: string;
  storagePath: string;
  fileName: string | null;
  status: string;
  rejectionReason: string | null;
  uploadedAt: string | null;
};

export type QueueRow = {
  id: string;
  organizerId: string;
  organizerName: string;
  organizerSlug: string | null;
  organizerStatus: string | null;
  organizerType: string;
  subcategory: string | null;
  country: string | null;
  status: string;
  submitterName: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  identityVerifiedAt: string | null;
  organizationVerifiedAt: string | null;
  createdAt: string;
  documents: QueueDocument[];
};

/** Decisions that need a written reason — mirrors the route's REASON_REQUIRED. */
const REASON_ACTIONS = new Set(["reject", "request_changes", "suspend"]);

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600",
  submitted: "bg-amber-100 text-amber-800",
  under_review: "bg-blue-100 text-blue-800",
  changes_requested: "bg-orange-100 text-orange-800",
  approved: "bg-brand-100 text-brand-800",
  rejected: "bg-red-100 text-red-700",
  suspended: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Awaiting review",
  under_review: "Under review",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Rejected",
  suspended: "Suspended",
};

const DOC_STATUS_STYLES: Record<string, string> = {
  pending: "bg-zinc-100 text-zinc-600",
  accepted: "bg-brand-100 text-brand-800",
  rejected: "bg-red-100 text-red-700",
};

function humanise(value: string): string {
  return value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Pending decision awaiting a reason from the modal. */
type PendingDecision =
  | { kind: "review"; action: string }
  | { kind: "document"; documentId: string };

export default function VerificationQueueClient({ rows }: { rows: QueueRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("submitted");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<PendingDecision | null>(null);

  const selected = rows.find((row) => row.id === selectedId) ?? null;

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) map.set(row.status, (map.get(row.status) ?? 0) + 1);
    return map;
  }, [rows]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (tab !== "all" && row.status !== tab) return false;
      if (typeFilter !== "all" && row.organizerType !== typeFilter) return false;
      if (!term) return true;
      return [row.organizerName, row.submitterName]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(term));
    });
  }, [rows, search, tab, typeFilter]);

  /**
   * Opens a document by minting a signed link at click time.
   *
   * Deliberately not prefetched for the whole list: a link minted on render
   * would still be valid in a screenshot or a browser history entry after the
   * reviewer moved on. Sixty seconds from the moment of intent is the point.
   */
  async function openDocument(doc: QueueDocument) {
    setBusy(`doc-open-${doc.id}`);
    setError("");
    try {
      const res = await fetch("/api/verification/document-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: doc.storagePath }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not open that document.");
        return;
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      setError("Could not open that document.");
    } finally {
      setBusy(null);
    }
  }

  async function submitDocumentDecision(
    documentId: string,
    action: "accept" | "reject",
    reason?: string
  ) {
    setBusy(`doc-${documentId}`);
    setError("");
    try {
      const res = await fetch("/api/admin/verification/document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, action, reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not update that document.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not update that document.");
    } finally {
      setBusy(null);
    }
  }

  async function submitReview(action: string, reason?: string) {
    if (!selected) return;
    setBusy(action);
    setError("");
    try {
      const res = await fetch("/api/admin/verification/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationId: selected.id, action, reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        // The route returns which required documents are still unaccepted;
        // surfacing them turns a refusal into an instruction.
        setError(
          data.outstanding?.length
            ? `${data.error} Still outstanding: ${data.outstanding
                .map(humanise)
                .join(", ")}.`
            : (data.error ?? "Could not record that decision.")
        );
        return;
      }
      router.refresh();
    } catch {
      setError("Could not record that decision.");
    } finally {
      setBusy(null);
    }
  }

  function handleReasonConfirm(reason: string) {
    const decision = pending;
    setPending(null);
    if (!decision || !reason.trim()) return;
    if (decision.kind === "review") {
      void submitReview(decision.action, reason.trim());
    } else {
      void submitDocumentDecision(decision.documentId, "reject", reason.trim());
    }
  }

  const isClosed =
    selected?.status === "approved" ||
    selected?.status === "rejected" ||
    selected?.status === "suspended";

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-black text-zinc-950">Verification</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Review organizer identity and authority documents. Approving requires
          every required document to be accepted first.
        </p>
      </header>

      <AdminManagementToolbar
        search={search}
        searchPlaceholder="Search organizer or submitter…"
        onSearchChange={setSearch}
        tabs={[
          { value: "submitted", label: "Awaiting review", count: counts.get("submitted") ?? 0 },
          { value: "changes_requested", label: "Changes requested", count: counts.get("changes_requested") ?? 0 },
          { value: "approved", label: "Approved", count: counts.get("approved") ?? 0 },
          { value: "all", label: "All", count: rows.length },
        ]}
        activeTab={tab}
        onTabChange={setTab}
        filters={[
          {
            id: "type",
            label: "Organizer type",
            value: typeFilter,
            onChange: setTypeFilter,
            options: [
              { value: "all", label: "All types" },
              { value: "individual", label: "Individual" },
              { value: "group", label: "Group" },
              { value: "nonprofit", label: "Nonprofit" },
              { value: "business", label: "Business" },
            ],
          },
        ]}
      />

      {error && !selected && (
        <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-3">
        {visible.length === 0 && (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-10 text-center text-sm font-semibold text-zinc-500">
            Nothing here.
          </p>
        )}

        {visible.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => {
              setSelectedId(row.id);
              setError("");
            }}
            className="flex w-full flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-left transition hover:border-brand-300 hover:bg-brand-50/30"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-black text-zinc-950">
                  {row.organizerName}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLES[row.status] ?? "bg-zinc-100 text-zinc-600"}`}
                >
                  {STATUS_LABELS[row.status] ?? humanise(row.status)}
                </span>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-bold text-zinc-600">
                  {humanise(row.organizerType)}
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-zinc-500">
                {row.submitterName ?? "unnamed submitter"} · submitted{" "}
                {formatDate(row.submittedAt)} · {row.documents.length} document
                {row.documents.length === 1 ? "" : "s"}
              </p>
            </div>
            {row.identityVerifiedAt && (
              <BadgeCheck size={18} aria-hidden className="shrink-0 text-brand-700" />
            )}
          </button>
        ))}
      </div>

      <AdminDrawer
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        title={selected?.organizerName ?? ""}
        subtitle={
          selected
            ? `${humanise(selected.organizerType)}${selected.subcategory ? ` · ${humanise(selected.subcategory)}` : ""}${selected.country ? ` · ${selected.country}` : ""}`
            : undefined
        }
        width="xl"
        footer={
          selected && !isClosed ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void submitReview("approve")}
                disabled={Boolean(busy)}
                className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-brand-800 disabled:opacity-50"
              >
                {busy === "approve" ? "Approving…" : "Approve"}
              </button>
              <button
                type="button"
                onClick={() => setPending({ kind: "review", action: "request_changes" })}
                disabled={Boolean(busy)}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-bold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
              >
                Request changes
              </button>
              <button
                type="button"
                onClick={() => setPending({ kind: "review", action: "reject" })}
                disabled={Boolean(busy)}
                className="rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          ) : selected ? (
            <button
              type="button"
              onClick={() => setPending({ kind: "review", action: "suspend" })}
              disabled={Boolean(busy) || selected.status === "suspended"}
              className="flex items-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            >
              <ShieldAlert size={16} aria-hidden />
              {selected.status === "suspended" ? "Suspended" : "Suspend verification"}
            </button>
          ) : undefined
        }
      >
        {selected && (
          <div className="space-y-5">
            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                {error}
              </p>
            )}

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs font-black uppercase tracking-wide text-zinc-400">Submitted by</dt>
                <dd className="mt-0.5 truncate font-bold text-zinc-800">
                  {selected.submitterName ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-black uppercase tracking-wide text-zinc-400">Submitted</dt>
                <dd className="mt-0.5 font-bold text-zinc-800">{formatDate(selected.submittedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-black uppercase tracking-wide text-zinc-400">Identity verified</dt>
                <dd className="mt-0.5 font-bold text-zinc-800">{formatDate(selected.identityVerifiedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-black uppercase tracking-wide text-zinc-400">Organization verified</dt>
                <dd className="mt-0.5 font-bold text-zinc-800">
                  {selected.organizerType === "individual"
                    ? "N/A"
                    : formatDate(selected.organizationVerifiedAt)}
                </dd>
              </div>
            </dl>

            {selected.organizerSlug && (
              <a
                href={`/org/${selected.organizerSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 underline"
              >
                View public profile <ExternalLink size={14} aria-hidden />
              </a>
            )}

            <div>
              <h3 className="text-sm font-black text-zinc-950">Documents</h3>
              {selected.documents.length === 0 && (
                <p className="mt-2 text-sm text-zinc-500">No documents uploaded.</p>
              )}
              <ul className="mt-3 space-y-3">
                {selected.documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="rounded-2xl border border-zinc-200 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <FileText size={16} aria-hidden className="shrink-0 text-zinc-400" />
                      <span className="text-sm font-black text-zinc-950">
                        {humanise(doc.documentType)}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${DOC_STATUS_STYLES[doc.status] ?? "bg-zinc-100 text-zinc-600"}`}
                      >
                        {humanise(doc.status)}
                      </span>
                    </div>

                    <p className="mt-1 truncate text-xs text-zinc-500">
                      {doc.fileName ?? doc.storagePath.split("/").pop()}
                    </p>

                    {doc.rejectionReason && (
                      <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                        {doc.rejectionReason}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void openDocument(doc)}
                        disabled={Boolean(busy)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 px-3 py-2 text-xs font-black text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                      >
                        {busy === `doc-open-${doc.id}` ? (
                          <Loader2 size={14} className="animate-spin" aria-hidden />
                        ) : (
                          <ExternalLink size={14} aria-hidden />
                        )}
                        Open
                      </button>

                      {!isClosed && (
                        <>
                          <button
                            type="button"
                            onClick={() => void submitDocumentDecision(doc.id, "accept")}
                            disabled={Boolean(busy) || doc.status === "accepted"}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-brand-300 px-3 py-2 text-xs font-black text-brand-700 transition hover:bg-brand-50 disabled:opacity-40"
                          >
                            {busy === `doc-${doc.id}` ? (
                              <Loader2 size={14} className="animate-spin" aria-hidden />
                            ) : (
                              <Check size={14} aria-hidden />
                            )}
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => setPending({ kind: "document", documentId: doc.id })}
                            disabled={Boolean(busy)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 px-3 py-2 text-xs font-black text-red-600 transition hover:bg-red-50 disabled:opacity-40"
                          >
                            <X size={14} aria-hidden />
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </AdminDrawer>

      {pending && REASON_ACTIONS.has(
        pending.kind === "review" ? pending.action : "reject"
      ) && (
        <RejectionReasonModal
          onCancel={() => setPending(null)}
          onConfirm={handleReasonConfirm}
        />
      )}
    </main>
  );
}
