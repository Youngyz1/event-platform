"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import BrandMark from "@/components/BrandMark";

type Account = {
  displayName: string;
};

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
  const pathname = usePathname();
  const [account, setAccount] = useState<Account | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  function accountFromUser(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null | undefined) {
    if (!user?.email) return null;

    const displayName =
      typeof user.user_metadata?.display_name === "string" && user.user_metadata.display_name.trim()
        ? user.user_metadata.display_name.trim()
        : "Account";

    return { displayName };
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAccount(accountFromUser(data.session?.user));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccount(accountFromUser(session?.user));
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    setDropdownOpen(false);
    router.push("/");
    router.refresh();
  }

  const accountName = account?.displayName ?? "";
  const initials = accountName ? accountName[0].toUpperCase() : "";
  const isHomepage = pathname === "/";

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-200 bg-white">
      <div className={`mx-auto flex max-w-[1440px] items-center px-4 md:px-5 ${isHomepage ? "min-h-10 gap-2 max-lg:px-2" : "min-h-16 gap-3"}`}>
        {/* Logo */}
        <Link href="/" className={`shrink-0 text-zinc-950 ${isHomepage ? "text-xs sm:text-2xl" : "text-xl sm:text-2xl"}`}>
          <BrandMark textClassName="text-zinc-950" />
        </Link>

        <button
          type="button"
          onClick={() => setMobileSearchOpen((open) => !open)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-zinc-700 transition hover:border-orange-200 hover:text-orange-600 md:h-9 md:w-9"
          aria-expanded={mobileSearchOpen}
          aria-label="Search events"
        >
          <SearchIcon />
        </button>

        {/* Desktop nav — same links regardless of auth state */}
        <div className={`ml-auto items-center whitespace-nowrap font-bold text-zinc-700 ${isHomepage ? "flex gap-1 text-[5.5px] md:gap-5 md:text-sm" : "hidden gap-5 text-sm md:flex"}`}>
          <Link href="/" className="hover:text-orange-600">Home</Link>
          <Link href="/organizers" className={`${isHomepage ? "inline" : "hidden md:inline"} hover:text-orange-600`}>Organizers</Link>
          <Link href="/create-event" className={`${isHomepage ? "inline" : "hidden md:inline"} hover:text-orange-600`}>Create Event</Link>
          <Link href="/my-tickets" className="hover:text-orange-600">My Tickets</Link>
          <Link href="/find-tickets" className="hover:text-orange-600">Find Tickets</Link>

          {account ? (
            /* Logged in — avatar dropdown replaces Log in / Sign up */
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((o) => !o)}
                className="flex items-center gap-2 rounded-full bg-orange-600 px-3 py-2 font-black text-white transition hover:bg-orange-700"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-black text-orange-600">
                  {initials}
                </span>
                <span className="hidden max-w-32 truncate xl:inline">{accountName}</span>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-zinc-200 bg-white py-2 shadow-lg">
                  <p className="truncate px-4 py-2 text-sm font-black text-zinc-800">{accountName}</p>
                  <div className="my-1 border-t border-zinc-100" />
                  <Link
                    href="/dashboard"
                    onClick={() => setDropdownOpen(false)}
                    className="block px-4 py-2 text-sm font-bold text-zinc-700 hover:bg-zinc-50 hover:text-orange-600"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/my-tickets"
                    onClick={() => setDropdownOpen(false)}
                    className="block px-4 py-2 text-sm font-bold text-zinc-700 hover:bg-zinc-50 hover:text-orange-600"
                  >
                    My Tickets
                  </Link>
                  <div className="my-1 border-t border-zinc-100" />
                  <button
                    onClick={handleLogout}
                    className="block w-full px-4 py-2 text-left text-sm font-bold text-red-500 hover:bg-red-50"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/login" className="hover:text-orange-600">Log in</Link>
              <Link
                href="/signup"
                className={`rounded-full bg-orange-600 font-black text-white transition hover:bg-orange-700 ${isHomepage ? "px-1.5 py-1 text-[6px] md:px-4 md:py-2 md:text-sm" : "px-4 py-2"}`}
              >
                Sign up
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className={`ml-auto rounded-xl border border-zinc-200 px-3 py-2 text-sm font-black text-zinc-800 md:hidden ${isHomepage ? "hidden" : ""}`}
          aria-expanded={menuOpen}
          aria-label="Toggle navigation"
        >
          Menu
        </button>
      </div>

      {mobileSearchOpen && (
        <form action="/events" className="mx-auto grid max-w-5xl grid-cols-[1fr_1fr_auto] gap-2 border-t border-zinc-100 bg-white px-3 py-3 sm:px-5">
          <label className="relative min-w-0">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
              <SearchIcon />
            </span>
            <input
              name="q"
              type="search"
              placeholder="Search"
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-sm font-semibold outline-none focus:border-orange-500"
            />
          </label>
          <label className="relative min-w-0">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
              <LocationIcon />
            </span>
            <input
              name="location"
              type="search"
              placeholder="City"
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-sm font-semibold outline-none focus:border-orange-500"
            />
          </label>
          <button
            type="submit"
            className="flex h-10 w-11 items-center justify-center rounded-xl bg-orange-600 text-white transition hover:bg-orange-700"
            aria-label="Submit search"
          >
            <SearchIcon />
          </button>
        </form>
      )}

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-zinc-200 bg-white px-4 py-4 md:hidden">
          <form action="/events" className="grid gap-3">
            <label className="relative block">
              <input
                name="q"
                type="search"
                placeholder="Search events"
                className="w-full rounded-xl border border-zinc-200 px-10 py-3 outline-none focus:border-orange-500"
              />
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                <SearchIcon />
              </span>
            </label>
            <label className="relative block">
              <input
                name="location"
                type="search"
                placeholder="Location"
                className="w-full rounded-xl border border-zinc-200 px-10 py-3 outline-none focus:border-orange-500"
              />
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                <LocationIcon />
              </span>
            </label>
            <button className="rounded-xl bg-orange-600 px-4 py-3 font-black text-white">
              Search
            </button>
          </form>

          <div className="mt-5 grid gap-3 text-base font-bold text-zinc-800">
            {[
              ["Home", "/"],
              ["Events", "/events"],
              ["Fundraisers", "/fundraisers"],
              ["Organizers", "/organizers"],
              ["Create Event", "/create-event"],
              ["My Tickets", "/my-tickets"],
              ["Find Tickets", "/find-tickets"],
              ...(account ? [["Dashboard", "/dashboard"]] : []),
            ].map(([label, href]) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="rounded-xl bg-zinc-50 px-4 py-3"
              >
                {label}
              </Link>
            ))}

            {account ? (
              <button
                onClick={handleLogout}
                className="rounded-xl bg-red-50 px-4 py-3 text-left font-black text-red-500"
              >
                Log out
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl bg-zinc-100 px-4 py-3 text-center"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl bg-orange-600 px-4 py-3 text-center text-white"
                >
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
