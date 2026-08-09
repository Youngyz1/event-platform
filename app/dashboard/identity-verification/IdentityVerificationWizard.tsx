"use client";

import { useState } from "react";
import { Check, FileText, Info, Loader2, Upload } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { VERIFICATION_DOCUMENT_TYPES, uploadPrivateDocument } from "@/lib/uploads";

/**
 * Identity verification — one step, one document.
 *
 * Stripped down from VerificationWizard (app/dashboard/verification), not a
 * copy of it: that component's three steps and requirement-preview machinery
 * exist because organizer requirements vary by type/subcategory/country.
 * Identity verification always asks for exactly one thing (a government ID),
 * for every person, forever — there is nothing to select or resolve, so this
 * has no type step and does not import lib/verification-requirements at all.
 * What IS reused: uploadPrivateDocument (identical call shape) and the same
 * locked/status handling pattern.
 */
export default function IdentityVerificationWizard({
  userId,
  initialVerificationId,
  initialStatus,
  initialHasDocument,
}: {
  userId: string;
  initialVerificationId: string | null;
  initialStatus: string;
  initialHasDocument: boolean;
}) {
  const [verificationId, setVerificationId] = useState(initialVerificationId);
  const [status, setStatus] = useState(initialStatus);
  const [hasDocument, setHasDocument] = useState(initialHasDocument);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const locked = status !== "draft" && status !== "changes_requested";

  /** Mirrors VerificationWizard's ensureVerification: a row only needs to
   *  exist once a document is actually being attached, not on first render. */
  async function ensureVerification(): Promise<string | null> {
    if (verificationId) return verificationId;
    setBusy("verification");
    setError("");
    try {
      const res = await fetch("/api/identity-verification", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not start your identity verification.");
        return null;
      }
      setVerificationId(data.verification.id);
      setStatus(data.verification.status);
      return data.verification.id as string;
    } catch {
      setError("Could not start your identity verification.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function handleUpload(file: File) {
    setError("");
    const id = await ensureVerification();
    if (!id) return;

    setBusy("upload");
    try {
      const { path } = await uploadPrivateDocument({ supabase, userId, file });

      const res = await fetch("/api/identity-verification/document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identityVerificationId: id,
          storagePath: path,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not attach that document.");
        return;
      }
      setHasDocument(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(null);
    }
  }

  async function handleSubmit() {
    if (!verificationId) return;
    setBusy("submit");
    setError("");
    try {
      const res = await fetch("/api/identity-verification/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identityVerificationId: verificationId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not submit for review.");
        return;
      }
      setStatus(data.verification.status);
    } catch {
      setError("Could not submit for review.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-black text-zinc-950 sm:text-3xl">
        Verify your identity
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        One document, checked once — this confirms who you are across the
        whole platform, not just for one organization you manage.
      </p>

      <section className="mt-8">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="flex gap-3">
            {hasDocument ? (
              <Check size={18} aria-hidden className="mt-0.5 shrink-0 text-brand-700" />
            ) : (
              <FileText size={18} aria-hidden className="mt-0.5 shrink-0 text-zinc-400" />
            )}
            <div className="min-w-0 flex-1">
              <span className="text-sm font-black text-zinc-950">
                Government-issued ID
              </span>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                A passport, national ID or driving licence. Used to confirm
                you are who you say you are.
              </p>

              {!locked && (
                <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-300 px-3 py-2 text-xs font-black text-zinc-700 transition hover:bg-zinc-50">
                  {busy === "upload" ? (
                    <Loader2 size={14} className="animate-spin" aria-hidden />
                  ) : (
                    <Upload size={14} aria-hidden />
                  )}
                  {busy === "upload" ? "Uploading…" : hasDocument ? "Replace" : "Upload"}
                  <input
                    type="file"
                    className="hidden"
                    accept={VERIFICATION_DOCUMENT_TYPES.join(",")}
                    disabled={Boolean(busy)}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void handleUpload(file);
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
            {error}
          </p>
        )}

        {locked ? (
          <p className="mt-6 flex gap-2 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-xs leading-relaxed text-brand-900">
            <Check size={16} aria-hidden className="mt-0.5 shrink-0" />
            <span>
              {status === "approved"
                ? "Your identity is verified."
                : status === "rejected"
                  ? "This submission was rejected. Contact support for next steps."
                  : status === "suspended"
                    ? "This verification has been suspended. Contact support for next steps."
                    : "Submitted for review. We'll be in touch — this can't be changed while a review is in progress."}
            </span>
          </p>
        ) : (
          <>
            <p className="mt-6 flex gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-xs leading-relaxed text-zinc-500">
              <Info size={16} aria-hidden className="mt-0.5 shrink-0" />
              <span>
                Your document is stored privately. It is never public, and
                only you and our review team can open it.
              </span>
            </p>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!hasDocument || Boolean(busy)}
              title={hasDocument ? undefined : "Upload your ID to continue"}
              className="mt-6 w-full rounded-xl bg-brand-700 px-5 py-3 text-sm font-black text-white transition hover:bg-brand-800 disabled:bg-zinc-200 disabled:text-zinc-500"
            >
              {busy === "submit" ? "Submitting…" : "Submit for review"}
            </button>
          </>
        )}
      </section>
    </main>
  );
}
