-- migration_64_identity_verification.sql
--
-- Phase 1 of separating user identity from organizer/entity verification.
--
-- Today, "identity verified" lives only on organizer_verification.identity_verified_at
-- (UNIQUE on organizer_id) — so a person who owns 3 organizer profiles has to
-- submit and get approved for the same government ID 3 separate times.
-- Identity is a fact about a person, not about each organization they manage.
--
-- This adds a genuinely user-scoped identity_verification table (UNIQUE on
-- user_id), reusing the exact same status lifecycle, document-storage pattern,
-- and RLS shape organizer_verification already has — nothing here is a new
-- design, it's the same design keyed differently.
--
-- DELIBERATELY NOT TOUCHED (see Phase A audit, 2026-08-09):
--   verification_requirements — still asks for government_id/representative_id/
--     organiser_id per organizer type. Redundant now, but removing it is a
--     separate decision once this table is live and stable, not part of this
--     migration.
--   organizer_verification.identity_verified_at — keeps being stamped exactly
--     as today on organizer approval. Rewiring the donor-facing panel and the
--     admin queue's "Identity verified" field to read the new authoritative
--     fact instead is a separate, later task.
--
-- Rollback: db/migration_64_identity_verification_rollback.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- 64.1  identity_verification — one submission per PERSON, not per organizer
--
-- Deliberately flat: no organizer_type/subcategory/country. Identity has
-- exactly one required document (government_id) for every person, forever —
-- the type/subcategory/country branching in verification_requirements exists
-- to handle requirements that vary by organizer type, which does not apply
-- here. Reusing that resolution engine for a single, non-varying requirement
-- would be forcing a fit.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS identity_verification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- One live submission per person. Re-submission updates this row; history
  -- lives in verification_events via identity_verification_id below.
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'submitted', 'under_review', 'approved', 'rejected',
    'changes_requested', 'suspended'
  )),

  identity_verified_at timestamptz,

  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The admin queue's primary read: "what is waiting for me, oldest first" —
-- same shape as idx_organizer_verification_status.
CREATE INDEX IF NOT EXISTS idx_identity_verification_status
  ON identity_verification (status, submitted_at);

-- No explicit GRANT: confirmed live that organizer_verification and
-- verification_documents both still carry the project's default blanket
-- privilege set for anon/authenticated (never column-restricted), and
-- migration_59 created those tables the same way, with no explicit GRANT
-- either. A new table gets the same default automatically.


-- ---------------------------------------------------------------------------
-- 64.2  verification_documents — nullable-pair parent FK, not a parallel table
--
-- Reused rather than duplicated: the SELECT policies (owner via uploaded_by,
-- admin via role) and /api/verification/document-url (authorises purely by
-- storage path prefix, never touches this table's parent) are ALREADY
-- table-agnostic. Only the INSERT policy hardcodes organizer_verification —
-- that is the one thing that actually needs to change.
-- ---------------------------------------------------------------------------
ALTER TABLE verification_documents
  ALTER COLUMN verification_id DROP NOT NULL;

ALTER TABLE verification_documents
  ADD COLUMN IF NOT EXISTS identity_verification_id uuid
    REFERENCES identity_verification(id) ON DELETE CASCADE;

ALTER TABLE verification_documents
  ADD CONSTRAINT verification_documents_exactly_one_parent
  CHECK ((verification_id IS NOT NULL) <> (identity_verification_id IS NOT NULL));

DROP POLICY IF EXISTS "Owners attach own documents" ON verification_documents;
CREATE POLICY "Owners attach own documents" ON verification_documents
  FOR INSERT WITH CHECK (
    auth.uid() = uploaded_by
    -- An owner cannot mark their own document accepted, either kind.
    AND status = 'pending'
    AND (
      (verification_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM organizer_verification v
        WHERE v.id = verification_id
          AND v.user_id = auth.uid()
          AND v.status IN ('draft', 'changes_requested')
      ))
      OR
      (identity_verification_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM identity_verification iv
        WHERE iv.id = identity_verification_id
          AND iv.user_id = auth.uid()
          AND iv.status IN ('draft', 'changes_requested')
      ))
    )
  );


-- ---------------------------------------------------------------------------
-- 64.3  verification_events — same nullable-pair treatment
--
-- One shared append-only audit trail for either kind of submission, rather
-- than two audit-trail tables to keep in sync forever. Only the owner-read
-- SELECT policy needs the OR branch; there is still no INSERT/UPDATE/DELETE
-- policy for any non-admin role — events are written server-side only.
-- ---------------------------------------------------------------------------
ALTER TABLE verification_events
  ALTER COLUMN verification_id DROP NOT NULL;

ALTER TABLE verification_events
  ADD COLUMN IF NOT EXISTS identity_verification_id uuid
    REFERENCES identity_verification(id) ON DELETE CASCADE;

ALTER TABLE verification_events
  ADD CONSTRAINT verification_events_exactly_one_parent
  CHECK ((verification_id IS NOT NULL) <> (identity_verification_id IS NOT NULL));

DROP POLICY IF EXISTS "Owners read own verification history" ON verification_events;
CREATE POLICY "Owners read own verification history" ON verification_events
  FOR SELECT USING (
    (verification_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM organizer_verification v
      WHERE v.id = verification_id AND v.user_id = auth.uid()
    ))
    OR
    (identity_verification_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM identity_verification iv
      WHERE iv.id = identity_verification_id AND iv.user_id = auth.uid()
    ))
  );

-- migration_63 column-restricted this table's grant to exclude metadata.
-- The new FK column joins the same "safe to read" set — it's just an id,
-- same as verification_id already is.
GRANT SELECT (identity_verification_id) ON verification_events TO anon, authenticated;


-- ---------------------------------------------------------------------------
-- 64.4  RLS for identity_verification — same shape as organizer_verification,
-- minus the organizer-ownership join (identity isn't organizer-scoped).
-- ---------------------------------------------------------------------------
ALTER TABLE identity_verification ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read own identity verification" ON identity_verification
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins read all identity verifications" ON identity_verification
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin' AND profiles.status = 'active'
  ));

CREATE POLICY "Owners create own identity verification" ON identity_verification
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    -- Cannot self-submit or self-approve on creation.
    AND status = 'draft'
  );

/**
 * Same anti-escalation shape as organizer_verification's identical policy:
 * once submitted it belongs to the review process, so WITH CHECK confines
 * the reachable states to draft/submitted. Without that an owner could
 * simply write status='approved' directly.
 */
CREATE POLICY "Owners update own draft identity verification" ON identity_verification
  FOR UPDATE
  USING (
    auth.uid() = user_id
    AND status IN ('draft', 'changes_requested')
  )
  WITH CHECK (
    auth.uid() = user_id
    AND status IN ('draft', 'submitted')
  );

CREATE POLICY "Admins manage identity verifications" ON identity_verification
  FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin' AND profiles.status = 'active'
  ));

COMMIT;

NOTIFY pgrst, 'reload schema';
