"use client";

/**
 * app/create-organizer/page.tsx
 * Creates a new organizer profile owned by the current user.
 * Existing organizer profiles are edited from /organizers/[id]/edit.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type FormState = {
  name:     string;
  bio:      string;
  facebook: string;
  twitter:  string;
  website:  string;
  visibility: "public" | "private";
};

export default function CreateOrganizerPage() {
  const router = useRouter();

  const [checking,      setChecking]      = useState(true);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState("");
  const [photoFile,     setPhotoFile]     = useState<File | null>(null);
  const [photoPreview,  setPhotoPreview]  = useState<string | null>(null);
  const [bannerFile,    setBannerFile]    = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    name:     "",
    bio:      "",
    facebook: "",
    twitter:  "",
    website:  "",
    visibility: "public",
  });

  // On mount: require an authenticated user.
  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
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
      setChecking(false);
    }
    load();
  }, [router]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function setVisibility(visibility: FormState["visibility"]) {
    setForm((prev) => ({ ...prev, visibility }));
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPhotoFile(file);
    if (file) setPhotoPreview(URL.createObjectURL(file));
  }

  function handleBanner(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setBannerFile(file);
    if (file) setBannerPreview(URL.createObjectURL(file));
  }

  async function uploadFile(file: File, bucket: string, prefix: string) {
    const ext      = file.name.split(".").pop();
    const fileName = `${prefix}-${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from(bucket)
      .upload(fileName, file);
    if (uploadErr) throw new Error(uploadErr.message);
    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return data.publicUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push("/login"); return; }
    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", session.user.id)
      .maybeSingle();
    if (profile?.status === "suspended") {
      router.push("/login?suspended=1");
      return;
    }

    let photo:  string | null = null;
    let banner: string | null = null;

    try {
      if (photoFile)  photo  = await uploadFile(photoFile,  "organizer-images",  "photo");
      if (bannerFile) banner = await uploadFile(bannerFile, "organizer-banners", "banner");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setLoading(false);
      return;
    }

    const payload = {
      name:     form.name,
      bio:      form.bio,
      facebook: form.facebook,
      twitter:  form.twitter,
      website:  form.website,
      visibility: form.visibility,
      photo,
      banner,
      user_id:  session.user.id,
    };

    const { data: newOrg, error: insertErr } = await supabase
      .from("organizers")
      .insert(payload)
      .select()
      .single();

    if (insertErr) {
      setError(insertErr.message);
      setLoading(false);
      return;
    }
    router.push(`/organizers/${newOrg.id}`);
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50">
      <section className="mx-auto max-w-4xl px-6 py-20">

        {/* Header */}
        <div className="mb-12">
          <p className="mb-3 font-semibold text-orange-500">
            Organizer Setup
          </p>
          <h1 className="text-5xl font-black">
            Create Organizer Profile
          </h1>
          <p className="mt-4 text-lg text-zinc-600">
            Set up the public organizer profile people will see on your events and fundraisers.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">

          {/* BANNER */}
          <div>
            <label className="mb-3 block font-semibold">Banner Image</label>
            <div
              className="relative flex h-48 w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-zinc-200 hover:opacity-90 transition"
              style={
                bannerPreview
                  ? { backgroundImage: `url(${bannerPreview})`, backgroundSize: "cover", backgroundPosition: "center" }
                  : {}
              }
            >
              <input
                type="file"
                accept="image/*"
                onChange={handleBanner}
                className="hidden"
                id="banner-upload"
              />
              <label
                htmlFor="banner-upload"
                className="absolute inset-0 flex cursor-pointer items-center justify-center"
              >
                {!bannerPreview && (
                  <div className="text-center">
                    <p className="mb-2 text-4xl">🖼️</p>
                    <p className="font-semibold text-zinc-500">Click to upload banner</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* PHOTO */}
          <div>
            <label className="mb-3 block font-semibold">Profile Photo</label>
            <div className="flex items-center gap-8">
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-zinc-200 shadow">
                {photoPreview ? (
                  <img src={photoPreview} alt="preview" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-4xl text-zinc-400">👤</span>
                )}
              </div>
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhoto}
                  className="hidden"
                  id="photo-upload"
                />
                <label
                htmlFor="photo-upload"
                className="cursor-pointer rounded-xl bg-zinc-100 px-5 py-3 font-semibold transition hover:bg-zinc-200"
              >
                  Upload Photo
                </label>
                <p className="mt-2 text-sm text-zinc-400">JPG, PNG recommended</p>
              </div>
            </div>
          </div>

          {/* NAME */}
          <div>
            <label className="mb-3 block font-semibold">Company / Organization</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              type="text"
              placeholder="AfroWave Entertainment"
              className="w-full rounded-2xl border border-zinc-300 px-5 py-4 outline-none focus:border-orange-500"
            />
          </div>

          {/* BIO */}
          <div>
            <label className="mb-3 block font-semibold">Organizer Bio</label>
            <textarea
              name="bio"
              value={form.bio}
              onChange={handleChange}
              rows={4}
              placeholder="Tell people about your organization..."
              className="w-full rounded-2xl border border-zinc-300 px-5 py-4 outline-none focus:border-orange-500"
            />
          </div>

          {/* VISIBILITY */}
          <fieldset className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <legend className="text-lg font-black text-zinc-950">Profile Visibility</legend>
            <p className="mt-1 text-sm font-semibold text-zinc-500">
              Choose whether this organizer profile should be public or private.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                ["public", "Public", "People can browse this organizer and follow updates."],
                ["private", "Private", "Only you can view and edit this organizer profile."],
              ].map(([value, label, detail]) => (
                <label key={value} className="flex cursor-pointer gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <input
                    type="radio"
                    name="visibility"
                    checked={form.visibility === value}
                    onChange={() => setVisibility(value as FormState["visibility"])}
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

          {/* SOCIAL */}
          <div className="space-y-4">
            <label className="block font-semibold">Website & Social Media Links</label>
            <input
              name="facebook"
              value={form.facebook}
              onChange={handleChange}
              type="text"
              placeholder="Facebook URL"
              className="w-full rounded-2xl border border-zinc-300 px-5 py-4 outline-none focus:border-orange-500"
            />
            <input
              name="twitter"
              value={form.twitter}
              onChange={handleChange}
              type="text"
              placeholder="Twitter/X URL"
              className="w-full rounded-2xl border border-zinc-300 px-5 py-4 outline-none focus:border-orange-500"
            />
            <input
              name="website"
              value={form.website}
              onChange={handleChange}
              type="text"
              placeholder="Website URL"
              className="w-full rounded-2xl border border-zinc-300 px-5 py-4 outline-none focus:border-orange-500"
            />
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-2xl bg-orange-500 py-5 text-lg font-bold text-white transition hover:bg-orange-600 disabled:bg-orange-300"
            >
              {loading
                ? "Creating…"
                : "Create Organizer Profile"}
            </button>
          </div>

        </form>
      </section>
    </main>
  );
}
