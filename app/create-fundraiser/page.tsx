"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  CreatorField,
  CreatorPanel,
  CreatorWorkspace,
  greenInputClass,
} from "@/components/CreatorWorkspace";
import { supabase } from "@/lib/supabase";

const FUNDRAISER_STEPS = [
  { label: "Fundraiser Details" },
  { label: "Goal & Story" },
  { label: "Settings" },
  { label: "Review & Publish" },
];

const campaignCategories = ["Charity", "Medical", "Education", "Church", "Community Projects"];

type GalleryItem = {
  image_url: string;
  caption: string;
};

type OrganizerProfile = {
  id: string;
  name: string;
  photo?: string | null;
};

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

function money(value: string | number) {
  return `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function CreateFundraiserPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [organizers, setOrganizers] = useState<OrganizerProfile[]>([]);

  const [form, setForm] = useState({
    title: "",
    short_description: "",
    story: "",
    goal: "",
    raised: "",
    organizer_id: "",
    organizer: "",
    banner: "",
    category: "Charity",
    tags: "",
  });
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([
    { image_url: "", caption: "" },
    { image_url: "", caption: "" },
    { image_url: "", caption: "" },
  ]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.push("/login");
        return;
      }
      setEmail(data.session.user.email || "");
      const { data: profile } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", data.session.user.id)
        .maybeSingle();
      if (profile?.status === "suspended") {
        router.push("/login?suspended=1");
        return;
      }
      const { data: organizerProfiles, error: organizerError } = await supabase
        .from("organizers")
        .select("id, name, photo")
        .eq("user_id", data.session.user.id)
        .order("created_at", { ascending: true });

      if (organizerError) {
        setError(organizerError.message);
      }

      const profiles = organizerProfiles ?? [];
      const requestedOrganizerId = new URLSearchParams(window.location.search).get("organizer");
      const selectedOrganizer =
        profiles.find((organizer) => organizer.id === requestedOrganizerId) ??
        profiles[0];
      setOrganizers(profiles);
      setForm((current) => ({
        ...current,
        organizer_id: current.organizer_id || selectedOrganizer?.id || "",
        organizer: current.organizer || selectedOrganizer?.name || "",
      }));
      setChecking(false);
    });
  }, [router]);

  const progress = useMemo(() => {
    const goal = Number(form.goal || 0);
    const raised = Number(form.raised || 0);
    return goal ? Math.min(Math.round((raised / goal) * 100), 100) : 0;
  }, [form.goal, form.raised]);

  function handleChange(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setNotice("");
    if (event.target.name === "organizer_id") {
      const selectedOrganizer = organizers.find((organizer) => organizer.id === event.target.value);
      setForm({
        ...form,
        organizer_id: event.target.value,
        organizer: selectedOrganizer?.name || "",
      });
      return;
    }
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  function updateGalleryItem(index: number, field: keyof GalleryItem, value: string) {
    setNotice("");
    setGalleryItems((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    );
  }

  function addGalleryItem() {
    setGalleryItems((items) => [...items, { image_url: "", caption: "" }]);
  }

  function removeGalleryItem(index: number) {
    setGalleryItems((items) =>
      items.length > 1 ? items.filter((_, itemIndex) => itemIndex !== index) : items
    );
  }

  function cleanGalleryItems() {
    return galleryItems.filter((item) => item.image_url.trim().startsWith("http"));
  }

  function saveDraft() {
    localStorage.setItem("fundraiser-draft", JSON.stringify({ form, visibility, galleryItems }));
    setNotice("Draft saved on this device.");
  }

  function nextStep() {
    setCurrentStep((step) => Math.min(step + 1, FUNDRAISER_STEPS.length - 1));
  }

  function previousStep() {
    setCurrentStep((step) => Math.max(step - 1, 0));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");

    const slug = generateSlug(form.title);
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

    if (!form.organizer_id) {
      setError("Choose an organizer profile before launching this fundraiser.");
      setLoading(false);
      return;
    }

    const selectedOrganizer = organizers.find((organizer) => organizer.id === form.organizer_id);
    if (!selectedOrganizer) {
      setError("Choose an organizer profile that belongs to your account.");
      setLoading(false);
      return;
    }

    let video_url = null;
    if (videoFile) {
      setUploadProgress("Uploading video...");
      const ext = videoFile.name.split(".").pop();
      const fileName = `${slug}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage.from("videos").upload(fileName, videoFile);

      if (uploadError) {
        setError("Video upload failed: " + uploadError.message);
        setLoading(false);
        return;
      }

      const { data: urlData } = supabase.storage.from("videos").getPublicUrl(fileName);
      video_url = urlData.publicUrl;
      setUploadProgress("");
    }

    const story = [form.short_description, form.story].filter(Boolean).join("\n\n");
    const { data: insertedFundraiser, error: insertError } = await supabase
      .from("fundraisers")
      .insert({
        title: form.title,
        slug,
        story,
        goal: Number(form.goal),
        raised: Number(form.raised) || 0,
        organizer: form.organizer,
        organizer_id: form.organizer_id,
        banner: form.banner,
        video_url,
        user_id: session.user.id,
      })
      .select("id, slug")
      .single();

    if (insertError || !insertedFundraiser) {
      setError(insertError?.message || "Could not create fundraiser.");
      setLoading(false);
      return;
    }

    const mediaItems = [
      ...(form.banner.trim().startsWith("http")
        ? [{ image_url: form.banner.trim(), caption: form.title }]
        : []),
      ...cleanGalleryItems(),
    ].filter(
      (item, index, items) =>
        items.findIndex((candidate) => candidate.image_url === item.image_url) === index
    );

    if (mediaItems.length > 0) {
      const { error: mediaError } = await supabase.from("fundraiser_media").insert(
        mediaItems.map((item, index) => ({
          fundraiser_id: insertedFundraiser.id,
          image_url: item.image_url.trim(),
          caption: item.caption.trim() || form.title,
          sort_order: index,
        }))
      );

      if (mediaError) {
        console.error("Fundraiser media insert failed:", mediaError.message);
      }
    }

    localStorage.removeItem("fundraiser-draft");
    router.push(`/fundraisers/${slug}`);
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-100">
        <p className="text-lg font-semibold text-zinc-400">Checking access...</p>
      </main>
    );
  }

  const tips = [
    "Choose a compelling campaign title.",
    "Set a realistic goal.",
    "Tell your story with clear impact.",
    "Add a powerful cover image.",
  ];

  const aside = (
    <>
      <CreatorPanel title="Fundraiser Tips">
        <div className="space-y-4">
          {tips.map((tip) => (
            <p key={tip} className="flex gap-3 text-sm font-semibold text-zinc-600">
              <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
              {tip}
            </p>
          ))}
        </div>
      </CreatorPanel>

      <CreatorPanel title="Preview">
        <div className="overflow-hidden rounded-xl bg-zinc-100">
          {form.banner ? (
            <div className="h-32 bg-cover bg-center" style={{ backgroundImage: `url(${form.banner})` }} />
          ) : (
            <div className="flex h-32 items-center justify-center text-zinc-400">
              <i className="ti ti-photo text-4xl" aria-hidden="true" />
            </div>
          )}
        </div>
        <h3 className="mt-4 text-xl font-black">{form.title || "Fundraiser Title"}</h3>
        <p className="mt-1 text-sm font-medium text-zinc-500">by {form.organizer || "Organizer Name"}</p>
        <div className="mt-4">
          <p className="text-sm font-black">{money(form.raised)} raised of {money(form.goal)} goal</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs font-bold text-zinc-500">{progress}% funded</p>
        </div>
      </CreatorPanel>

      <CreatorPanel title="Visibility">
        <fieldset className="space-y-4">
          {[
            ["public", "Public", "Anyone can discover and view"],
            ["private", "Private", "Only people with a link can view"],
          ].map(([value, label, detail]) => (
            <label key={value} className="flex cursor-pointer gap-3">
              <input
                checked={visibility === value}
                className="mt-1 accent-emerald-600"
                name="visibility"
                onChange={() => setVisibility(value)}
                type="radio"
              />
              <span>
                <span className="block text-sm font-black">{label}</span>
                <span className="text-xs font-medium text-zinc-500">{detail}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </CreatorPanel>
    </>
  );

  const footer = (
    <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row sm:items-center">
      <Link href="/dashboard" className="rounded-xl border border-zinc-200 px-4 py-2.5 text-center text-sm font-black text-zinc-700 hover:bg-zinc-50">
        Cancel
      </Link>
      <div className="flex gap-3">
        {currentStep > 0 && (
          <button onClick={previousStep} type="button" className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-black text-zinc-700 hover:bg-zinc-50">
            Back
          </button>
        )}
        {currentStep < FUNDRAISER_STEPS.length - 1 ? (
          <button onClick={nextStep} type="button" className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-700">
            Next: {FUNDRAISER_STEPS[currentStep + 1].label}
          </button>
        ) : (
          <button disabled={loading} form="create-fundraiser-form" type="submit" className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-700 disabled:bg-emerald-300">
            {loading ? uploadProgress || "Launching..." : "Launch Fundraiser"}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <CreatorWorkspace
      active="Fundraisers"
      accent="green"
      title="Create Fundraiser"
      description="Set up your fundraiser and start making an impact."
      email={email}
      steps={FUNDRAISER_STEPS}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      onSaveDraft={saveDraft}
      aside={aside}
      footer={footer}
    >
      <form id="create-fundraiser-form" onSubmit={handleSubmit} className="space-y-5">
        {(error || notice) && (
          <div className={`rounded-2xl border px-5 py-4 text-sm font-bold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            {error || notice}
          </div>
        )}

        {currentStep === 0 && (
          <>
            <CreatorPanel title="Basic Information">
              <div className="grid gap-5">
                <CreatorField label="Fundraiser Title">
                  <input name="title" value={form.title} onChange={handleChange} required type="text" placeholder="Support Education for Underprivileged Children" className={greenInputClass} />
                </CreatorField>

                <CreatorField label="Organizer Profile">
                  <select name="organizer_id" value={form.organizer_id} onChange={handleChange} required disabled={organizers.length === 0} className={greenInputClass}>
                    {organizers.length === 0
                      ? <option value="">No organizer profiles yet</option>
                      : organizers.map((organizer) => <option key={organizer.id} value={organizer.id}>{organizer.name}</option>)}
                  </select>
                  {organizers.length === 0 && (
                    <Link href="/create-organizer" className="mt-2 inline-block text-sm font-black text-emerald-700 hover:text-emerald-800">
                      Create an organizer profile
                    </Link>
                  )}
                </CreatorField>

                <CreatorField label="Short Description" hint={`${form.short_description.length}/160`}>
                  <textarea name="short_description" value={form.short_description} onChange={handleChange} maxLength={160} rows={4} placeholder="A short summary of your fundraiser..." className={greenInputClass} />
                </CreatorField>
              </div>
            </CreatorPanel>

            <CreatorPanel title="Fundraiser Image">
              <div className="grid gap-5">
                <CreatorField label="Cover Image URL" hint="Use a wide image, ideally 1200 x 630.">
                  <input name="banner" value={form.banner} onChange={handleChange} type="url" placeholder="https://..." className={greenInputClass} />
                </CreatorField>
                <div>
                  <div className="mb-3">
                    <p className="text-sm font-black text-zinc-950">Additional Banner Photos</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-zinc-500">
                      Add more carousel photos for the fundraiser banner. Each photo can have its own caption.
                    </p>
                  </div>
                  <div className="space-y-4">
                    {galleryItems.map((item, index) => (
                      <div key={index} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                          <CreatorField label={`Photo ${index + 1} URL`}>
                            <input
                              value={item.image_url}
                              onChange={(event) => updateGalleryItem(index, "image_url", event.target.value)}
                              type="url"
                              placeholder="https://..."
                              className={greenInputClass}
                            />
                          </CreatorField>
                          <CreatorField label="Caption">
                            <input
                              value={item.caption}
                              onChange={(event) => updateGalleryItem(index, "caption", event.target.value)}
                              type="text"
                              placeholder="Caption for this photo"
                              className={greenInputClass}
                            />
                          </CreatorField>
                          <button
                            type="button"
                            onClick={() => removeGalleryItem(index)}
                            className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-black text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
                            disabled={galleryItems.length === 1}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addGalleryItem}
                    className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-black text-emerald-700 hover:bg-emerald-100"
                  >
                    Add another photo
                  </button>
                </div>
                <CreatorField label="Campaign Video" hint="Optional. MP4, MOV, or AVI uploads are supported by your storage bucket.">
                  <input type="file" accept="video/*" onChange={(event) => setVideoFile(event.target.files?.[0] || null)} className="w-full rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-5 text-sm font-semibold" />
                </CreatorField>
              </div>
            </CreatorPanel>
          </>
        )}

        {currentStep === 1 && (
          <CreatorPanel title="Goal & Story">
            <div className="grid gap-5">
              <div className="grid gap-5 md:grid-cols-2">
                <CreatorField label="Fundraising Goal">
                  <input name="goal" value={form.goal} onChange={handleChange} required type="number" min="1" placeholder="20000" className={greenInputClass} />
                </CreatorField>
                <CreatorField label="Funds Raised So Far">
                  <input name="raised" value={form.raised} onChange={handleChange} type="number" min="0" placeholder="0" className={greenInputClass} />
                </CreatorField>
              </div>
              <CreatorField label="Campaign Story">
                <textarea name="story" value={form.story} onChange={handleChange} required rows={10} placeholder="Tell people why this cause matters, who it helps, and how funds will be used..." className={greenInputClass} />
              </CreatorField>
            </div>
          </CreatorPanel>
        )}

        {currentStep === 2 && (
          <CreatorPanel title="Settings">
            <div className="grid gap-5">
              <CreatorField label="Campaign Category">
                <select name="category" value={form.category} onChange={handleChange} className={greenInputClass}>
                  {campaignCategories.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </CreatorField>
              <CreatorField label="Tags" hint="Use commas to separate tags for internal organization.">
                <input name="tags" value={form.tags} onChange={handleChange} type="text" placeholder="school, community, scholarship" className={greenInputClass} />
              </CreatorField>
              <div className="rounded-2xl bg-emerald-50 p-5 text-sm font-semibold leading-6 text-emerald-800 ring-1 ring-emerald-100">
                Campaign categories and tags are staged for the future marketplace filters. The current publish flow keeps database writes limited to the existing fundraiser fields.
              </div>
            </div>
          </CreatorPanel>
        )}

        {currentStep === 3 && (
          <CreatorPanel title="Review & Publish">
            <div className="grid gap-4">
              {[
                ["Fundraiser", form.title || "Not set"],
                ["Organizer", form.organizer || "Not set"],
                ["Category", form.category],
                ["Goal", money(form.goal)],
                ["Raised", money(form.raised)],
                ["Gallery Photos", String(cleanGalleryItems().length)],
                ["Visibility", visibility],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col justify-between gap-1 rounded-xl bg-zinc-50 px-4 py-3 ring-1 ring-zinc-200 sm:flex-row">
                  <p className="text-sm font-black text-zinc-500">{label}</p>
                  <p className="text-sm font-bold text-zinc-950">{value}</p>
                </div>
              ))}
            </div>
          </CreatorPanel>
        )}
      </form>
    </CreatorWorkspace>
  );
}
