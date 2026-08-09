/**
 * Requirement engine for organizer verification (Phase 2b).
 *
 * Decides which documents a given organizer must provide, and whether what
 * they have provided is enough to submit. Pure logic over the
 * `verification_requirements` rows seeded in migration_59 — the rule set is
 * data, so requirements change without a deploy.
 *
 * Nothing here talks to the network except `fetchRequirements`, which is a thin
 * query wrapper. The resolution and evaluation functions are deliberately pure
 * so they can be tested without a database.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const ORGANIZER_TYPES = [
  "individual",
  "nonprofit",
  "business",
  "community",
] as const;

export type OrganizerType = (typeof ORGANIZER_TYPES)[number];

export type RequirementRow = {
  organizer_type: string;
  /** null = applies to every subcategory of this type */
  subcategory: string | null;
  /** null = applies to every country */
  country: string | null;
  document_type: string;
  is_required: boolean;
  label: string;
  description: string | null;
  sort_order: number;
};

export type ResolvedRequirement = {
  documentType: string;
  isRequired: boolean;
  label: string;
  description: string | null;
  sortOrder: number;
  /** Which scope won, for debugging and for the admin UI to explain itself. */
  matchedScope: "type" | "type+country" | "type+subcategory" | "type+subcategory+country";
};

export type VerificationScope = {
  organizerType: OrganizerType;
  subcategory?: string | null;
  country?: string | null;
};

/**
 * How specific a rule is. Higher wins.
 *
 * A rule applies if its subcategory/country are either null (wildcard) or an
 * exact match. Among the rules that apply to one document_type, the most
 * specific one is used — so a country-specific override silently replaces the
 * default rather than being added alongside it.
 */
function specificity(row: RequirementRow): number {
  const hasSub = row.subcategory !== null;
  const hasCountry = row.country !== null;
  if (hasSub && hasCountry) return 3;
  if (hasSub) return 2;
  if (hasCountry) return 1;
  return 0;
}

function scopeLabel(row: RequirementRow): ResolvedRequirement["matchedScope"] {
  const hasSub = row.subcategory !== null;
  const hasCountry = row.country !== null;
  if (hasSub && hasCountry) return "type+subcategory+country";
  if (hasSub) return "type+subcategory";
  if (hasCountry) return "type+country";
  return "type";
}

/** Case-insensitive, whitespace-tolerant comparison for the scope keys. */
function matches(ruleValue: string | null, scopeValue: string | null | undefined): boolean {
  if (ruleValue === null) return true; // wildcard
  if (!scopeValue) return false;
  return ruleValue.trim().toLowerCase() === scopeValue.trim().toLowerCase();
}

/**
 * Resolve the requirement list for a scope.
 *
 * Note this UNIONS across specificity levels rather than picking a single tier:
 * an orphanage gets the base nonprofit documents PLUS its own
 * facility_authorisation. Only when two rules name the SAME document_type does
 * the more specific one win — which is what lets a country rule flip a default
 * from required to optional without deleting it.
 */
export function resolveRequirements(
  scope: VerificationScope,
  rows: RequirementRow[]
): ResolvedRequirement[] {
  const applicable = rows.filter(
    (row) =>
      row.organizer_type === scope.organizerType &&
      matches(row.subcategory, scope.subcategory) &&
      matches(row.country, scope.country)
  );

  const winners = new Map<string, RequirementRow>();
  for (const row of applicable) {
    const current = winners.get(row.document_type);
    if (!current || specificity(row) > specificity(current)) {
      winners.set(row.document_type, row);
    }
  }

  return [...winners.values()]
    .map((row) => ({
      documentType: row.document_type,
      isRequired: row.is_required,
      label: row.label,
      description: row.description,
      sortOrder: row.sort_order,
      matchedScope: scopeLabel(row),
    }))
    .sort((a, b) =>
      a.sortOrder !== b.sortOrder
        ? a.sortOrder - b.sortOrder
        : a.documentType.localeCompare(b.documentType)
    );
}

export type DocumentRecord = {
  document_type: string;
  status: string; // 'pending' | 'accepted' | 'rejected'
};

export type RequirementStatus =
  | "missing"
  | "uploaded"
  | "accepted"
  | "rejected";

export type EvaluatedRequirement = ResolvedRequirement & {
  status: RequirementStatus;
};

export type SubmissionReadiness = {
  requirements: EvaluatedRequirement[];
  /** Required documents with nothing uploaded, or with a rejected upload. */
  missingRequired: string[];
  /** Every required document has at least a pending upload. */
  canSubmit: boolean;
  /** Every required document has been accepted by a reviewer. */
  allRequiredAccepted: boolean;
};

/**
 * Score a set of uploaded documents against the resolved requirements.
 *
 * `canSubmit` intentionally accepts documents that are merely uploaded, not yet
 * reviewed — otherwise submission would depend on an admin acting first, which
 * is backwards. `allRequiredAccepted` is the separate, stricter signal the
 * review side uses.
 *
 * A rejected document counts as missing: the organizer has to replace it, and
 * reporting it as satisfied would let a submission look complete while a
 * reviewer had explicitly refused it.
 */
export function evaluateSubmission(
  requirements: ResolvedRequirement[],
  documents: DocumentRecord[]
): SubmissionReadiness {
  const byType = new Map<string, DocumentRecord[]>();
  for (const doc of documents) {
    const list = byType.get(doc.document_type) ?? [];
    list.push(doc);
    byType.set(doc.document_type, list);
  }

  const evaluated: EvaluatedRequirement[] = requirements.map((req) => {
    const docs = byType.get(req.documentType) ?? [];
    if (docs.length === 0) return { ...req, status: "missing" as const };

    // Best outcome wins when several were uploaded for one requirement:
    // a fresh upload after a rejection should not leave it looking rejected.
    if (docs.some((d) => d.status === "accepted")) {
      return { ...req, status: "accepted" as const };
    }
    if (docs.some((d) => d.status === "pending")) {
      return { ...req, status: "uploaded" as const };
    }
    return { ...req, status: "rejected" as const };
  });

  const missingRequired = evaluated
    .filter(
      (req) =>
        req.isRequired && (req.status === "missing" || req.status === "rejected")
    )
    .map((req) => req.documentType);

  return {
    requirements: evaluated,
    missingRequired,
    canSubmit: missingRequired.length === 0,
    allRequiredAccepted: evaluated
      .filter((req) => req.isRequired)
      .every((req) => req.status === "accepted"),
  };
}

/**
 * Fetch the rules that could apply to a scope.
 *
 * Deliberately over-fetches — every rule for the organizer type — and resolves
 * in memory. The table is small configuration data, and expressing
 * most-specific-wins in SQL would push the precedence logic somewhere it cannot
 * be unit-tested.
 */
export async function fetchRequirements(
  supabase: SupabaseClient,
  scope: VerificationScope
): Promise<ResolvedRequirement[]> {
  const { data, error } = await supabase
    .from("verification_requirements")
    .select(
      "organizer_type, subcategory, country, document_type, is_required, label, description, sort_order"
    )
    .eq("organizer_type", scope.organizerType);

  if (error) {
    // Loudly: an empty requirement list reads as "nothing needed", which would
    // silently let an unverified organizer through.
    throw new Error(`Could not load verification requirements: ${error.message}`);
  }

  return resolveRequirements(scope, (data ?? []) as RequirementRow[]);
}

/**
 * Organizer type vocabulary for the onboarding UI.
 *
 * Lives here rather than in the component so the admin review queue and the
 * requirement seed share one source of truth for these strings. `value` is what
 * gets written to organizer_verification.organizer_type / .subcategory.
 *
 * Subcategories are UI vocabulary, not a constraint — the column is free text
 * on purpose (see migration_59), so adding one here needs no migration. Only
 * `orphanage` currently changes the required documents; the rest exist so an
 * admin can see what kind of body they are reviewing.
 */
export type OrganizerTypeOption = {
  value: OrganizerType;
  label: string;
  helper: string;
  subcategories: { value: string; label: string }[];
};

export const ORGANIZER_TYPE_OPTIONS: OrganizerTypeOption[] = [
  {
    value: "individual",
    label: "An individual",
    helper: "Raising money for yourself, someone you know, or a personal cause.",
    subcategories: [
      { value: "personal", label: "Personal cause" },
      { value: "medical", label: "Medical" },
      { value: "education", label: "Education" },
      { value: "funeral", label: "Funeral or burial" },
      { value: "housing", label: "Housing or basic needs" },
      { value: "emergency", label: "Emergency" },
      // A creator raising money personally is an individual. Audience size is
      // never treated as evidence; a creator raising ON BEHALF OF an
      // organisation instead uses the "fundraising on behalf of an
      // organization" toggle on this step, which routes them through that
      // organisation's own requirement set instead (see VerificationWizard).
      { value: "creator", label: "Creator or public figure (personal)" },
      { value: "other", label: "Something else" },
    ],
  },
  {
    value: "nonprofit",
    label: "A nonprofit, charity or NGO",
    helper: "A formally established organisation registered in its country.",
    subcategories: [
      { value: "ngo", label: "NGO" },
      { value: "charity", label: "Charity" },
      { value: "foundation", label: "Foundation" },
      { value: "orphanage", label: "Orphanage or children's home" },
      { value: "community_development", label: "Community development" },
      { value: "religious", label: "Religious nonprofit" },
      { value: "educational", label: "Educational nonprofit" },
      { value: "health", label: "Health or medical nonprofit" },
      { value: "humanitarian", label: "Humanitarian organisation" },
      { value: "other", label: "Other nonprofit" },
    ],
  },
  {
    value: "business",
    label: "A business or company",
    helper: "A registered company, small business or corporate campaign.",
    subcategories: [
      { value: "company", label: "Registered company" },
      { value: "small_business", label: "Small business" },
      { value: "startup", label: "Startup" },
      { value: "csr", label: "Corporate social responsibility" },
      { value: "other", label: "Other commercial organisation" },
    ],
  },
  {
    value: "community",
    label: "A community group",
    helper:
      "A group organised around a cause that may not be formally registered — that is fine.",
    subcategories: [
      { value: "community_group", label: "Community group" },
      { value: "student_group", label: "Student group" },
      { value: "neighborhood", label: "Neighbourhood association" },
      { value: "volunteer", label: "Volunteer group" },
      { value: "sports_club", label: "Sports or community club" },
      { value: "religious_group", label: "Religious community" },
      { value: "informal", label: "Informal charitable initiative" },
      { value: "other", label: "Other" },
    ],
  },
];

export function organizerTypeOption(value: string | null | undefined) {
  return ORGANIZER_TYPE_OPTIONS.find((option) => option.value === value) ?? null;
}
