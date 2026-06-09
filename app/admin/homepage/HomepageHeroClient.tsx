"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import {
  DEFAULT_HOMEPAGE_HERO,
  type HomepageHeroSettings,
  homepageHeroToSettings,
  normalizeHomepageHeroSettings,
} from "@/lib/homepage-hero";

type Props = {
  initialHero: HomepageHeroSettings;
};

export default function HomepageHeroClient({ initialHero }: Props) {
  const [hero, setHero] = useState(initialHero);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  function updateField(field: keyof HomepageHeroSettings, value: string) {
    setHero((current) => ({ ...current, [field]: value }));
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setToast("");
    setError("");

    const normalizedHero = normalizeHomepageHeroSettings(hero);
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settings: homepageHeroToSettings(normalizedHero),
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Hero settings could not be saved.");
      return;
    }

    setHero(normalizedHero);
    setToast("Homepage hero saved.");
    setTimeout(() => setToast(""), 3500);
  }

  function handleReset() {
    setHero(DEFAULT_HOMEPAGE_HERO);
    setToast("");
    setError("");
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-orange-600">
            Homepage
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-zinc-950">
            Hero Photo & Message
          </h1>
          <p className="mt-1 max-w-2xl text-sm font-medium text-zinc-500">
            Change the main homepage image and the message shown on top of it.
          </p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="w-fit rounded-xl border border-zinc-200 px-4 py-2 text-xs font-black text-zinc-700 transition hover:border-orange-200 hover:text-orange-600"
        >
          Reset defaults
        </button>
      </div>

      {toast && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {toast}
        </div>
      )}
      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="grid gap-6 lg:grid-cols-[1fr_1.05fr]">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <label className="sm:col-span-2 lg:col-span-1">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-zinc-500">
              Photo URL
            </span>
            <input
              type="url"
              value={hero.imageUrl}
              onChange={(e) => updateField("imageUrl", e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm font-semibold outline-none focus:border-orange-500"
            />
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-zinc-500">
              Label
            </span>
            <input
              type="text"
              value={hero.eyebrow}
              onChange={(e) => updateField("eyebrow", e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm font-semibold outline-none focus:border-orange-500"
            />
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-zinc-500">
              Button Text
            </span>
            <input
              type="text"
              value={hero.buttonText}
              onChange={(e) => updateField("buttonText", e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm font-semibold outline-none focus:border-orange-500"
            />
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-zinc-500">
              Headline Line 1
            </span>
            <input
              type="text"
              value={hero.headlineLine1}
              onChange={(e) => updateField("headlineLine1", e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm font-semibold outline-none focus:border-orange-500"
            />
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-zinc-500">
              Headline Line 2
            </span>
            <input
              type="text"
              value={hero.headlineLine2}
              onChange={(e) => updateField("headlineLine2", e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm font-semibold outline-none focus:border-orange-500"
            />
          </label>

          <label className="sm:col-span-2 lg:col-span-1">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-zinc-500">
              Button Link
            </span>
            <input
              type="text"
              value={hero.buttonHref}
              onChange={(e) => updateField("buttonHref", e.target.value)}
              placeholder="/events"
              className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm font-semibold outline-none focus:border-orange-500"
            />
          </label>

          <div className="sm:col-span-2 lg:col-span-1">
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-orange-600 px-5 py-3 text-sm font-black text-white transition hover:bg-orange-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Hero"}
            </button>
          </div>
        </div>

        <div className="min-w-0">
          <p className="mb-2 text-xs font-black uppercase tracking-wide text-zinc-500">
            Preview
          </p>
          <div
            className="relative flex min-h-64 items-center overflow-hidden rounded-xl bg-cover bg-center p-5 sm:min-h-80 sm:p-8"
            style={{
              backgroundImage: `url("${hero.imageUrl.replaceAll('"', "")}")`,
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-black/10" />
            <div className="relative max-w-full">
              <p className="inline-flex bg-pink-200 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-zinc-950 sm:text-xs">
                {hero.eyebrow}
              </p>
              <h2 className="mt-3 text-3xl font-black leading-tight text-white sm:text-5xl">
                <span className="box-decoration-clone bg-indigo-300 px-2 text-zinc-950">
                  {hero.headlineLine1}
                </span>
                <br />
                <span className="box-decoration-clone bg-pink-200 px-2 text-zinc-950">
                  {hero.headlineLine2}
                </span>
              </h2>
              <span className="mt-5 inline-flex rounded-full bg-white px-5 py-2 text-sm font-black text-zinc-950">
                {hero.buttonText}
              </span>
            </div>
          </div>
        </div>
      </form>
    </section>
  );
}
