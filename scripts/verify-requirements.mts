/**
 * Regression guard for the verification requirement seed.
 *
 *   npm run verify:requirements
 *
 * Pulls the LIVE `verification_requirements` rows and asserts the document sets
 * each organizer type resolves to. It deliberately checks the real data rather
 * than a fixture copy: the point is to catch a seed change that quietly alters
 * what organizers are asked for, which a fixture would happily agree with.
 *
 * There is no test runner in this repo, so this is a plain script run through
 * Node's TypeScript stripping. Add cases here when the seed changes.
 */

import { readFileSync } from "node:fs";
import {
  resolveRequirements,
  type RequirementRow,
} from "../lib/verification-requirements.ts";

function env(name: string): string {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const line = raw.split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  if (!line) throw new Error(`${name} missing from .env.local`);
  return line.slice(name.length + 1).replace(/^"|"$/g, "").trim();
}

const url = env("NEXT_PUBLIC_SUPABASE_URL");
const key = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");

const res = await fetch(
  `${url}/rest/v1/verification_requirements?select=organizer_type,subcategory,country,document_type,is_required,label,description,sort_order`,
  { headers: { apikey: key, Authorization: `Bearer ${key}` } }
);
if (!res.ok) throw new Error(`Could not read requirements: ${res.status}`);
const rows = (await res.json()) as RequirementRow[];

let pass = 0;
let fail = 0;
function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}`, detail ?? "");
  }
}

/** Sorted document lists, split by whether they are required. */
function split(scope: Parameters<typeof resolveRequirements>[0]) {
  const resolved = resolveRequirements(scope, rows);
  return {
    required: resolved.filter((r) => r.isRequired).map((r) => r.documentType).sort(),
    optional: resolved.filter((r) => !r.isRequired).map((r) => r.documentType).sort(),
  };
}

const eq = (a: string[], b: string[]) => a.join("|") === b.join("|");

console.log(`Loaded ${rows.length} requirement rows\n`);

const individual = split({ organizerType: "individual" });
check("individual required", eq(individual.required, ["government_id"]), individual);
check(
  "individual optional",
  eq(individual.optional, ["beneficiary_consent", "supporting_evidence"]),
  individual
);

// migration_60 made proof_of_authority optional for the nonprofit BASE tier.
const nonprofit = split({ organizerType: "nonprofit" });
check(
  "nonprofit required = registration_certificate + representative_id",
  eq(nonprofit.required, ["registration_certificate", "representative_id"]),
  nonprofit
);
check(
  "nonprofit proof_of_authority is OPTIONAL",
  eq(nonprofit.optional, ["proof_of_authority"]),
  nonprofit
);

/**
 * The subtle one. Resolution unions across tiers and picks the winning rule PER
 * DOCUMENT, so the orphanage override must ADD a required document without
 * disturbing the base tier's optional/required split. A count-only assertion
 * would pass even if proof_of_authority silently became required again.
 */
const orphanage = split({ organizerType: "nonprofit", subcategory: "orphanage" });
check(
  "orphanage required = base two + facility_authorisation",
  eq(orphanage.required, [
    "facility_authorisation",
    "registration_certificate",
    "representative_id",
  ]),
  orphanage
);
check(
  "orphanage keeps proof_of_authority OPTIONAL",
  eq(orphanage.optional, ["proof_of_authority"]),
  orphanage
);

// The regression migration_60 could most easily have caused: business has its
// own separate proof_of_authority row and must be unaffected.
const business = split({ organizerType: "business" });
check(
  "business required (proof_of_authority still required)",
  eq(business.required, [
    "business_registration",
    "proof_of_authority",
    "representative_id",
  ]),
  business
);
check("business has no optional documents", business.optional.length === 0, business);

const community = split({ organizerType: "community" });
check(
  "community required",
  eq(community.required, ["group_evidence", "organiser_id"]),
  community
);
check(
  "community optional",
  eq(community.optional, ["beneficiary_evidence"]),
  community
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
