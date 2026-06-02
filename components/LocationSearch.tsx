"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LocationSearch() {
  const router = useRouter();
  const [userLocation, setUserLocation] = useState<{ city: string; state: string } | null>(null);
  const [locationStatus, setLocationStatus] = useState('idle');
  const [searchQuery, setSearchQuery] = useState('');
  const [cityResults, setCityResults] = useState<{ city: string }[]>([]);

  const detectLocation = () => {
    if (!navigator.geolocation) { setLocationStatus('denied'); return; }
    setLocationStatus('loading');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const response = await fetch(`/api/geocode?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
          if (response.ok) { const data = await response.json(); setUserLocation(data); setLocationStatus('granted'); }
          else setLocationStatus('denied');
        } catch (e) { setLocationStatus('denied'); }
      },
      () => setLocationStatus('denied'),
      { timeout: 10000 }
    );
  };

  useEffect(() => {
    // Defer calling detectLocation to avoid synchronous setState inside the effect
    const t = setTimeout(() => detectLocation(), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const searchCities = async () => {
      if (searchQuery.length < 2) { setCityResults([]); return; }
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(searchQuery)}`);
        if (response.ok) { const results = await response.json(); setCityResults(results); }
      } catch (e) { console.error(e); }
    };
    const debounce = setTimeout(searchCities, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  

  return (
    <div className='space-y-4'>
      {locationStatus === 'granted' && userLocation && (
        <div className='bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <span className='text-2xl'>📍</span>
            <div>
              <p className='text-sm text-blue-600 font-semibold'>Your current location</p>
              <p className='font-bold'>{userLocation.city}, {userLocation.state}</p>
            </div>
          </div>
          <button
            onClick={() => router.push(`/events?location=${encodeURIComponent(userLocation.city)}`)}
            className='bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm'
          >
            Find Events
          </button>
        </div>
      )}
      {locationStatus === 'loading' && (
        <div className='bg-zinc-50 border border-zinc-200 rounded-xl p-4'>Detecting location...</div>
      )}
      {locationStatus === 'denied' && (
        <div className='bg-zinc-50 border border-zinc-200 rounded-xl p-4'>Enable location to find events near you</div>
      )}
      <input
        type='text'
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        placeholder='Search city'
        className='w-full border border-zinc-200 rounded-xl px-4 py-3'
      />
      {cityResults.length > 0 && (
        <div className='absolute bg-white border shadow-lg z-50'>
          {cityResults.map((c, i) => (
            <button
              key={i}
              onClick={() => router.push(`/events?location=${encodeURIComponent(c.city)}`)}
              className='block w-full text-left p-3'
            >
              {c.city}
            </button>
          ))}
        </div>
      )}
      <div className='flex gap-2 flex-wrap'>
        {['New York', 'Los Angeles', 'Chicago', 'Miami', 'Boston'].map(city => (
          <button
            key={city}
            onClick={() => router.push(`/events?location=${encodeURIComponent(city)}`)}
            className='bg-zinc-100 px-4 py-2 rounded-full text-sm'
          >
            {city}
          </button>
        ))}
      </div>
    </div>
  );
}