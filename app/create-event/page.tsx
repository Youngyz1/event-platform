"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import dynamic from "next/dynamic";

// Dynamically import Leaflet map picker (client only)
const LocationPicker = dynamic(() => import("@/components/LocationPicker"), { ssr: false });

type Organizer = {
  id: string;
  name: string;
  photo: string | null;
};

const VENUE_TEMPLATES = [
  { label: "General Admission (no seats)", value: "none" },
  { label: "Small Venue — 50 seats (5 rows × 10)", value: "small" },
  { label: "Medium Hall — 200 seats (10 rows × 20)", value: "medium" },
  { label: "Large Arena — 500 seats (10 rows × 50)", value: "large" },
];

const TEMPLATE_CONFIG: Record<string, { sections: { name: string; rows: number; seatsPerRow: number }[] }> = {
  small: { sections: [{ name: "Main", rows: 5, seatsPerRow: 10 }] },
  medium: { sections: [{ name: "Floor", rows: 5, seatsPerRow: 20 }, { name: "Balcony", rows: 5, seatsPerRow: 20 }] },
  large: { sections: [{ name: "Floor A", rows: 5, seatsPerRow: 25 }, { name: "Floor B", rows: 5, seatsPerRow: 25 }, { name: "VIP", rows: 2, seatsPerRow: 20 }] },
};

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

export default function CreateEventPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState("");
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [venueTemplate, setVenueTemplate] = useState("none");
  const [showMapPicker, setShowMapPicker] = useState(false);

  const [form, setForm] = useState({
    organizer_id: "",
    title: "",
    category: "Music",
    event_date: "",
    venue: "",
    city: "",
    banner: "",
    description: "",
    ticket1_name: "Regular Ticket",
    ticket1_price: "",
    ticket2_name: "VIP Ticket",
    ticket2_price: "",
    latitude: "",
    longitude: "",
  });

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.push("/login");
      } else {
        const { data: organizerProfiles, error: organizerError } = await supabase
          .from("organizers")
          .select("id, name, photo")
          .eq("user_id", data.session.user.id)
          .order("created_at", { ascending: false });

        if (organizerError) setError(organizerError.message);

        const profiles = organizerProfiles ?? [];
        setOrganizers(profiles);
        setForm((current) => ({
          ...current,
          organizer_id: current.organizer_id || profiles[0]?.id || "",
        }));
        setChecking(false);
      }
    });
  }, [router]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const slug = generateSlug(form.title);
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) { router.push("/login"); return; }
    if (!form.organizer_id) {
      setError("Create or select an organizer profile before publishing an event.");
      setLoading(false); return;
    }
    if (!organizers.some((o) => o.id === form.organizer_id)) {
      setError("Select one of your organizer profiles before publishing an event.");
      setLoading(false); return;
    }

    // Upload video if selected
    let video_url = null;
    if (videoFile) {
      setUploadProgress("Uploading video...");
      const ext = videoFile.name.split(".").pop();
      const fileName = `${slug}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("event-videos").upload(fileName, videoFile);
      if (uploadError) {
        setError("Video upload failed: " + uploadError.message);
        setLoading(false); return;
      }
      const { data: urlData } = supabase.storage.from("event-videos").getPublicUrl(fileName);
      video_url = urlData.publicUrl;
      setUploadProgress("");
    }

    const { data: event, error: eventError } = await supabase
      .from("events")
      .insert({
        title: form.title,
        slug,
        description: form.description,
        category: form.category,
        venue: form.venue,
        city: form.city,
        banner: form.banner,
        event_date: form.event_date,
        video_url,
        organizer_id: form.organizer_id,
        user_id: session.user.id,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
      })
      .select()
      .single();

    if (eventError) { setError(eventError.message); setLoading(false); return; }

    const tickets = [
      { event_id: event.id, name: form.ticket1_name, price: Number(form.ticket1_price), quantity: 100 },
      { event_id: event.id, name: form.ticket2_name, price: Number(form.ticket2_price), quantity: 50 },
    ].filter((t) => t.name && t.price);

    if (tickets.length > 0) {
      const { error: ticketError } = await supabase.from("tickets").insert(tickets);
      if (ticketError) { setError(ticketError.message); setLoading(false); return; }
    }

    // Create venue seat layout if template chosen
    if (venueTemplate !== "none" && TEMPLATE_CONFIG[venueTemplate]) {
      const templateCfg = TEMPLATE_CONFIG[venueTemplate];
      const { data: layout, error: layoutError } = await supabase
        .from("venue_layouts")
        .insert({ event_id: event.id, name: "Main Venue", sections: templateCfg.sections })
        .select()
        .single();

      if (!layoutError && layout) {
        // Generate all seat records
        const seatRows: object[] = [];
        const rowLabels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
        for (const section of templateCfg.sections) {
          for (let r = 0; r < section.rows; r++) {
            for (let s = 1; s <= section.seatsPerRow; s++) {
              seatRows.push({
                layout_id: layout.id,
                event_id: event.id,
                section: section.name,
                row_label: rowLabels[r] || String(r + 1),
                seat_number: s,
                status: "available",
              });
            }
          }
        }
        // Insert in batches of 500
        for (let i = 0; i < seatRows.length; i += 500) {
          await supabase.from("seats").insert(seatRows.slice(i, i + 500));
        }
      }
    }

    router.push(`/events/${slug}`);
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
          <p className="text-orange-500 font-semibold mb-3">Organizer Dashboard</p>
          <h1 className="text-5xl font-black">Create New Event</h1>
          <p className="text-zinc-600 text-lg mt-4">Publish your event and start selling tickets.</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-5 py-4 rounded-2xl">{error}</div>
        )}

        {organizers.length === 0 && (
          <div className="mb-6 bg-orange-50 border border-orange-200 text-orange-800 px-5 py-4 rounded-2xl">
            Create an organizer profile first.{" "}
            <Link href="/create-organizer" className="font-bold underline">Create organizer</Link>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Organizer */}
          <div>
            <label className="block font-semibold mb-3">Organizer Profile</label>
            <select name="organizer_id" value={form.organizer_id} onChange={handleChange} required
              disabled={organizers.length === 0}
              className="w-full border border-zinc-300 rounded-2xl px-5 py-4 outline-none focus:border-orange-500 disabled:bg-zinc-100">
              {organizers.length === 0
                ? <option value="">No organizer profiles yet</option>
                : organizers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block font-semibold mb-3">Event Title</label>
            <input name="title" value={form.title} onChange={handleChange} required type="text"
              placeholder="Afrobeats Summer Festival"
              className="w-full border border-zinc-300 rounded-2xl px-5 py-4 outline-none focus:border-orange-500" />
          </div>

          {/* Category */}
          <div>
            <label className="block font-semibold mb-3">Category</label>
            <select name="category" value={form.category} onChange={handleChange}
              className="w-full border border-zinc-300 rounded-2xl px-5 py-4 outline-none focus:border-orange-500">
              <option>Music</option><option>Business</option><option>Technology</option>
              <option>Sports</option><option>Dating</option><option>Education</option>
              <option>Nightlife</option><option>Holidays</option><option>Performing &amp; Visual Arts</option>
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block font-semibold mb-3">Event Date</label>
            <input name="event_date" value={form.event_date} onChange={handleChange} required type="datetime-local"
              className="w-full border border-zinc-300 rounded-2xl px-5 py-4 outline-none focus:border-orange-500" />
          </div>

          {/* Venue + City */}
          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <label className="block font-semibold mb-3">Venue</label>
              <input name="venue" value={form.venue} onChange={handleChange} type="text" placeholder="Abidjan Stadium"
                className="w-full border border-zinc-300 rounded-2xl px-5 py-4 outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block font-semibold mb-3">City</label>
              <input name="city" value={form.city} onChange={handleChange} type="text" placeholder="Abidjan"
                className="w-full border border-zinc-300 rounded-2xl px-5 py-4 outline-none focus:border-orange-500" />
            </div>
          </div>

          {/* Location Pin on Map */}
          <div>
            <label className="block font-semibold mb-3">
              📍 Pin Venue on Map
              <span className="text-zinc-400 font-normal text-sm ml-2">(helps attendees find you)</span>
            </label>
            {form.latitude && form.longitude ? (
              <div className="flex items-center gap-4 bg-green-50 border border-green-200 rounded-2xl px-5 py-4">
                <span className="text-green-600 font-semibold text-sm">
                  ✓ Location set: {parseFloat(form.latitude).toFixed(5)}, {parseFloat(form.longitude).toFixed(5)}
                </span>
                <button type="button" onClick={() => setShowMapPicker(true)}
                  className="text-sm text-blue-600 font-semibold hover:underline">Change</button>
                <button type="button" onClick={() => { setForm(f => ({ ...f, latitude: "", longitude: "" })); }}
                  className="text-sm text-red-500 font-semibold hover:underline ml-auto">Remove</button>
              </div>
            ) : (
              <button type="button" onClick={() => setShowMapPicker(true)}
                className="w-full border-2 border-dashed border-zinc-300 hover:border-orange-400 rounded-2xl px-5 py-6 text-center transition">
                <span className="text-3xl block mb-2">🗺️</span>
                <span className="font-semibold text-zinc-600">Click to pin your venue on the map</span>
              </button>
            )}

            {showMapPicker && (
              <div className="mt-4 rounded-2xl overflow-hidden border border-zinc-300 shadow-lg">
                <div className="bg-zinc-800 text-white px-4 py-2 text-sm font-semibold flex justify-between">
                  <span>Click on the map to set your venue location</span>
                  <button type="button" onClick={() => setShowMapPicker(false)} className="text-zinc-400 hover:text-white">✕ Done</button>
                </div>
                <LocationPicker
                  lat={form.latitude ? parseFloat(form.latitude) : undefined}
                  lng={form.longitude ? parseFloat(form.longitude) : undefined}
                  onPick={(lat, lng) => {
                    setForm(f => ({ ...f, latitude: String(lat), longitude: String(lng) }));
                  }}
                />
              </div>
            )}
          </div>

          {/* Banner */}
          <div>
            <label className="block font-semibold mb-3">Banner Image URL</label>
            <input name="banner" value={form.banner} onChange={handleChange} type="text" placeholder="https://..."
              className="w-full border border-zinc-300 rounded-2xl px-5 py-4 outline-none focus:border-orange-500" />
          </div>

          {/* Video */}
          <div>
            <label className="block font-semibold mb-3">
              Event Video <span className="text-zinc-400 font-normal">(optional)</span>
            </label>
            <div className="border-2 border-dashed border-zinc-300 rounded-2xl p-8 text-center hover:border-orange-500 transition">
              <input type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                className="hidden" id="video-upload" />
              <label htmlFor="video-upload" className="cursor-pointer">
                {videoFile ? (
                  <div>
                    <p className="text-orange-500 font-semibold">✓ {videoFile.name}</p>
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
            {uploadProgress && <p className="text-orange-500 font-semibold mt-3">{uploadProgress}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block font-semibold mb-3">Event Description</label>
            <textarea name="description" value={form.description} onChange={handleChange} rows={6}
              placeholder="Describe your event..."
              className="w-full border border-zinc-300 rounded-2xl px-5 py-4 outline-none focus:border-orange-500" />
          </div>

          {/* Venue Layout / Seat Map */}
          <div>
            <label className="block font-semibold mb-3">
              🪑 Venue Layout &amp; Seat Map
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              {VENUE_TEMPLATES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setVenueTemplate(t.value)}
                  className={`text-left border rounded-2xl px-5 py-4 transition ${
                    venueTemplate === t.value
                      ? "border-orange-500 bg-orange-50 text-orange-900"
                      : "border-zinc-200 hover:border-zinc-300 bg-white"
                  }`}
                >
                  <p className="font-bold">{t.label}</p>
                </button>
              ))}
            </div>
            {venueTemplate !== "none" && (
              <p className="mt-3 text-sm text-zinc-500 bg-zinc-50 rounded-xl px-4 py-3">
                ✓ A seat map will be generated automatically when you publish this event.
                Attendees will be able to pick their seats during checkout.
              </p>
            )}
          </div>

          {/* Tickets */}
          <div>
            <label className="block font-semibold mb-5">Ticket Types</label>
            <div className="space-y-5">
              <div className="grid md:grid-cols-2 gap-5">
                <input name="ticket1_name" value={form.ticket1_name} onChange={handleChange} type="text"
                  placeholder="Regular Ticket"
                  className="border border-zinc-300 rounded-2xl px-5 py-4 outline-none focus:border-orange-500" />
                <input name="ticket1_price" value={form.ticket1_price} onChange={handleChange} type="number"
                  placeholder="25"
                  className="border border-zinc-300 rounded-2xl px-5 py-4 outline-none focus:border-orange-500" />
              </div>
              <div className="grid md:grid-cols-2 gap-5">
                <input name="ticket2_name" value={form.ticket2_name} onChange={handleChange} type="text"
                  placeholder="VIP Ticket"
                  className="border border-zinc-300 rounded-2xl px-5 py-4 outline-none focus:border-orange-500" />
                <input name="ticket2_price" value={form.ticket2_price} onChange={handleChange} type="number"
                  placeholder="100"
                  className="border border-zinc-300 rounded-2xl px-5 py-4 outline-none focus:border-orange-500" />
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white py-5 rounded-2xl font-bold text-lg transition">
            {loading ? (uploadProgress || "Publishing...") : "Publish Event"}
          </button>
        </form>
      </section>
    </main>
  );
}
