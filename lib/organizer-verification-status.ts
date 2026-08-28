export type OrganizerVerificationStatus =
  | "not_started"
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "changes_requested"
  | "suspended";

export type OrganizerVerificationSummary = {
  status: OrganizerVerificationStatus;
  label: string;
  description: string;
  actionLabel: string | null;
  canOpenWizard: boolean;
  tone: "neutral" | "pending" | "success" | "warning" | "danger";
};

const SUMMARIES: Record<OrganizerVerificationStatus, OrganizerVerificationSummary> = {
  not_started: {
    status: "not_started",
    label: "Organizer not verified",
    description: "Start organizer verification to submit identity and authority documents for review.",
    actionLabel: "Verify Organizer",
    canOpenWizard: true,
    tone: "neutral",
  },
  draft: {
    status: "draft",
    label: "Verification draft",
    description: "Your organizer verification has been started but has not been submitted.",
    actionLabel: "Continue Verification",
    canOpenWizard: true,
    tone: "neutral",
  },
  submitted: {
    status: "submitted",
    label: "Verification pending",
    description: "Your organizer verification has been submitted and is waiting for review.",
    actionLabel: null,
    canOpenWizard: false,
    tone: "pending",
  },
  under_review: {
    status: "under_review",
    label: "Verification under review",
    description: "The review team is checking your organizer verification documents.",
    actionLabel: null,
    canOpenWizard: false,
    tone: "pending",
  },
  approved: {
    status: "approved",
    label: "Verified Organizer",
    description: "This organizer has completed organizer verification.",
    actionLabel: null,
    canOpenWizard: false,
    tone: "success",
  },
  rejected: {
    status: "rejected",
    label: "Verification rejected",
    description: "Your organizer verification was rejected and cannot be changed from the organizer dashboard.",
    actionLabel: null,
    canOpenWizard: false,
    tone: "danger",
  },
  changes_requested: {
    status: "changes_requested",
    label: "Additional information needed",
    description: "The review team needs updated organizer verification information or documents.",
    actionLabel: "Update Verification",
    canOpenWizard: true,
    tone: "warning",
  },
  suspended: {
    status: "suspended",
    label: "Verification suspended",
    description: "This organizer's verification is suspended.",
    actionLabel: null,
    canOpenWizard: false,
    tone: "danger",
  },
};

export function normalizeOrganizerVerificationStatus(
  status: string | null | undefined
): OrganizerVerificationStatus {
  if (
    status === "draft" ||
    status === "submitted" ||
    status === "under_review" ||
    status === "approved" ||
    status === "rejected" ||
    status === "changes_requested" ||
    status === "suspended"
  ) {
    return status;
  }
  return "not_started";
}

export function getOrganizerVerificationSummary(
  status: string | null | undefined
): OrganizerVerificationSummary {
  return SUMMARIES[normalizeOrganizerVerificationStatus(status)];
}
