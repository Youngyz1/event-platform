"use client";

import { useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type CityResult = {
  city: string;
  state?: string;
  country?: string;
};

type EventsHeaderControlsProps = {
  location: string;
  activeWhen: "all" | "weekend";
};

function cityLabel(city: CityResult) {
  return [city.city, city.state].filter(Boolean).join(", ");
}

export default function EventsHeaderControls({
  location,
  activeWhen,
}: EventsHeaderControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState("");
  const [cityResults, setCityResults] = useState<CityResult[]>([]);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "error">("idle");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayLocation = location || "Your Location";

  function withParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  function chooseCity(city: string) {
    setOpen(false);
    setCityQuery("");
    setCityResults([]);
    router.push(withParams({ location: city }));
  }

  function setWhen(when: "all" | "weekend") {
    router.push(withParams({ when: when === "weekend" ? "weekend" : null, date: null }));
  }

  async function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("error");
      return;
    }

    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const response = await fetch(
            `/api/geocode?lat=${position.coords.latitude}&lng=${position.coords.longitude}`
          );

          if (!response.ok) throw new Error("Unable to find city");

          const data = (await response.json()) as CityResult;
          if (!data.city) throw new Error("Unable to find city");

          setLocationStatus("idle");
          chooseCity(data.city);
        } catch {
          setLocationStatus("error");
        }
      },
      () => setLocationStatus("error"),
      { timeout: 10000 }
    );
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    let active = true;

    async function searchCities() {
      if (cityQuery.trim().length < 2) {
        setCityResults([]);
        return;
      }

      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(cityQuery.trim())}`);
        if (!response.ok) return;

        const results = (await response.json()) as CityResult[];
        if (active) setCityResults(results);
      } catch {
        if (active) setCityResults([]);
      }
    }

    const debounce = setTimeout(searchCities, 250);

    return () => {
      active = false;
      clearTimeout(debounce);
    };
  }, [cityQuery]);

  return (
    <div className="mb-6 space-y-5">
      <div className="relative max-w-full" ref={dropdownRef}>
        <div className="inline-flex flex-wrap items-baseline gap-x-2">
          <span className="text-2xl font-black text-zinc-950 sm:text-3xl whitespace-nowrap">
            Browsing events in
          </span>
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-label="Change event location"
            aria-expanded={open}
            title="Change event location"
            className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm hover:border-orange-300 hover:text-orange-500 transition-colors"
          >
            <Search className="h-5 w-5" />
          </button>
        </div>

        {open && (
          <div className="absolute left-0 top-full z-30 mt-3 w-[min(92vw,360px)] rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl">
            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={locationStatus === "loading"}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-black text-white transition hover:bg-orange-600 disabled:cursor-wait disabled:opacity-70"
            >
              <LocateFixed className="h-4 w-4" />
              {locationStatus === "loading" ? "Finding your location..." : "Use my current location"}
            </button>

            {locationStatus === "error" && (
              <p className="mt-3 rounded-xl bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-700">
                Location is unavailable. Enter a city instead.
              </p>
            )}

            <label className="mt-4 block text-sm font-black text-zinc-800" htmlFor="events-city-search">
              Or enter a city
            </label>
            <div className="relative mt-2">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                id="events-city-search"
                type="search"
                value={cityQuery}
                onChange={(event) => setCityQuery(event.target.value)}
                placeholder="Search city"
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-3 text-sm font-semibold outline-none transition focus:border-orange-500"
              />
            </div>

            {cityResults.length > 0 && (
              <div className="mt-2 overflow-hidden rounded-xl border border-zinc-200">
                {cityResults.map((city, index) => (
                  <button
                    type="button"
                    key={`${city.city}-${city.state || city.country || index}`}
                    onClick={() => chooseCity(city.city)}
                    className="block w-full px-4 py-3 text-left text-sm font-bold text-zinc-800 transition hover:bg-orange-50 hover:text-orange-700"
                  >
                    {cityLabel(city)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setWhen("all")}
          className={`rounded-full px-4 py-2 text-sm font-black transition ${
            activeWhen === "all"
              ? "bg-orange-500 text-white"
              : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:text-orange-600"
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setWhen("weekend")}
          className={`rounded-full px-4 py-2 text-sm font-black transition ${
            activeWhen === "weekend"
              ? "bg-orange-500 text-white"
              : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:text-orange-600"
          }`}
        >
          This weekend
        </button>
      </div>
    </div>
  );
}
