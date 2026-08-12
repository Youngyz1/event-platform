import { supabaseAdmin } from "@/lib/dashboard-context";

const BLOCKING_DONATION_STATUSES = new Set(["pending", "succeeded", "completed", "refunded"]);

type BlockingCheck = {
  blocked: boolean;
  message?: string;
};

function moneyValue(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

export async function checkEventDeleteBlocked(eventIds: string[]): Promise<BlockingCheck> {
  return { blocked: false };
}

export async function checkFundraiserDeleteBlocked(fundraiserIds: string[]): Promise<BlockingCheck> {
  if (fundraiserIds.length === 0) return { blocked: false };

  const { data: donations, error } = await supabaseAdmin
    .from("donations")
    .select("id, status, payment_intent_id")
    .in("fundraiser_id", fundraiserIds);

  if (error) {
    throw new Error(error.message);
  }

  const blockingDonations = (donations ?? []).filter(
    (donation) =>
      BLOCKING_DONATION_STATUSES.has(donation.status || "") ||
      Boolean(donation.payment_intent_id)
  );

  if (blockingDonations.length > 0) {
    return {
      blocked: true,
      message:
        "This fundraiser has donation payment records. Archive or hide it instead of deleting payment history.",
    };
  }

  return { blocked: false };
}

export async function deleteEventsWithoutPaymentRecords(eventIds: string[]) {
  const blocked = await checkEventDeleteBlocked(eventIds);
  if (blocked.blocked) return blocked;

  const { error: ticketError } = await supabaseAdmin
    .from("tickets")
    .delete()
    .in("event_id", eventIds);

  if (ticketError) {
    throw new Error(ticketError.message);
  }

  const { error } = await supabaseAdmin.from("events").delete().in("id", eventIds);
  if (error) {
    throw new Error(error.message);
  }

  return { blocked: false };
}

export async function deleteFundraisersWithoutPaymentRecords(fundraiserIds: string[]) {
  const blocked = await checkFundraiserDeleteBlocked(fundraiserIds);
  if (blocked.blocked) return blocked;

  const { error } = await supabaseAdmin.from("fundraisers").delete().in("id", fundraiserIds);
  if (error) {
    throw new Error(error.message);
  }

  return { blocked: false };
}
