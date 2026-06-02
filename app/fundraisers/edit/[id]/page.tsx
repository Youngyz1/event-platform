"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function generateSlug(title: string) {
  return title.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
}

export default function EditFundraiserPage() {
  const params = useParams();
  const router = useRouter();
  const fundraiserId = params?.id as string;
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [slug, setSlug] = useState("");
  const [form, setForm] = useState({
    title: "",
    organizer: "",
    goal: "",
    raised: "",
    banner: "",
    video_url: "",
    story: "",
  });

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const { data: fundraiser, error: fundraiserError } = await supabase
        .from("fundraisers")
        .select("*")
        .eq("id", fundraiserId)
        .eq("user_id", session.user.id)
        .single();

      if (fundraiserError || !fundraiser) {
        setError("Fundraiser not found or you do not have access.");
        setChecking(false);
        return;
      }

      setSlug(fundraiser.slug || "");
      setForm({
        title: fundraiser.title || "",
        organizer: fundraiser.organizer || "",
        goal: fundraiser.goal?.toString() || "",
        raised: fundraiser.raised?.toString() || "",
        banner: fundraiser.banner || "",
        video_url: fundraiser.video_url || "",
        story: fundraiser.story || "",
      });
      setChecking(false);
    }

    if (fundraiserId) load();
  }, [fundraiserId, router]);

  function update(field: string, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const nextSlug = generateSlug(form.title);
      const { error: updateError } = await supabase
        .from("fundraisers")
        .update({
          title: form.title,
          slug: nextSlug,
          organizer: form.organizer,
          goal: Number(form.goal),
          raised: Number(form.raised) || 0,
          banner: form.banner,
          video_url: form.video_url || null,
          story: form.story,
        })
        .eq("id", fundraiserId);

      if (updateError) throw new Error(updateError.message);
      router.push(`/fundraisers/${nextSlug}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not update fundraiser.");
    } finally {
      setSaving(false);
    }
  }

  if (checking) {
    return <main className="flex min-h-screen items-center justify-center bg-zinc-50"><p className="text-lg font-semibold text-zinc-500">Loading fundraiser...</p></main>;
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <section className="mx-auto max-w-4xl px-6 py-14">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-green-600">Fundraiser</p>
            <h1 className="mt-2 text-5xl font-black">Edit Fundraiser</h1>
            <p className="mt-3 text-zinc-600">Strengthen imported campaigns with better story, images, progress, and organizer details.</p>
          </div>
          {slug && <Link href={`/fundraisers/${slug}`} className="font-black text-green-600 hover:text-green-700">View fundraiser</Link>}
        </div>

        {error && <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-semibold text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-7 rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <input value={form.title} onChange={(event) => update("title", event.target.value)} required placeholder="Fundraiser title" className="w-full rounded-2xl border border-zinc-300 px-5 py-4 outline-none focus:border-green-500" />
          <input value={form.organizer} onChange={(event) => update("organizer", event.target.value)} placeholder="Organizer name" className="w-full rounded-2xl border border-zinc-300 px-5 py-4 outline-none focus:border-green-500" />
          <div className="grid gap-5 md:grid-cols-2">
            <input value={form.goal} onChange={(event) => update("goal", event.target.value)} required type="number" min="1" placeholder="Goal" className="rounded-2xl border border-zinc-300 px-5 py-4 outline-none focus:border-green-500" />
            <input value={form.raised} onChange={(event) => update("raised", event.target.value)} type="number" min="0" placeholder="Raised so far" className="rounded-2xl border border-zinc-300 px-5 py-4 outline-none focus:border-green-500" />
          </div>
          <input value={form.banner} onChange={(event) => update("banner", event.target.value)} placeholder="Banner image URL" className="w-full rounded-2xl border border-zinc-300 px-5 py-4 outline-none focus:border-green-500" />
          <input value={form.video_url} onChange={(event) => update("video_url", event.target.value)} placeholder="Campaign video URL" className="w-full rounded-2xl border border-zinc-300 px-5 py-4 outline-none focus:border-green-500" />
          <textarea value={form.story} onChange={(event) => update("story", event.target.value)} required rows={10} placeholder="Campaign story" className="w-full rounded-2xl border border-zinc-300 px-5 py-4 outline-none focus:border-green-500" />

          <button disabled={saving} className="w-full rounded-2xl bg-green-500 py-5 text-lg font-black text-white transition hover:bg-green-600 disabled:bg-green-300">
            {saving ? "Saving..." : "Save Fundraiser"}
          </button>
        </form>
      </section>
    </main>
  );
}
