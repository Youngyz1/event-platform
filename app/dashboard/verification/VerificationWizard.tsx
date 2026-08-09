"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, FileText, Info, Loader2, Upload, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  VERIFICATION_DOCUMENT_TYPES,
  uploadPrivateDocument,
} from "@/lib/uploads";
import {
  ORGANIZER_TYPE_OPTIONS,
  evaluateSubmission,
  organizerTypeOption,
  resolveRequirements,
  type DocumentRecord,
  type OrganizerType,
  type RequirementRow,
} from "@/lib/verification-requirements";

/**
 * Verification onboarding wizard — type selection and requirement preview.
 *
 * Uploads go straight from the browser to the private bucket, so the bytes
 * never pass through a server route. The bucket's INSERT policy pins the path
 * to the caller's own folder, and the metadata row is written by
 * /api/verification/document running as the caller, so migration_59's RLS
 * stays the backstop rather than being bypassed.
 *
 * Follows the progressive-disclosure pattern BeneficiarySelector established:
 * one question per step, and only the fields the chosen type actually needs.
 * Showing every possible field at once is what the brief explicitly rules out.
 */

const STEPS = ["Who you are", "About you", "What we'll need"] as const;

/**
 * Country is optional and free-form for now.
 *
 * Every seeded requirement is scoped `country IS NULL`, so nothing changes
 * based on this value yet — the field exists so the data is being collected
 * when country-specific rules are added. Presenting a fixed dropdown would
 * imply the platform knows each country's rules, which it does not.
 */
type Draft = {
  organizerId: string;
  organizerType: OrganizerType | null;
  subcategory: string;
  country: string;
  /**
   * Only meaningful when organizerType is "individual" — a creator or other
   * individual fundraising FOR an organization rather than personally. When
   * true, the requirement preview and submission route through "nonprofit"
   * instead (see effectiveOrganizerType below), which is the only schema
   * change this needed: organizer_verification.on_behalf_of_org /
   * .on_behalf_relationship just record the declaration alongside the
   * otherwise-identical nonprofit submission (migration_62).
   */
  onBehalfOfOrg: boolean;
  onBehalfRelationship: string;
};

export default function VerificationWizard({
  requirementRows,
  organizers,
  userId,
}: {
  requirementRows: RequirementRow[];
  organizers: { id: string; name: string }[];
  userId: string;
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({
    organizerId: organizers[0]?.id ?? "",
    organizerType: null,
    subcategory: "",
    country: "",
    onBehalfOfOrg: false,
    onBehalfRelationship: "",
  });

  // Same step-change scroll reset used by the campaign wizard: advancing only
  // swaps the rendered step, leaving the reader mid-page otherwise.
  const topRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [status, setStatus] = useState<string>("draft");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  // An individual fundraising ON BEHALF OF an organization is routed through
  // the nonprofit requirement set — same documents, same review queue, no
  // parallel requirement table. The declaration and stated relationship are
  // recorded separately (draft.onBehalfOfOrg/.onBehalfRelationship) so a
  // reviewer still sees this is a creator representing an org, not the org's
  // own staff submitting directly.
  const effectiveOrganizerType: OrganizerType | null =
    draft.organizerType === "individual" && draft.onBehalfOfOrg
      ? "nonprofit"
      : draft.organizerType;

  const typeOption = organizerTypeOption(effectiveOrganizerType);

  // Resolved in memory on every change — no round-trip, so the preview updates
  // the instant a subcategory is picked.
  const requirements = useMemo(() => {
    if (!effectiveOrganizerType) return [];
    return resolveRequirements(
      {
        organizerType: effectiveOrganizerType,
        subcategory: draft.subcategory || null,
        country: draft.country || null,
      },
      requirementRows
    );
  }, [effectiveOrganizerType, draft.subcategory, draft.country, requirementRows]);

  const readiness = useMemo(
    () => evaluateSubmission(requirements, documents),
    [requirements, documents]
  );
  const requiredCount = requirements.filter((r) => r.isRequired).length;
  const canAdvance =
    step === 0
      ? Boolean(draft.organizerType)
      : step === 1
        ? !draft.onBehalfOfOrg || draft.onBehalfRelationship.trim().length > 0
        : true;
  const locked = status !== "draft" && status !== "changes_requested";

  /**
   * Create or update the draft before showing upload slots.
   *
   * A verification row has to exist before any document can reference it, so
   * this runs when entering the documents step rather than on first render —
   * merely opening the wizard should not create a record.
   */
  async function ensureVerification(): Promise<string | null> {
    if (verificationId) return verificationId;
    setBusy("verification");
    setError("");
    try {
      const res = await fetch("/api/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizerId: draft.organizerId,
          organizerType: effectiveOrganizerType,
          subcategory: draft.subcategory || null,
          country: draft.country || null,
          onBehalfOfOrg: draft.organizerType === "individual" ? draft.onBehalfOfOrg : false,
          onBehalfRelationship:
            draft.organizerType === "individual" && draft.onBehalfOfOrg
              ? draft.onBehalfRelationship.trim()
              : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not start your verification.");
        return null;
      }
      setVerificationId(data.verification.id);
      setStatus(data.verification.status);
      return data.verification.id as string;
    } catch {
      setError("Could not start your verification.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function handleUpload(documentType: string, file: File) {
    setError("");
    const id = await ensureVerification();
    if (!id) return;

    setBusy(documentType);
    try {
      // Straight to the private bucket. uploadPrivateDocument forces the path
      // to <userId>/… so it satisfies the storage policy, and returns a path
      // rather than a URL — there is no public URL for one of these.
      const { path } = await uploadPrivateDocument({
        supabase,
        userId,
        file,
      });

      const res = await fetch("/api/verification/document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verificationId: id,
          documentType,
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
      setDocuments((current) => [
        ...current,
        { document_type: documentType, status: "pending" },
      ]);
    } catch (err) {
      // Surfaces the size/type message uploadPrivateDocument throws.
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
      const res = await fetch("/api/verification/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.missing?.length
            ? `Still needed: ${data.missing.join(", ")}`
            : (data.error ?? "Could not submit for review.")
        );
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
      <div ref={topRef} aria-hidden className="scroll-mt-24" />

      <h1 className="text-2xl font-black text-zinc-950 sm:text-3xl">
        Get verified
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        We ask for different things depending on who you are. Tell us that
        first and we&apos;ll only ask for what applies to you.
      </p>

      {/* Progress */}
      <ol className="mt-6 flex items-center gap-2" aria-label="Progress">
        {STEPS.map((label, index) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                index < step
                  ? "bg-brand-700 text-white"
                  : index === step
                    ? "bg-brand-100 text-brand-800 ring-2 ring-brand-700"
                    : "bg-zinc-100 text-zinc-400"
              }`}
            >
              {index < step ? <Check size={14} /> : index + 1}
            </span>
            <span
              className={`hidden text-xs font-bold sm:block ${
                index === step ? "text-zinc-900" : "text-zinc-400"
              }`}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      {/* ── Step 1: who are you fundraising as? ── */}
      {step === 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-black text-zinc-950">
            Who are you fundraising as?
          </h2>
          <div className="mt-4 grid gap-3">
            {ORGANIZER_TYPE_OPTIONS.map((option) => {
              const selected = draft.organizerType === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      organizerType: option.value,
                      // Subcategories are per-type; keeping a stale one would
                      // silently mis-scope the requirement lookup.
                      subcategory: "",
                      // Only individual shows the on-behalf-of toggle; leaving
                      // it set while switching away would silently keep
                      // routing requirements through "nonprofit" for a type
                      // where the toggle is no longer even visible.
                      onBehalfOfOrg: false,
                      onBehalfRelationship: "",
                    }))
                  }
                  aria-pressed={selected}
                  className={`rounded-2xl border p-4 text-left transition ${
                    selected
                      ? "border-brand-700 bg-brand-50 ring-2 ring-brand-700"
                      : "border-zinc-200 bg-white hover:border-zinc-300"
                  }`}
                >
                  <span className="block text-sm font-black text-zinc-950">
                    {option.label}
                  </span>
                  <span className="mt-1 block text-xs text-zinc-500">
                    {option.helper}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Step 2: narrow it down ── */}
      {step === 1 && typeOption && (
        <section className="mt-8 space-y-6">
          <h2 className="text-lg font-black text-zinc-950">
            Tell us a bit more
          </h2>

          {draft.organizerType === "individual" && (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={draft.onBehalfOfOrg}
                  onChange={(event) =>
                    setDraft((d) => ({
                      ...d,
                      onBehalfOfOrg: event.target.checked,
                      // The subcategory list is about to switch between
                      // individual's and nonprofit's — a value picked under
                      // one would silently mis-scope the requirement lookup
                      // under the other.
                      subcategory: "",
                      onBehalfRelationship: event.target.checked ? d.onBehalfRelationship : "",
                    }))
                  }
                  className="mt-0.5 h-4 w-4 accent-brand-700"
                />
                <span>
                  <span className="block text-sm font-black text-zinc-800">
                    Are you fundraising on behalf of an organization?
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-zinc-500">
                    If you&apos;re raising money for a nonprofit, charity or
                    other organization rather than for yourself, check this —
                    we&apos;ll ask for that organization&apos;s documents
                    instead of a personal ones.
                  </span>
                </span>
              </label>

              {draft.onBehalfOfOrg && (
                <label className="mt-4 block">
                  <span className="mb-2 block text-sm font-black text-zinc-800">
                    Your relationship to the organization
                  </span>
                  <input
                    value={draft.onBehalfRelationship}
                    onChange={(event) =>
                      setDraft((d) => ({
                        ...d,
                        onBehalfRelationship: event.target.value,
                      }))
                    }
                    placeholder="e.g. authorized representative, volunteer, employee"
                    className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none focus:border-brand-600"
                  />
                  <span className="mt-2 block text-xs text-zinc-500">
                    A reviewer will check this against the proof-of-authority
                    document you upload for the organization.
                  </span>
                </label>
              )}
            </div>
          )}

          <label className="block">
            <span className="mb-2 block text-sm font-black text-zinc-800">
              {draft.onBehalfOfOrg
                ? "Which best describes the organization?"
                : "Which best describes you?"}
            </span>
            <select
              value={draft.subcategory}
              onChange={(event) =>
                setDraft((d) => ({ ...d, subcategory: event.target.value }))
              }
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none focus:border-brand-600"
            >
              <option value="">Select…</option>
              {typeOption.subcategories.map((sub) => (
                <option key={sub.value} value={sub.value}>
                  {sub.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-black text-zinc-800">
              Country <span className="font-medium text-zinc-400">(optional)</span>
            </span>
            <input
              value={draft.country}
              onChange={(event) =>
                setDraft((d) => ({ ...d, country: event.target.value }))
              }
              placeholder="e.g. NG, US, GB"
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none focus:border-brand-600"
            />
            <span className="mt-2 block text-xs text-zinc-500">
              Requirements can differ by country. Leave blank if you&apos;re not
              sure — we&apos;ll use our standard list.
            </span>
          </label>

          {organizers.length > 1 && (
            <label className="block">
              <span className="mb-2 block text-sm font-black text-zinc-800">
                Which profile is this for?
              </span>
              <select
                value={draft.organizerId}
                onChange={(event) =>
                  setDraft((d) => ({ ...d, organizerId: event.target.value }))
                }
                className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none focus:border-brand-600"
              >
                {organizers.map((organizer) => (
                  <option key={organizer.id} value={organizer.id}>
                    {organizer.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </section>
      )}

      {/* ── Step 3: requirement preview ── */}
      {step === 2 && (
        <section className="mt-8">
          <h2 className="text-lg font-black text-zinc-950">
            What we&apos;ll need from you
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            {requiredCount} required
            {requirements.length > requiredCount &&
              `, ${requirements.length - requiredCount} optional`}
            .
          </p>

          <ul className="mt-5 space-y-3">
            {readiness.requirements.map((req) => {
              const uploading = busy === req.documentType;
              return (
                <li
                  key={req.documentType}
                  className="flex gap-3 rounded-2xl border border-zinc-200 bg-white p-4"
                >
                  {req.status === "accepted" || req.status === "uploaded" ? (
                    <Check size={18} aria-hidden className="mt-0.5 shrink-0 text-brand-700" />
                  ) : req.status === "rejected" ? (
                    <X size={18} aria-hidden className="mt-0.5 shrink-0 text-red-600" />
                  ) : (
                    <FileText size={18} aria-hidden className="mt-0.5 shrink-0 text-zinc-400" />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black text-zinc-950">
                        {req.label}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          req.isRequired
                            ? "bg-brand-50 text-brand-800"
                            : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {req.isRequired ? "Required" : "Optional"}
                      </span>
                      {/* Four distinct states rather than a checkbox: uploaded
                          and accepted are different claims, and a reviewer
                          rejecting a document has to be visible. */}
                      {req.status !== "missing" && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            req.status === "accepted"
                              ? "bg-brand-100 text-brand-800"
                              : req.status === "rejected"
                                ? "bg-red-50 text-red-600"
                                : "bg-zinc-100 text-zinc-600"
                          }`}
                        >
                          {req.status === "accepted"
                            ? "Verified"
                            : req.status === "rejected"
                              ? "Needs attention"
                              : "Uploaded"}
                        </span>
                      )}
                    </div>

                    {/* Explaining why a document is wanted is the difference
                        between a form people complete and one they abandon. */}
                    {req.description && (
                      <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                        {req.description}
                      </p>
                    )}

                    {!locked && (
                      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-300 px-3 py-2 text-xs font-black text-zinc-700 transition hover:bg-zinc-50">
                        {uploading ? (
                          <Loader2 size={14} className="animate-spin" aria-hidden />
                        ) : (
                          <Upload size={14} aria-hidden />
                        )}
                        {uploading
                          ? "Uploading…"
                          : req.status === "missing"
                            ? "Upload"
                            : "Replace"}
                        <input
                          type="file"
                          className="hidden"
                          accept={VERIFICATION_DOCUMENT_TYPES.join(",")}
                          disabled={Boolean(busy)}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            // Cleared so picking the same file twice still fires.
                            event.target.value = "";
                            if (file) handleUpload(req.documentType, file);
                          }}
                        />
                      </label>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {requirements.length === 0 && (
            <p className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
              No requirements are configured for this combination yet.
            </p>
          )}

          {error && (
            <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
              {error}
            </p>
          )}

          {locked ? (
            <p className="mt-6 flex gap-2 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-xs leading-relaxed text-brand-900">
              <Check size={16} aria-hidden className="mt-0.5 shrink-0" />
              <span>
                Submitted for review. We&apos;ll be in touch — documents
                can&apos;t be changed while a review is in progress.
              </span>
            </p>
          ) : (
            <p className="mt-6 flex gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-xs leading-relaxed text-zinc-500">
              <Info size={16} aria-hidden className="mt-0.5 shrink-0" />
              <span>
                Your documents are stored privately. They are never public, and
                only you and our review team can open them.
              </span>
            </p>
          )}
        </section>
      )}

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="rounded-xl border border-zinc-300 px-5 py-3 text-sm font-black text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-40"
        >
          Back
        </button>

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => {
              const next = step + 1;
              setStep(next);
              // Entering the documents step is the point a record is needed.
              if (next === STEPS.length - 1) void ensureVerification();
            }}
            disabled={!canAdvance || Boolean(busy)}
            title={
              !canAdvance && step === 1
                ? "Enter your relationship to the organization to continue"
                : undefined
            }
            className="rounded-xl bg-brand-700 px-5 py-3 text-sm font-black text-white transition hover:bg-brand-800 disabled:opacity-40"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            // Mirrors the server gate. The route re-checks completeness itself,
            // so this only saves a round-trip — it is not the enforcement.
            disabled={locked || !readiness.canSubmit || Boolean(busy)}
            title={
              locked
                ? "Already submitted"
                : readiness.canSubmit
                  ? undefined
                  : `Still needed: ${readiness.missingRequired.join(", ")}`
            }
            className="rounded-xl bg-brand-700 px-5 py-3 text-sm font-black text-white transition hover:bg-brand-800 disabled:bg-zinc-200 disabled:text-zinc-500"
          >
            {busy === "submit"
              ? "Submitting…"
              : locked
                ? "Submitted"
                : "Submit for review"}
          </button>
        )}
      </div>
    </main>
  );
}
