"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ChevronDown,
  Menu,
  Search,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import BrandMark from "@/components/BrandMark";
import NotificationBell from "@/components/notifications/NotificationBell";
import { cn } from "@/lib/utils";

type Account = {
  id: string;
  displayName: string;
};

type DropdownLink = { label: string; href: string };
type DropdownSection = { label?: string; items: DropdownLink[] };

const DISCOVER_TOP_LINKS: DropdownLink[] = [
  { label: "Browse Fundraisers", href: "/fundraisers" },
];

const DISCOVER_BOTTOM_LINKS: DropdownLink[] = [
  { label: "Organizers", href: "/organizers" },
];

function NavLink({
  href,
  label,
  active,
  onClick,
}: {
  href: string;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "rounded-lg px-3 py-2 text-sm font-bold transition",
        active
          ? "bg-brand-50 text-brand-800"
          : "text-zinc-700 hover:bg-zinc-50 hover:text-brand-700"
      )}
    >
      {label}
    </Link>
  );
}

function NavDropdown({ label, sections }: { label: string; sections: DropdownSection[] }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-bold text-zinc-700 outline-none transition hover:bg-zinc-50 hover:text-brand-700 data-[state=open]:bg-zinc-50 data-[state=open]:text-brand-700"
      >
        {label}
        <ChevronDown className="h-3.5 w-3.5" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={8}
          className="z-50 max-h-[70vh] min-w-[240px] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-xl"
        >
          {sections.map((section, i) => (
            <div key={i}>
              {i > 0 && <DropdownMenu.Separator className="my-1.5 h-px bg-zinc-100" />}
              {section.label && (
                <p className="px-3 pb-1 pt-2 text-[11px] font-black uppercase tracking-wider text-zinc-400">
                  {section.label}
                </p>
              )}
              {section.items.map((item) => (
                <DropdownMenu.Item key={item.href} asChild>
                  <Link
                    href={item.href}
                    className="block cursor-pointer rounded-xl px-3 py-2 text-sm font-bold text-zinc-700 outline-none transition hover:bg-zinc-50 hover:text-brand-700"
                  >
                    {item.label}
                  </Link>
                </DropdownMenu.Item>
              ))}
            </div>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MobileDropdownSection({ title, links, onLinkClick }: { title: string; links: DropdownLink[]; onLinkClick: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-zinc-100 pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 pb-1 text-[11px] font-black uppercase tracking-wider text-zinc-400"
      >
        {title}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")} />
      </button>
      <div
        className={cn(
          "grid overflow-hidden transition-all duration-200 ease-in-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="grid gap-1 pt-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={onLinkClick}
                className="rounded-lg px-3 py-2 text-sm font-bold text-zinc-700 transition hover:bg-zinc-50 hover:text-brand-700"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [account, setAccount] = useState<Account | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const accountRef = useRef<HTMLDivElement>(null);

  function accountFromUser(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null | undefined) {
    if (!user?.email) return null;
    const displayName =
      typeof user.user_metadata?.display_name === "string" && user.user_metadata.display_name.trim()
        ? user.user_metadata.display_name.trim()
        : user.email.split("@")[0];
    return { id: user.id, displayName };
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

  // Live category list for the Discover dropdown — same source as the homepage's category pills.
  useEffect(() => {
    supabase
      .from("homepage_categories")
      .select("name")
      .eq("is_visible", true)
      .order("position", { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) setCategories(data.map((c) => c.name));
      });
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await supabase.auth.signOut();
    setAccountOpen(false);
    router.push("/login");
    router.refresh();
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
    setSearchOpen(false);
  }

  const accountName = account?.displayName ?? "";
  const initials = accountName ? accountName.slice(0, 2).toUpperCase() : "";

  const categoryLinks: DropdownLink[] = categories.map((name) => ({
    label: name,
    href: `/fundraisers?categories=${encodeURIComponent(name)}`,
  }));

  const discoverSections: DropdownSection[] = [
    { items: DISCOVER_TOP_LINKS },
    ...(categoryLinks.length > 0 ? [{ label: "Categories", items: categoryLinks }] : []),
    { items: DISCOVER_BOTTOM_LINKS },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 md:gap-4 md:px-6">
        <Link
          href="/"
          prefetch={pathname.startsWith("/admin") ? false : undefined}
          className="shrink-0 text-zinc-950"
        >
          <BrandMark textClassName="hidden sm:inline text-zinc-950" />
        </Link>

        {/* Desktop search */}
        <form onSubmit={submitSearch} className="hidden min-w-0 flex-1 md:block lg:max-w-md xl:max-w-lg">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search fundraisers, organizers…"
              className="h-10 w-full rounded-full border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-sm font-semibold outline-none transition focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-600/20"
            />
          </label>
        </form>

        {/* Desktop nav dropdowns */}
        <nav className="hidden items-center gap-1 lg:flex">
          <NavDropdown label="Discover" sections={discoverSections} />
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Mobile search toggle */}
          <button
            type="button"
            onClick={() => setSearchOpen((o) => !o)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 transition hover:border-brand-200 hover:text-brand-700 md:hidden"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </button>

          {/* Notifications */}
          {account && <NotificationBell userId={account.id} />}

          {account ? (
            <div className="relative" ref={accountRef}>
              <button
                type="button"
                onClick={() => setAccountOpen((o) => !o)}
                className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white py-1.5 pl-1.5 pr-3 transition hover:border-brand-200"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-xs font-black text-white">
                  {initials}
                </span>
                <span className="hidden max-w-24 truncate text-sm font-bold text-zinc-800 xl:inline">
                  {accountName}
                </span>
                <ChevronDown className={cn("hidden h-4 w-4 text-zinc-400 xl:block", accountOpen && "rotate-180")} />
              </button>
              {accountOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-zinc-200 bg-white py-2 shadow-xl">
                  <p className="truncate px-4 py-2 text-sm font-black text-zinc-900">{accountName}</p>
                  <div className="my-1 border-t border-zinc-100" />
                  <Link href="/dashboard" className="block px-4 py-2 text-sm font-bold text-zinc-700 hover:bg-zinc-50 hover:text-brand-700">
                    Dashboard
                  </Link>
                  <Link href="/dashboard/settings/profile" className="block px-4 py-2 text-sm font-bold text-zinc-700 hover:bg-zinc-50 hover:text-brand-700">
                    Account settings
                  </Link>
                  <div className="my-1 border-t border-zinc-100" />
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="block w-full px-4 py-2 text-left text-sm font-bold text-red-600 hover:bg-red-50"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-bold text-zinc-700 hover:text-brand-700">
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-black text-white transition hover:bg-zinc-800"
              >
                Sign up
              </Link>
            </div>
          )}

          {/* Mobile menu */}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 text-zinc-800 lg:hidden"
            aria-expanded={menuOpen}
            aria-label="Toggle navigation"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile search panel */}
      {searchOpen && (
        <div className="border-t border-zinc-100 px-4 py-3 md:hidden">
          <form onSubmit={submitSearch} className="flex gap-2">
            <input
              type="search"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search…"
              className="h-10 min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 text-sm font-semibold outline-none focus:border-brand-600"
            />
            <button type="submit" className="rounded-xl bg-brand-700 px-4 text-sm font-black text-white">
              Go
            </button>
          </form>
        </div>
      )}

      {/* Mobile menu panel */}
      {menuOpen && (
        <div className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-zinc-200 bg-white px-4 py-4 lg:hidden">
          <nav className="grid gap-1">
            <NavLink href="/" label="Home" active={pathname === "/"} onClick={() => setMenuOpen(false)} />
          </nav>

          <MobileDropdownSection
            title="Discover"
            links={[...DISCOVER_TOP_LINKS, ...categoryLinks, ...DISCOVER_BOTTOM_LINKS]}
            onLinkClick={() => setMenuOpen(false)}
          />

          {account ? (
            <div className="grid gap-1 border-t border-zinc-100 pt-4 mt-3">
              <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-bold text-zinc-700 hover:bg-zinc-50">
                Dashboard
              </Link>
              <button type="button" onClick={handleLogout} className="rounded-lg px-3 py-2.5 text-left text-sm font-bold text-red-600 hover:bg-red-50">
                Log out
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 border-t border-zinc-100 pt-4 mt-3">
              <Link href="/login" onClick={() => setMenuOpen(false)} className="rounded-xl bg-zinc-100 py-3 text-center text-sm font-bold">
                Log in
              </Link>
              <Link href="/signup" onClick={() => setMenuOpen(false)} className="rounded-xl bg-brand-700 py-3 text-center text-sm font-black text-white">
                Sign up
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
