import { createSupabaseAdmin } from "@/lib/supabase-admin";
import Link from "next/link";
import { OrgFundraisersTable } from "./OrgFundraisersTable";

export default async function OrgFundraisersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createSupabaseAdmin();

  const { data: fundraisers } = await supabase
    .from("fundraisers")
    .select("id, title, slug, goal, raised, status, created_at")
    .eq("organizer_id", id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-brand-700">Organization</p>
          <h1 className="mt-1 text-2xl font-black">Fundraisers</h1>
        </div>
        <Link
          href="/create-fundraiser"
          className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-brand-800"
        >
          New Fundraiser
        </Link>
      </div>

      {(fundraisers ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="font-black text-zinc-900">No fundraisers yet</p>
          <p className="mt-1 text-sm text-zinc-500">Launch your first fundraiser campaign.</p>
          <Link href="/create-fundraiser" className="mt-4 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-black text-white hover:bg-brand-800">
            Start Fundraiser
          </Link>
        </div>
      ) : (
        <OrgFundraisersTable fundraisers={(fundraisers ?? []) as any} />
      )}
    </div>
  );
}
