"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

export default function CreateFundraiserPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState("");

  const [form, setForm] = useState({
    title: "",
    story: "",
    goal: "",
    raised: "",
    organizer: "",
    banner: "",
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

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const slug = generateSlug(form.title);
    const { data: { session } } = await supabase.auth.getSession();

    // Upload video if selected
    let video_url = null;
    if (videoFile) {
      setUploadProgress("Uploading video...");
      const ext = videoFile.name.split(".").pop();
      const fileName = `${slug}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("videos")
        .upload(fileName, videoFile);

      if (uploadError) {
        setError("Video upload failed: " + uploadError.message);
        setLoading(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("videos")
        .getPublicUrl(fileName);

      video_url = urlData.publicUrl;
      setUploadProgress("");
    }

    const { error: insertError } = await supabase
      .from("fundraisers")
      .insert({
        title: form.title,
        slug,
        story: form.story,
        goal: Number(form.goal),
        raised: Number(form.raised) || 0,
        organizer: form.organizer,
        banner: form.banner,
        video_url,
        user_id: session?.user.id,
      });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push(`/fundraisers/${slug}`);
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
          <p className="text-green-600 font-semibold mb-3">Campaign Dashboard</p>
          <h1 className="text-5xl font-black">Start a Fundraiser</h1>
          <p className="text-zinc-600 text-lg mt-4">
            Launch your campaign and start collecting donations.
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-5 py-4 rounded-2xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">

          <div>
            <label className="block font-semibold mb-3">Campaign Title</label>
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              required
              type="text"
              placeholder="Help Build Community Schools"
              className="w-full border border-zinc-300 rounded-2xl px-5 py-4 outline-none focus:border-green-500"
            />
          </div>

          <div>
            <label className="block font-semibold mb-3">Organizer Name</label>
            <input
              name="organizer"
              value={form.organizer}
              onChange={handleChange}
              type="text"
              placeholder="Community Future Initiative"
              className="w-full border border-zinc-300 rounded-2xl px-5 py-4 outline-none focus:border-green-500"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <label className="block font-semibold mb-3">Fundraising Goal ($)</label>
              <input
                name="goal"
                value={form.goal}
                onChange={handleChange}
                required
                type="number"
                placeholder="20000"
                className="w-full border border-zinc-300 rounded-2xl px-5 py-4 outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="block font-semibold mb-3">Funds Raised So Far ($)</label>
              <input
                name="raised"
                value={form.raised}
                onChange={handleChange}
                type="number"
                placeholder="0"
                className="w-full border border-zinc-300 rounded-2xl px-5 py-4 outline-none focus:border-green-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-3">Banner Image URL</label>
            <input
              name="banner"
              value={form.banner}
              onChange={handleChange}
              type="text"
              placeholder="https://..."
              className="w-full border border-zinc-300 rounded-2xl px-5 py-4 outline-none focus:border-green-500"
            />
          </div>

          <div>
            <label className="block font-semibold mb-3">
              Campaign Video <span className="text-zinc-400 font-normal">(optional)</span>
            </label>
            <div className="border-2 border-dashed border-zinc-300 rounded-2xl p-8 text-center hover:border-green-500 transition">
              <input
                type="file"
                accept="video/*"
                onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                className="hidden"
                id="video-upload"
              />
              <label htmlFor="video-upload" className="cursor-pointer">
                {videoFile ? (
                  <div>
                    <p className="text-green-600 font-semibold">✓ {videoFile.name}</p>
                    <p className="text-zinc-400 text-sm mt-1">Click to change</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-4xl mb-3">🎥</p>
                    <p className="font-semibold text-zinc-700">Click to upload a video</p>
                    <p className="text-zinc-400 text-sm mt-1">MP4, MOV, AVI up to 50MB</p>
                  </div>
                )}
              </label>
            </div>
            {uploadProgress && (
              <p className="text-green-600 font-semibold mt-3">{uploadProgress}</p>
            )}
          </div>

          <div>
            <label className="block font-semibold mb-3">Your Story</label>
            <textarea
              name="story"
              value={form.story}
              onChange={handleChange}
              required
              rows={8}
              placeholder="Tell people why this cause matters..."
              className="w-full border border-zinc-300 rounded-2xl px-5 py-4 outline-none focus:border-green-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white py-5 rounded-2xl font-bold text-lg transition"
          >
            {loading ? (uploadProgress || "Launching...") : "Launch Campaign"}
          </button>

        </form>
      </section>
    </main>
  );
}