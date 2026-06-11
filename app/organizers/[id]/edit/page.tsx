"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type OrganizerForm = {
  name: string;
  bio: string;
  photo: string;
  banner: string;
  facebook: string;
  twitter: string;
  website: string;
  visibility: "public" | "private";
};

export default function EditOrganizerPage() {
  const params = useParams();
  const router = useRouter();
  const organizerId = params?.id as string;
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [form, setForm] = useState<OrganizerForm>({
    name: "",
    bio: "",
    photo: "",
    banner: "",
    facebook: "",
    twitter: "",
    website: "",
    visibility: "public",
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

      const { data: profile } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", session.user.id)
        .maybeSingle();
      if (profile?.status === "suspended") {
        router.push("/login?suspended=1");
        return;
      }

      const { data: organizer, error: organizerError } = await supabase
        .from("organizers")
        .select("*")
        .eq("id", organizerId)
        .eq("user_id", session.user.id)
        .single();

      if (organizerError || !organizer) {
        setError("Organizer not found or you do not have access.");
        setChecking(false);
        return;
      }

      setForm({
        name: organizer.name || "",
        bio: organizer.bio || "",
        photo: organizer.photo || "",
        banner: organizer.banner || "",
        facebook: organizer.facebook || "",
        twitter: organizer.twitter || "",
        website: organizer.website || "",
        visibility: organizer.visibility || "public",
      });
      setChecking(false);
    }

    if (organizerId) load();
  }, [organizerId, router]);

  function update(field: keyof OrganizerForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function uploadFile(file: File, bucket: string, prefix: string) {
    const ext = file.name.split(".").pop();
    const fileName = `${prefix}-${organizerId}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, file);
    if (uploadError) throw new Error(uploadError.message);
    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return data.publicUrl;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      let photo = form.photo;
      let banner = form.banner;

      if (photoFile) photo = await uploadFile(photoFile, "organizer-images", "photo");
      if (bannerFile) banner = await uploadFile(bannerFile, "organizer-banners", "banner");

      const { error: updateError } = await supabase
        .from("organizers")
        .update({
          name: form.name,
          bio: form.bio,
          photo,
          banner,
          facebook: form.facebook,
          twitter: form.twitter,
          website: form.website,
          visibility: form.visibility,
        })
        .eq("id", organizerId);

      if (updateError) throw new Error(updateError.message);
      router.push(`/organizers/${organizerId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not update organizer.");
    } finally {
      setSaving(false);
    }
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50">
        <p className="text-lg font-semibold text-zinc-500">Loading organizer...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <section className="mx-auto max-w-4xl px-6 py-14">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-orange-600">Organizer</p>
            <h1 className="mt-2 text-5xl font-black">Edit Organizer</h1>
            <p className="mt-3 text-zinc-600">Update the public organizer profile people see on your events and fundraisers.</p>
          </div>
          <Link href={`/organizers/${organizerId}`} className="font-black text-orange-600 hover:text-orange-700">
            View profile
          </Link>
        </div>

        {error && <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-semibold text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-7 rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <label className="block">
            <span className="mb-2 block font-bold">Company / Organization</span>
            <input value={form.name} onChange={(event) => update("name", event.target.value)} required className="w-full rounded-2xl border border-zinc-300 px-5 py-4 outline-none focus:border-orange-500" />
          </label>

          <label className="block">
            <span className="mb-2 block font-bold">Organizer Bio / About</span>
            <textarea value={form.bio} onChange={(event) => update("bio", event.target.value)} rows={6} className="w-full rounded-2xl border border-zinc-300 px-5 py-4 outline-none focus:border-orange-500" />
          </label>

          <fieldset className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
            <legend className="text-base font-black text-zinc-950">Profile Visibility</legend>
            <p className="mt-1 text-sm font-semibold text-zinc-500">
              Choose whether people can discover and view this organizer profile.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                ["public", "Public", "People can browse and follow this organizer."],
                ["private", "Private", "Only you can view and edit this organizer profile."],
              ].map(([value, label, detail]) => (
                <label key={value} className="flex cursor-pointer gap-3 rounded-xl border border-zinc-200 bg-white p-4">
                  <input
                    type="radio"
                    name="visibility"
                    checked={form.visibility === value}
                    onChange={() => update("visibility", value as OrganizerForm["visibility"])}
                    className="mt-1 accent-orange-600"
                  />
                  <span>
                    <span className="block text-sm font-black text-zinc-950">{label}</span>
                    <span className="mt-1 block text-xs font-semibold leading-5 text-zinc-500">{detail}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block font-bold">Profile Photo</span>
              <input type="file" accept="image/*" onChange={(event) => setPhotoFile(event.target.files?.[0] || null)} className="w-full rounded-2xl border border-zinc-300 px-5 py-4" />
              {form.photo && <input value={form.photo} onChange={(event) => update("photo", event.target.value)} placeholder="Photo URL" className="mt-3 w-full rounded-2xl border border-zinc-300 px-5 py-4 outline-none focus:border-orange-500" />}
            </label>
            <label className="block">
              <span className="mb-2 block font-bold">Banner Image</span>
              <input type="file" accept="image/*" onChange={(event) => setBannerFile(event.target.files?.[0] || null)} className="w-full rounded-2xl border border-zinc-300 px-5 py-4" />
              {form.banner && <input value={form.banner} onChange={(event) => update("banner", event.target.value)} placeholder="Banner URL" className="mt-3 w-full rounded-2xl border border-zinc-300 px-5 py-4 outline-none focus:border-orange-500" />}
            </label>
          </div>

          <div>
            <h2 className="mb-3 text-base font-black text-zinc-950">Social Media Links</h2>
            <div className="grid gap-5 md:grid-cols-3">
              <input value={form.website} onChange={(event) => update("website", event.target.value)} placeholder="Website URL" className="rounded-2xl border border-zinc-300 px-5 py-4 outline-none focus:border-orange-500" />
              <input value={form.facebook} onChange={(event) => update("facebook", event.target.value)} placeholder="Facebook URL" className="rounded-2xl border border-zinc-300 px-5 py-4 outline-none focus:border-orange-500" />
              <input value={form.twitter} onChange={(event) => update("twitter", event.target.value)} placeholder="Twitter/X URL" className="rounded-2xl border border-zinc-300 px-5 py-4 outline-none focus:border-orange-500" />
            </div>
          </div>

          <button disabled={saving} className="w-full rounded-2xl bg-orange-500 py-5 text-lg font-black text-white transition hover:bg-orange-600 disabled:bg-orange-300">
            {saving ? "Saving..." : "Save Organizer"}
          </button>
        </form>
      </section>
    </main>
  );
}
