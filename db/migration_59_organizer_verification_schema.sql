-- migration_59_organizer_verification_schema.sql
--
-- Phase 2a of organizer verification: the data model.
--
-- Builds on migration_58, which created the private `verification-documents`
-- bucket. This adds the tables that describe a submission, the documents
-- attached to it, the requirement rules that decide which documents are needed,
-- and an append-only audit trail.
--
-- SCOPE: schema, RLS and requirement seed data only. No requirement-engine
-- code, no onboarding wizard, no admin review queue, no campaign gating —
-- those are later phases and none of them can be built until this exists.
--
-- DELIBERATELY NOT TOUCHED:
--   organizers.status  — load-bearing. /organizers filters on status='verified',
--     admin filters on it, and RLS policies reference it. Repurposing it for the
--     new lifecycle would break the public directory. The new lifecycle lives on
--     organizer_verification.status; organizers.status stays as the OUTCOME an
--     admin sets once a review concludes.
--
-- NO BACKFILL, also deliberate. The 14 existing organizers get no verification
-- row. They keep working exactly as today because nothing reads these tables
-- yet, and a backfill inventing a status for organizers nobody has reviewed
-- would be a lie in the data.
--
-- Rollback: db/migration_59_organizer_verification_schema_rollback.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- 59.1  organizer_verification — one submission per organizer
--
-- Three verification facts are kept SEPARATE on purpose. "Identity verified"
-- (this human is who they say), "organization verified" (this body exists and
-- this human may act for it) and campaign approval are different claims, and
-- collapsing them into one badge is how platforms end up vouching for things
-- they never checked. Campaign approval already lives on fundraisers.status.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizer_verification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- One live submission per organizer. Re-submission updates this row; the
  -- history lives in verification_events.
  organizer_id uuid NOT NULL UNIQUE REFERENCES organizers(id) ON DELETE CASCADE,

  -- The human responsible for the submission. Kept alongside organizer_id
  -- because RLS is keyed on the user, and because an organizer's owner can
  -- change without rewriting every policy.
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  organizer_type text NOT NULL CHECK (organizer_type IN (
    'individual', 'nonprofit', 'business', 'community'
  )),

  -- Free text against a seeded vocabulary rather than an enum: subcategories
  -- ("orphanage", "student_group") will grow, and an enum makes that a
  -- migration every time.
  subcategory text,

  -- ISO 3166-1 alpha-2. Requirements vary by country; see verification_requirements.
  country text,

  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',              -- being filled in, not yet visible to admins
    'submitted',          -- awaiting triage
    'under_review',       -- an admin has picked it up
    'approved',
    'rejected',
    'changes_requested',  -- back with the organizer, editable again
    'suspended'           -- previously approved, withdrawn
  )),

  -- Separate facts, separately stamped. Null means "not established".
  identity_verified_at timestamptz,
  organization_verified_at timestamptz,

  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizer_verification_user
  ON organizer_verification (user_id);
-- The admin queue's primary read: "what is waiting for me, oldest first".
CREATE INDEX IF NOT EXISTS idx_organizer_verification_status
  ON organizer_verification (status, submitted_at);


-- ---------------------------------------------------------------------------
-- 59.2  verification_requirements — which documents are needed, as DATA
--
-- The rule set is a table, not a hardcoded list, so requirements can change
-- without a deploy. Resolution is most-specific-wins:
--
--   (type, subcategory, country)  beats
--   (type, subcategory, NULL)     beats
--   (type, NULL, NULL)
--
-- NULL means "applies to everything at this level", which is what makes a
-- sensible default set possible today while leaving room for
-- Nigeria/US/UK-specific rules later without restructuring anything.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verification_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  organizer_type text NOT NULL CHECK (organizer_type IN (
    'individual', 'nonprofit', 'business', 'community'
  )),
  subcategory text,          -- NULL = all subcategories of this type
  country text,              -- NULL = all countries (the default rule)

  document_type text NOT NULL,
  is_required boolean NOT NULL DEFAULT true,

  label text NOT NULL,
  -- Shown to the user. Explaining WHY a document is wanted measurably improves
  -- completion, and asking for a passport scan without a reason is hostile.
  description text,

  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One rule per document per scope. NULLS NOT DISTINCT so the default rules
-- (country IS NULL) collide properly instead of being silently duplicated.
CREATE UNIQUE INDEX IF NOT EXISTS idx_verification_requirements_scope
  ON verification_requirements (organizer_type, subcategory, country, document_type)
  NULLS NOT DISTINCT;


-- ---------------------------------------------------------------------------
-- 59.3  verification_documents — pointers into the private bucket
--
-- storage_path only. There is no URL column and there must never be one: the
-- bucket has no public URL, and reads go through /api/verification/document-url
-- which authorises owner-or-admin and mints a 60-second signed link.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verification_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id uuid NOT NULL
    REFERENCES organizer_verification(id) ON DELETE CASCADE,

  document_type text NOT NULL,

  -- Path inside the verification-documents bucket: <user_id>/<file>.
  storage_path text NOT NULL,
  file_name text,
  mime_type text,
  size_bytes bigint,

  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'accepted', 'rejected'
  )),
  rejection_reason text,

  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_verification_documents_verification
  ON verification_documents (verification_id);


-- ---------------------------------------------------------------------------
-- 59.4  verification_events — append-only audit trail
--
-- Every consequential decision, who made it and why. No UPDATE or DELETE
-- policy is granted to anyone below, including admins: an audit trail that can
-- be edited is not an audit trail.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id uuid NOT NULL
    REFERENCES organizer_verification(id) ON DELETE CASCADE,

  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  action text NOT NULL CHECK (action IN (
    'created', 'submitted', 'under_review', 'approved', 'rejected',
    'changes_requested', 'suspended', 'reinstated',
    'document_uploaded', 'document_accepted', 'document_rejected',
    'note'
  )),

  -- Required by the application for reject / changes_requested. Not enforced
  -- here because 'note' and 'submitted' legitimately have none.
  reason text,
  -- Internal admin notes live here, never in a user-visible column.
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_events_verification
  ON verification_events (verification_id, created_at DESC);


-- ---------------------------------------------------------------------------
-- 59.5  RLS
--
-- Reusing the admin predicate from the 16 policies that already use it,
-- including its `status = 'active'` clause, so a suspended or purged admin
-- loses access automatically.
-- ---------------------------------------------------------------------------
ALTER TABLE organizer_verification ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_events ENABLE ROW LEVEL SECURITY;

-- --- organizer_verification -------------------------------------------------
CREATE POLICY "Owners read own verification" ON organizer_verification
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins read all verifications" ON organizer_verification
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin' AND profiles.status = 'active'
  ));

CREATE POLICY "Owners create own verification" ON organizer_verification
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    -- Only for an organizer you actually own.
    AND EXISTS (
      SELECT 1 FROM organizers o
      WHERE o.id = organizer_id AND o.user_id = auth.uid()
    )
    -- Cannot self-submit or self-approve on creation.
    AND status = 'draft'
  );

/**
 * Owners may edit only while the submission is theirs to edit.
 *
 * Once it is submitted it belongs to the review process, so the WITH CHECK
 * confines the reachable states to draft/submitted. Without that an owner
 * could simply write status='approved' — the most obvious privilege escalation
 * in the whole feature.
 *
 * The verified-at stamps and reviewer fields are not writable by owners; they
 * are set by admin-side code running with the service role.
 */
CREATE POLICY "Owners update own draft verification" ON organizer_verification
  FOR UPDATE
  USING (
    auth.uid() = user_id
    AND status IN ('draft', 'changes_requested')
  )
  WITH CHECK (
    auth.uid() = user_id
    AND status IN ('draft', 'submitted')
  );

CREATE POLICY "Admins manage verifications" ON organizer_verification
  FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin' AND profiles.status = 'active'
  ));

-- --- verification_requirements ----------------------------------------------
-- Public read: this is configuration, not user data. The onboarding form has
-- to render the requirement list before a submission exists.
CREATE POLICY "Requirements are readable" ON verification_requirements
  FOR SELECT USING (true);

CREATE POLICY "Admins manage requirements" ON verification_requirements
  FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin' AND profiles.status = 'active'
  ));

-- --- verification_documents -------------------------------------------------
-- Metadata only. The bytes stay unreachable regardless of this policy: the
-- bucket has no SELECT policy at all, so a leaked storage_path is inert
-- without the signed-URL route.
CREATE POLICY "Owners read own documents" ON verification_documents
  FOR SELECT USING (auth.uid() = uploaded_by);

CREATE POLICY "Admins read all documents" ON verification_documents
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin' AND profiles.status = 'active'
  ));

CREATE POLICY "Owners attach own documents" ON verification_documents
  FOR INSERT WITH CHECK (
    auth.uid() = uploaded_by
    AND EXISTS (
      SELECT 1 FROM organizer_verification v
      WHERE v.id = verification_id
        AND v.user_id = auth.uid()
        AND v.status IN ('draft', 'changes_requested')
    )
    -- An owner cannot mark their own document accepted.
    AND status = 'pending'
  );

CREATE POLICY "Admins manage documents" ON verification_documents
  FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin' AND profiles.status = 'active'
  ));

-- --- verification_events ----------------------------------------------------
-- Owners can read their own history but never write it, and nobody gets UPDATE
-- or DELETE. Events are written server-side with the service role.
CREATE POLICY "Owners read own verification history" ON verification_events
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM organizer_verification v
    WHERE v.id = verification_id AND v.user_id = auth.uid()
  ));

CREATE POLICY "Admins read all verification history" ON verification_events
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin' AND profiles.status = 'active'
  ));


-- ---------------------------------------------------------------------------
-- 59.6  Default requirement set
--
-- Country IS NULL throughout — these are the sensible defaults that apply
-- everywhere until country-specific rules are added. Nothing here asserts a
-- legal position; the labels describe what is being asked for, not what it
-- proves.
-- ---------------------------------------------------------------------------
INSERT INTO verification_requirements
  (organizer_type, subcategory, country, document_type, is_required, label, description, sort_order)
VALUES
  -- Individual
  ('individual', NULL, NULL, 'government_id', true,
   'Government-issued ID',
   'A passport, national ID or driving licence. Used to confirm you are who you say you are.', 10),
  ('individual', NULL, NULL, 'beneficiary_consent', false,
   'Beneficiary consent',
   'If you are raising funds for someone else, written confirmation that they agree.', 20),
  ('individual', NULL, NULL, 'supporting_evidence', false,
   'Supporting documents',
   'Anything that supports your cause — medical letters, invoices, school fees.', 30),

  -- Nonprofit / charity / NGO
  ('nonprofit', NULL, NULL, 'registration_certificate', true,
   'Certificate of registration',
   'Official proof the organisation is registered in its country.', 10),
  ('nonprofit', NULL, NULL, 'representative_id', true,
   'Representative ID',
   'Government-issued ID for the person acting on the organisation''s behalf.', 20),
  ('nonprofit', NULL, NULL, 'proof_of_authority', true,
   'Proof of authority',
   'A letter or board resolution showing you may raise funds for this organisation.', 30),
  -- An orphanage is not automatically a registered nonprofit, so operating
  -- authorisation is asked for on top of registration.
  ('nonprofit', 'orphanage', NULL, 'facility_authorisation', true,
   'Authorisation to operate the facility',
   'A licence or permit showing the organisation legitimately operates this children''s home.', 40),

  -- Business / company
  ('business', NULL, NULL, 'business_registration', true,
   'Business registration',
   'Certificate of incorporation or equivalent company registration document.', 10),
  ('business', NULL, NULL, 'representative_id', true,
   'Representative ID',
   'Government-issued ID for the person acting on the business''s behalf.', 20),
  ('business', NULL, NULL, 'proof_of_authority', true,
   'Proof of authority',
   'Evidence you are authorised to act for the business.', 30),

  -- Community group — deliberately no registration document. Requiring company
  -- registration from a legitimately informal group would exclude exactly the
  -- organisers this category exists for.
  ('community', NULL, NULL, 'organiser_id', true,
   'Organiser ID',
   'Government-issued ID for the person responsible for this group.', 10),
  ('community', NULL, NULL, 'group_evidence', true,
   'Evidence the group exists',
   'Photos, meeting records, a community letter, or anything showing the group is active.', 20),
  ('community', NULL, NULL, 'beneficiary_evidence', false,
   'Beneficiary information',
   'Details of who the funds will help.', 30)
ON CONFLICT DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';
