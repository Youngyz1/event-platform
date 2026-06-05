"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

const EventMap = dynamic(() => import("@/components/EventMap"), { ssr: false });

type EventPin = {
  id: string;
  slug: string;
  title: string;
  latitude: number | null;
  longitude: number | null;
  event_date: string | null;
  city: string | null;
  banner: string | null;
  category: string | null;
};

type Props = {
  events: EventPin[];
  height?: string;
};

export default function MapSection({ events, height }: Props) {
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "granted" | "denied">("idle");
  const mountedRef = useRef(false);

  function requestLocation() {
    if (!navigator.geolocation) {
      if (!mountedRef.current) return;
      setLocationStatus("denied");
      return;
    }
    if (!mountedRef.current) return;
    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!mountedRef.current) return;
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        setLocationStatus("granted");
      },
      () => {
        if (!mountedRef.current) return;
        setLocationStatus("denied");
      },
      { timeout: 8000 }
    );
  }

  // Auto-request on mount
  useEffect(() => {
    mountedRef.current = true;
    const timeout = window.setTimeout(() => {
      requestLocation();
    }, 0);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(timeout);
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Location status bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-sm text-zinc-600">
          {locationStatus === "granted" && (
            <>
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="font-semibold">Showing events near your location</span>
            </>
          )}
          {locationStatus === "denied" && (
            <>
              <span className="w-2 h-2 bg-zinc-400 rounded-full" />
              <span className="text-zinc-400">Location not available — showing New Jersey events</span>
            </>
          )}
          {locationStatus === "loading" && (
            <>
              <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-zinc-400">Detecting your location...</span>
            </>
          )}
          {locationStatus === "idle" && (
            <span className="text-zinc-400">Loading map...</span>
          )}
        </div>

        {locationStatus === "denied" && (
          <button
            onClick={requestLocation}
            className="text-sm text-blue-600 font-semibold hover:underline flex items-center gap-1"
          >
            📍 Try again
          </button>
        )}
      </div>

      <EventMap
        events={events}
        userLat={userLat}
        userLng={userLng}
        height={height ?? "420px"}
      />
    </div>
  );
}
