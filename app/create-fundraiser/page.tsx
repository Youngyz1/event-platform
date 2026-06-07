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

  const [form, setForm] = useState({
    title: "",
    short_description: "",
    story: "",
    goal: "",
    raised: "",
    organizer: "",
    banner: "",
    category: "Charity",
    tags: "",
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push("/login");
        return;
      }
      setEmail(data.session.user.email || "");
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
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  function saveDraft() {
    localStorage.setItem("fundraiser-draft", JSON.stringify({ form, visibility }));
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
    const { error: insertError } = await supabase
      .from("fundraisers")
      .insert({
        title: form.title,
        slug,
        story,
        goal: Number(form.goal),
        raised: Number(form.raised) || 0,
        organizer: form.organizer,
        banner: form.banner,
        video_url,
        user_id: session.user.id,
      });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
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

                <CreatorField label="Organized By">
                  <input name="organizer" value={form.organizer} onChange={handleChange} type="text" placeholder="Community Future Initiative" className={greenInputClass} />
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
