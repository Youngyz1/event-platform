"use client";

/**
 * app/create-organizer/page.tsx
 * Create OR edit organizer profile.
 * On load: checks if the user already has an organizer profile.
 *   - If YES: pre-populates the form, submit does an UPDATE.
 *   - If NO:  blank form, submit does an INSERT.
 * Button text switches between "Create Organizer Profile" and "Update Profile".
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
};

export default function CreateOrganizerPage() {
  const router = useRouter();

  const [checking,      setChecking]      = useState(true);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState("");
  const [existingId,    setExistingId]    = useState<string | null>(null); // null = new profile
  const [photoFile,     setPhotoFile]     = useState<File | null>(null);
  const [photoPreview,  setPhotoPreview]  = useState<string | null>(null);
  const [bannerFile,    setBannerFile]    = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [existingPhoto,  setExistingPhoto]  = useState<string | null>(null);
  const [existingBanner, setExistingBanner] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    name:     "",
    bio:      "",
    facebook: "",
    twitter:  "",
    website:  "",
  });

  // On mount: get session, then check for existing organizer profile
  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const { data: org } = await supabase
        .from("organizers")
        .select("id, name, bio, facebook, twitter, website, photo, banner")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (org) {
        setExistingId(org.id);
        setForm({
          name:     org.name     ?? "",
          bio:      org.bio      ?? "",
          facebook: org.facebook ?? "",
          twitter:  org.twitter  ?? "",
          website:  org.website  ?? "",
        });
        setExistingPhoto(org.photo   ?? null);
        setExistingBanner(org.banner ?? null);
        // Show existing images as previews
        if (org.photo)  setPhotoPreview(org.photo);
        if (org.banner) setBannerPreview(org.banner);
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

    // Upload new images only if the user chose new files
    let photo:  string | null = existingPhoto;
    let banner: string | null = existingBanner;

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
      photo,
      banner,
      user_id:  session.user.id,
    };

    if (existingId) {
      // UPDATE existing profile
      const { error: updateErr } = await supabase
        .from("organizers")
        .update(payload)
        .eq("id", existingId);

      if (updateErr) {
        setError(updateErr.message);
        setLoading(false);
        return;
      }
      router.push(`/organizers/${existingId}`);
    } else {
      // INSERT new profile
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
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
      </main>
    );
  }

  const isEditing = Boolean(existingId);

  return (
    <main className="min-h-screen bg-zinc-50">
      <section className="mx-auto max-w-4xl px-6 py-20">

        {/* Header */}
        <div className="mb-12">
          <p className="mb-3 font-semibold text-orange-500">
            {isEditing ? "Edit Profile" : "Organizer Setup"}
          </p>
          <h1 className="text-5xl font-black">
            {isEditing ? "Update Organizer Profile" : "Create Organizer Profile"}
          </h1>
          <p className="mt-4 text-lg text-zinc-600">
            {isEditing
              ? "Update your public organizer page."
              : "Set up your public organizer page."}
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
                  {isEditing ? "Change Photo" : "Upload Photo"}
                </label>
                <p className="mt-2 text-sm text-zinc-400">JPG, PNG recommended</p>
              </div>
            </div>
          </div>

          {/* NAME */}
          <div>
            <label className="mb-3 block font-semibold">Organizer Name</label>
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
            <label className="mb-3 block font-semibold">Bio</label>
            <textarea
              name="bio"
              value={form.bio}
              onChange={handleChange}
              rows={4}
              placeholder="Tell people about your organization..."
              className="w-full rounded-2xl border border-zinc-300 px-5 py-4 outline-none focus:border-orange-500"
            />
          </div>

          {/* SOCIAL */}
          <div className="space-y-4">
            <label className="block font-semibold">Social Links</label>
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
                ? isEditing ? "Updating…" : "Creating…"
                : isEditing ? "Update Profile" : "Create Organizer Profile"}
            </button>

            {isEditing && (
              <a
                href={`/organizers/${existingId}`}
                className="flex items-center justify-center rounded-2xl border border-zinc-200 bg-white px-8 text-sm font-black text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </a>
            )}
          </div>

        </form>
      </section>
    </main>
  );
}