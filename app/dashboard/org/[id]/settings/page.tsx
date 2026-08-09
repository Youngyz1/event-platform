"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ImageUploadWithCrop from "@/components/ui/ImageUploadWithCrop";
import { MIN_BANNER_WIDTH, MIN_BANNER_HEIGHT } from "@/lib/image-dimensions";
import {
  Globe, Mail, AlertTriangle, Check, ArrowRight, ShieldCheck, Loader2
} from "lucide-react";
import Image from "next/image";

type OrgForm = {
  name: string;
  slug: string;
  bio: string;
  photo: string;
  banner: string;
  org_type: string;
  contact_email: string;
  website: string;
  facebook: string;
  twitter: string;
  instagram: string;
  linkedin: string;
  youtube: string;
  tiktok: string;
  visibility: "public" | "private";
};

const ORG_TYPES = [
  { value: "nonprofit", label: "Nonprofit" },
  { value: "business", label: "Business" },
  { value: "church", label: "Church" },
  { value: "school", label: "School" },
  { value: "creator", label: "Creator" },
  { value: "community", label: "Community" },
  { value: "government", label: "Government" },
  { value: "restaurant", label: "Restaurant" },
  { value: "sports_club", label: "Sports Club" },
  { value: "other", label: "Other" },
];

export default function OrgSettingsPage() {
  const params = useParams();
  const router = useRouter();
  // The URL param is always the immutable UUID
  const orgId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Track original slug for uniqueness check only
  const [originalSlug, setOriginalSlug] = useState("");

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);

  const [form, setForm] = useState<OrgForm>({
    name: "",
    slug: "",
    bio: "",
    photo: "",
    banner: "",
    org_type: "other",
    contact_email: "",
    website: "",
    facebook: "",
    twitter: "",
    instagram: "",
    linkedin: "",
    youtube: "",
    tiktok: "",
    visibility: "public",
  });

  // Load organization details by UUID
  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      // Explicit column list, not `*` — migration_53 revoked SELECT on
      // tax_id/nonprofit_registration_number for anon/authenticated (they're
      // registration identifiers, read only via the service-role client), and
      // Postgres fails `SELECT *` outright if the caller lacks privilege on
      // any column, ownership notwithstanding. None of these are used by this
      // form anyway.
      const { data: org, error: orgError } = await supabase
        .from("organizers")
        .select(
          "id, name, slug, bio, photo, banner, org_type, contact_email, website, facebook, twitter, instagram, linkedin, youtube, tiktok, visibility"
        )
        .eq("id", orgId)
        .eq("user_id", session.user.id)
        .single();

      if (orgError || !org) {
        setError("Organization not found or you do not have permission to edit it.");
        setLoading(false);
        return;
      }

      setOriginalSlug(org.slug || "");
      setForm({
        name: org.name || "",
        slug: org.slug || "",
        bio: org.bio || "",
        photo: org.photo || "",
        banner: org.banner || "",
        org_type: org.org_type || "other",
        contact_email: org.contact_email || "",
        website: org.website || "",
        facebook: org.facebook || "",
        twitter: org.twitter || "",
        instagram: org.instagram || "",
        linkedin: org.linkedin || "",
        youtube: org.youtube || "",
        tiktok: org.tiktok || "",
        visibility: (org.visibility as "public" | "private") || "public",
      });
      setLoading(false);
    }
    if (orgId) load();
  }, [orgId, router]);

  function update(field: keyof OrgForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;

    setSaving(true);
    setError("");
    setSuccess(false);

    // Validate Slug format (lowercase, numbers, dashes only)
    const slugFormat = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugFormat.test(form.slug)) {
      setError("Slug must contain only lowercase letters, numbers, and single hyphens (e.g. 'my-org-name').");
      setSaving(false);
      return;
    }

    try {
      // Check slug uniqueness if changed
      if (form.slug !== originalSlug) {
        const { data: existing } = await supabase
          .from("organizers")
          .select("id")
          .eq("slug", form.slug)
          .maybeSingle();

        if (existing) {
          setError("This URL slug is already taken by another organization.");
          setSaving(false);
          return;
        }
      }

      const photo = photoUrl ?? form.photo;
      const banner = bannerUrl ?? form.banner;

      const { error: updateError } = await supabase
        .from("organizers")
        .update({
          name: form.name,
          slug: form.slug,
          bio: form.bio,
          photo,
          banner,
          org_type: form.org_type,
          contact_email: form.contact_email,
          website: form.website,
          facebook: form.facebook,
          twitter: form.twitter,
          instagram: form.instagram,
          linkedin: form.linkedin,
          youtube: form.youtube,
          tiktok: form.tiktok,
          visibility: form.visibility,
        })
        .eq("id", orgId);

      if (updateError) throw new Error(updateError.message);

      // Update tracked slug
      setOriginalSlug(form.slug);
      setSuccess(true);
      // Dashboard URL never changes — always /dashboard/org/[id]/settings
      setForm((prev) => ({ ...prev, photo, banner }));
      setPhotoUrl(null);
      setBannerUrl(null);
    } catch (err: any) {
      setError(err?.message || "Could not update settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-brand-700">Organization Workspace</p>
          <h1 className="mt-1 text-2xl font-black">Settings</h1>
          <p className="text-sm font-medium text-zinc-500">Manage profile information, logo, banner, type, and links.</p>
        </div>
        <a
          href={form.slug ? `/org/${form.slug}` : "#"}
          target="_blank"
          className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-bold text-zinc-700 hover:bg-zinc-50"
        >
          View Public Profile ↗
        </a>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm font-bold text-brand-800">
          Settings updated successfully!
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* 1. Identity & General */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
          <h2 className="text-lg font-black text-zinc-950">General Info</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-zinc-600">Organization Name *</span>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm outline-none focus:border-brand-600 focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-zinc-600">Organization Type *</span>
              <select
                required
                value={form.org_type}
                onChange={(e) => update("org_type", e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm outline-none focus:border-brand-600 focus:bg-white"
              >
                {ORG_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-zinc-600">Public URL Slug *</span>
            <div className="flex rounded-xl border border-zinc-200 bg-zinc-50 focus-within:border-brand-600 focus-within:bg-white overflow-hidden">
              <span className="flex items-center bg-zinc-100 px-3 text-xs font-bold text-zinc-500 border-r border-zinc-200">
                /org/
              </span>
              <input
                type="text"
                required
                value={form.slug}
                onChange={(e) => update("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                className="w-full bg-transparent px-4 py-2.5 text-sm outline-none"
              />
            </div>
            {form.slug !== originalSlug && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-yellow-700 bg-yellow-50 border border-yellow-100 rounded-lg p-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Changing your slug updates the public link immediately. Old /org/ links will redirect automatically.
                Your dashboard URL stays the same.
              </p>
            )}
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-zinc-600">About / Description</span>
            <textarea
              value={form.bio}
              onChange={(e) => update("bio", e.target.value)}
              rows={4}
              placeholder="Empowering communities, organizing fundraisers..."
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm outline-none focus:border-brand-600 focus:bg-white"
            />
          </label>
        </section>

        {/* 2. Contact & Links */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
          <h2 className="text-lg font-black text-zinc-950">Contact & Links</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-zinc-600">Contact Email *</span>
              <input
                type="email"
                required
                value={form.contact_email}
                onChange={(e) => update("contact_email", e.target.value)}
                placeholder="info@myorganization.org"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm outline-none focus:border-brand-600 focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-zinc-600">Website URL</span>
              <input
                type="text"
                value={form.website}
                onChange={(e) => update("website", e.target.value)}
                placeholder="www.myorganization.org"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm outline-none focus:border-brand-600 focus:bg-white"
              />
            </label>
          </div>
        </section>

        {/* 3. Media (Logo & Banner) */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6 space-y-5">
          <h2 className="text-lg font-black text-zinc-950">Media</h2>
          <div className="grid gap-6 md:grid-cols-2">

            {/* Logo upload */}
            <div className="space-y-3">
              <span className="block text-xs font-bold text-zinc-600">Organization Logo (Square)</span>
              <div className="flex items-center gap-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
                  {photoUrl || form.photo ? (
                    <Image
                      src={photoUrl || form.photo}
                      alt="Logo Preview"
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center font-black text-zinc-400">
                      LOGO
                    </span>
                  )}
                </div>
                <ImageUploadWithCrop
                  bucket="organizer-images"
                  folder="photo"
                  aspectRatio={1}
                  shape="round"
                  onUploaded={setPhotoUrl}
                  onError={setError}
                  renderTrigger={({ open, uploading }) => (
                    <button
                      type="button"
                      onClick={open}
                      disabled={uploading}
                      className="cursor-pointer rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                    >
                      {uploading ? "Uploading..." : "Choose Photo"}
                    </button>
                  )}
                />
              </div>
            </div>

            {/* Banner upload */}
            <div className="space-y-3">
              <span className="block text-xs font-bold text-zinc-600">Banner Image (Min 1200x300px)</span>
              <div className="flex items-center gap-4">
                <div className="relative h-20 w-36 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
                  {bannerUrl || form.banner ? (
                    <Image
                      src={bannerUrl || form.banner}
                      alt="Banner Preview"
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs font-black text-zinc-400">
                      BANNER
                    </span>
                  )}
                </div>
                <ImageUploadWithCrop
                  bucket="organizer-banners"
                  folder="banner"
                  aspectRatio={MIN_BANNER_WIDTH / MIN_BANNER_HEIGHT}
                  minWidth={MIN_BANNER_WIDTH}
                  minHeight={MIN_BANNER_HEIGHT}
                  onUploaded={setBannerUrl}
                  onError={setError}
                  renderTrigger={({ open, uploading }) => (
                    <button
                      type="button"
                      onClick={open}
                      disabled={uploading}
                      className="cursor-pointer rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                    >
                      {uploading ? "Uploading..." : "Choose Banner"}
                    </button>
                  )}
                />
              </div>
            </div>

          </div>
        </section>

        {/* 4. Social Links */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
          <h2 className="text-lg font-black text-zinc-950">Social Accounts</h2>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-zinc-600">Facebook URL</span>
              <input
                type="text"
                value={form.facebook}
                onChange={(e) => update("facebook", e.target.value)}
                placeholder="facebook.com/..."
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm outline-none focus:border-brand-600 focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-zinc-600">Twitter/X URL</span>
              <input
                type="text"
                value={form.twitter}
                onChange={(e) => update("twitter", e.target.value)}
                placeholder="twitter.com/..."
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm outline-none focus:border-brand-600 focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-zinc-600">Instagram URL</span>
              <input
                type="text"
                value={form.instagram}
                onChange={(e) => update("instagram", e.target.value)}
                placeholder="instagram.com/..."
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm outline-none focus:border-brand-600 focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-zinc-600">LinkedIn URL</span>
              <input
                type="text"
                value={form.linkedin}
                onChange={(e) => update("linkedin", e.target.value)}
                placeholder="linkedin.com/company/..."
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm outline-none focus:border-brand-600 focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-zinc-600">YouTube Channel URL</span>
              <input
                type="text"
                value={form.youtube}
                onChange={(e) => update("youtube", e.target.value)}
                placeholder="youtube.com/c/..."
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm outline-none focus:border-brand-600 focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-zinc-600">TikTok URL</span>
              <input
                type="text"
                value={form.tiktok}
                onChange={(e) => update("tiktok", e.target.value)}
                placeholder="tiktok.com/@..."
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm outline-none focus:border-brand-600 focus:bg-white"
              />
            </label>
          </div>
        </section>

        {/* 5. Visibility */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-black text-zinc-950">Visibility</h2>
          <p className="mt-1 text-xs font-medium text-zinc-500">
            Control the discoverability of your organization's profile.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              {
                val: "public",
                title: "Public Profile",
                desc: "Everyone can search, view, and follow this organization.",
              },
              {
                val: "private",
                title: "Private Profile",
                desc: "Only members can access and view details.",
              },
            ].map((v) => (
              <label
                key={v.val}
                className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${
                  form.visibility === v.val
                    ? "border-brand-600 bg-brand-50/20"
                    : "border-zinc-200 bg-white hover:border-zinc-300"
                }`}
              >
                <input
                  type="radio"
                  name="visibility"
                  checked={form.visibility === v.val}
                  onChange={() => update("visibility", v.val as "public" | "private")}
                  className="mt-1 accent-brand-700"
                />
                <div>
                  <span className="block text-sm font-black text-zinc-900">{v.title}</span>
                  <span className="mt-0.5 block text-xs font-medium text-zinc-500">{v.desc}</span>
                </div>
              </label>
            ))}
          </div>
        </section>

        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-700 py-4 text-base font-black text-white hover:bg-brand-800 disabled:bg-brand-300 transition"
        >
          {saving && <Loader2 className="h-5 w-5 animate-spin" />}
          {saving ? "Saving Changes..." : "Save Settings"}
        </button>

      </form>
    </div>
  );
}
