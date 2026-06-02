"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function CreateOrganizerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    bio: "",
    facebook: "",
    twitter: "",
    website: "",
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push("/login");
      } else {
        setChecking(false);
      }
    });
  }, [router]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setPhotoFile(file);
    if (file) setPhotoPreview(URL.createObjectURL(file));
  }

  function handleBanner(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setBannerFile(file);
    if (file) setBannerPreview(URL.createObjectURL(file));
  }

  async function uploadFile(file: File, bucket: string, prefix: string) {
    const ext = file.name.split(".").pop();
    const fileName = `${prefix}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(fileName, file);
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return data.publicUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data: { session } } = await supabase.auth.getSession();

    let photo = null;
    let banner = null;

    try {
      if (photoFile) photo = await uploadFile(photoFile, "organizer-images", "photo");
      if (bannerFile) banner = await uploadFile(bannerFile, "organizer-banners", "banner");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setLoading(false);
      return;
    }

    const { data: organizer, error: insertError } = await supabase
      .from("organizers")
      .insert({
        name: form.name,
        bio: form.bio,
        facebook: form.facebook,
        twitter: form.twitter,
        website: form.website,
        photo,
        banner,
        user_id: session?.user.id,
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push(`/organizers/${organizer.id}`);
  }

  if (checking) {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <p className="text-zinc-400 text-lg">Checking access...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50">
      <section className="max-w-4xl mx-auto px-6 py-20">

        <div className="mb-12">
          <p className="text-orange-500 font-semibold mb-3">Organizer Setup</p>
          <h1 className="text-5xl font-black">Create Organizer Profile</h1>
          <p className="text-zinc-600 text-lg mt-4">Set up your public organizer page.</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-5 py-4 rounded-2xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">

          {/* BANNER */}
          <div>
            <label className="block font-semibold mb-3">Banner Image</label>
            <div
              className="w-full h-48 rounded-2xl overflow-hidden bg-zinc-200 flex items-center justify-center cursor-pointer hover:opacity-90 transition relative"
              style={bannerPreview ? { backgroundImage: `url(${bannerPreview})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}
            >
              <input type="file" accept="image/*" onChange={handleBanner} className="hidden" id="banner-upload" />
              <label htmlFor="banner-upload" className="cursor-pointer absolute inset-0 flex items-center justify-center">
                {!bannerPreview && (
                  <div className="text-center">
                    <p className="text-4xl mb-2">🖼️</p>
                    <p className="font-semibold text-zinc-500">Click to upload banner</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* PHOTO */}
          <div>
            <label className="block font-semibold mb-3">Profile Photo</label>
            <div className="flex items-center gap-8">
              <div className="w-28 h-28 rounded-full bg-zinc-200 overflow-hidden flex items-center justify-center border-4 border-white shadow">
                {photoPreview ? (
                  <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl text-zinc-400">👤</span>
                )}
              </div>
              <div>
                <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" id="photo-upload" />
                <label htmlFor="photo-upload" className="cursor-pointer bg-zinc-100 hover:bg-zinc-200 px-5 py-3 rounded-xl font-semibold transition">
                  Upload Photo
                </label>
                <p className="text-zinc-400 text-sm mt-2">JPG, PNG recommended</p>
              </div>
            </div>
          </div>

          {/* NAME */}
          <div>
            <label className="block font-semibold mb-3">Organizer Name</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              type="text"
              placeholder="AfroWave Entertainment"
              className="w-full border border-zinc-300 rounded-2xl px-5 py-4 outline-none focus:border-orange-500"
            />
          </div>

          {/* BIO */}
          <div>
            <label className="block font-semibold mb-3">Bio</label>
            <textarea
              name="bio"
              value={form.bio}
              onChange={handleChange}
              rows={4}
              placeholder="Tell people about your organization..."
              className="w-full border border-zinc-300 rounded-2xl px-5 py-4 outline-none focus:border-orange-500"
            />
          </div>

          {/* SOCIAL */}
          <div className="space-y-4">
            <label className="block font-semibold">Social Links</label>
            <input name="facebook" value={form.facebook} onChange={handleChange} type="text" placeholder="Facebook URL" className="w-full border border-zinc-300 rounded-2xl px-5 py-4 outline-none focus:border-orange-500" />
            <input name="twitter" value={form.twitter} onChange={handleChange} type="text" placeholder="Twitter/X URL" className="w-full border border-zinc-300 rounded-2xl px-5 py-4 outline-none focus:border-orange-500" />
            <input name="website" value={form.website} onChange={handleChange} type="text" placeholder="Website URL" className="w-full border border-zinc-300 rounded-2xl px-5 py-4 outline-none focus:border-orange-500" />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white py-5 rounded-2xl font-bold text-lg transition"
          >
            {loading ? "Creating..." : "Create Organizer Profile"}
          </button>

        </form>
      </section>
    </main>
  );
}