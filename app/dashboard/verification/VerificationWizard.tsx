"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, FileText, Info } from "lucide-react";
import {
  ORGANIZER_TYPE_OPTIONS,
  organizerTypeOption,
  resolveRequirements,
  type OrganizerType,
  type RequirementRow,
} from "@/lib/verification-requirements";

/**
 * Verification onboarding wizard — type selection and requirement preview.
 *
 * Phase 2c-i: this component writes NOTHING. It exists to prove the requirement
 * engine drives the right document list from a real user's selections before
 * uploads are wired in (2c-ii).
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
};

export default function VerificationWizard({
  requirementRows,
  organizers,
}: {
  requirementRows: RequirementRow[];
  organizers: { id: string; name: string }[];
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({
    organizerId: organizers[0]?.id ?? "",
    organizerType: null,
    subcategory: "",
    country: "",
  });

  // Same step-change scroll reset used by the campaign wizard: advancing only
  // swaps the rendered step, leaving the reader mid-page otherwise.
  const topRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  const typeOption = organizerTypeOption(draft.organizerType);

  // Resolved in memory on every change — no round-trip, so the preview updates
  // the instant a subcategory is picked.
  const requirements = useMemo(() => {
    if (!draft.organizerType) return [];
    return resolveRequirements(
      {
        organizerType: draft.organizerType,
        subcategory: draft.subcategory || null,
        country: draft.country || null,
      },
      requirementRows
    );
  }, [draft.organizerType, draft.subcategory, draft.country, requirementRows]);

  const requiredCount = requirements.filter((r) => r.isRequired).length;
  const canAdvance = step === 0 ? Boolean(draft.organizerType) : true;

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

          <label className="block">
            <span className="mb-2 block text-sm font-black text-zinc-800">
              Which best describes you?
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
            {requirements.map((req) => (
              <li
                key={req.documentType}
                className="flex gap-3 rounded-2xl border border-zinc-200 bg-white p-4"
              >
                <FileText
                  size={18}
                  aria-hidden
                  className="mt-0.5 shrink-0 text-zinc-400"
                />
                <div className="min-w-0">
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
                  </div>
                  {/* Explaining why a document is wanted is the difference
                      between a form people complete and one they abandon. */}
                  {req.description && (
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                      {req.description}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {requirements.length === 0 && (
            <p className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
              No requirements are configured for this combination yet.
            </p>
          )}

          <p className="mt-6 flex gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-xs leading-relaxed text-zinc-500">
            <Info size={16} aria-hidden className="mt-0.5 shrink-0" />
            <span>
              Uploading isn&apos;t available yet — this step currently shows what
              will be asked for. Your documents are stored privately and are only
              ever visible to you and our review team.
            </span>
          </p>
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
            onClick={() => setStep((s) => s + 1)}
            disabled={!canAdvance}
            className="rounded-xl bg-brand-700 px-5 py-3 text-sm font-black text-white transition hover:bg-brand-800 disabled:opacity-40"
          >
            Continue
          </button>
        ) : (
          // Submission lands in 2c-ii along with the uploads it depends on.
          <button
            type="button"
            disabled
            title="Available once document upload is added"
            className="rounded-xl bg-zinc-200 px-5 py-3 text-sm font-black text-zinc-500"
          >
            Continue to documents
          </button>
        )}
      </div>
    </main>
  );
}
