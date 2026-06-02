"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function SearchIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path d="M12 21s7-5.1 7-12a7 7 0 1 0-14 0c0 6.9 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

export default function Navbar() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user?.email ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-200 bg-white">
      <div className="mx-auto flex min-h-16 max-w-[1440px] items-center gap-3 px-4 md:px-5">
        <Link href="/" className="shrink-0 text-xl font-black tracking-tight text-orange-600 sm:text-2xl">
          EventPlatform
        </Link>

        <div className="hidden min-w-0 flex-1 items-center rounded-full border border-zinc-300 bg-white shadow-sm lg:flex">
          <div className="flex min-w-0 flex-1 items-center gap-3 border-r border-zinc-200 px-4 py-3 text-zinc-500">
            <SearchIcon />
            <input
              type="search"
              placeholder="Search events"
              className="w-full min-w-0 bg-transparent text-base font-medium outline-none placeholder:text-zinc-500"
            />
          </div>
          <div className="flex w-56 items-center gap-3 px-4 py-3 text-zinc-500">
            <LocationIcon />
            <input
              type="search"
              placeholder="Location"
              className="w-full min-w-0 bg-transparent text-base font-medium outline-none placeholder:text-zinc-500"
            />
          </div>
        </div>

        <div className="ml-auto hidden items-center gap-5 whitespace-nowrap text-sm font-bold text-zinc-700 md:flex">
          <Link href="/" className="hover:text-orange-600">
            Home
          </Link>
          <Link href="/organizers" className="hidden hover:text-orange-600 md:inline">
            Organizers
          </Link>
          <Link href="/create-event" className="hidden hover:text-orange-600 md:inline">
            Create Event
          </Link>
          <Link href="/import" className="hidden hover:text-orange-600 xl:inline">
            Import
          </Link>
          <Link href="/eventbrite-sync" className="hidden hover:text-orange-600 xl:inline">
            Eventbrite
          </Link>
          <Link href="/gofundme-sync" className="hidden hover:text-orange-600 xl:inline">
            GoFundMe
          </Link>
          <Link href="/create-organizer" className="hidden hover:text-orange-600 xl:inline">
            Create Organizer
          </Link>

          {email ? (
            <>
              <Link href="/dashboard" className="hover:text-orange-600">
                Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-full bg-zinc-100 px-4 py-2 font-black text-zinc-800 transition hover:bg-zinc-200"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-orange-600">
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-orange-600 px-4 py-2 font-black text-white transition hover:bg-orange-700"
              >
                Sign up
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="ml-auto rounded-xl border border-zinc-200 px-3 py-2 text-sm font-black text-zinc-800 md:hidden"
          aria-expanded={menuOpen}
          aria-label="Toggle navigation"
        >
          Menu
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-zinc-200 bg-white px-4 py-4 md:hidden">
          <form action="/events" className="grid gap-3">
            <input
              name="q"
              type="search"
              placeholder="Search events"
              className="rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-orange-500"
            />
            <input
              name="location"
              type="search"
              placeholder="Location"
              className="rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-orange-500"
            />
            <button className="rounded-xl bg-orange-600 px-4 py-3 font-black text-white">
              Search
            </button>
          </form>

          <div className="mt-5 grid gap-3 text-base font-bold text-zinc-800">
            {[
              ["Home", "/"],
              ["About", "/about"],
              ["Events", "/events"],
              ["Fundraisers", "/fundraisers"],
              ["Organizers", "/organizers"],
              ["Create Event", "/create-event"],
              ["Import", "/import"],
              ["Eventbrite Sync", "/eventbrite-sync"],
              ["GoFundMe Sync", "/gofundme-sync"],
              ["Dashboard", "/dashboard"],
            ].map(([label, href]) => (
              <Link key={href} href={href} onClick={() => setMenuOpen(false)} className="rounded-xl bg-zinc-50 px-4 py-3">
                {label}
              </Link>
            ))}
            {email ? (
              <button
                onClick={handleLogout}
                className="rounded-xl bg-zinc-950 px-4 py-3 text-left font-black text-white"
              >
                Log out
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Link href="/login" onClick={() => setMenuOpen(false)} className="rounded-xl bg-zinc-100 px-4 py-3 text-center">
                  Log in
                </Link>
                <Link href="/signup" onClick={() => setMenuOpen(false)} className="rounded-xl bg-orange-600 px-4 py-3 text-center text-white">
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
