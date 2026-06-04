import Link from "next/link";
import BrandMark from "@/components/BrandMark";

export default function Footer() {
  return (
    <footer id="contact" className="bg-[#1f0a3d] text-white">

      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 px-6 py-10 md:flex-row">

        <div>

          <h2 className="text-2xl text-orange-400">
            <BrandMark textClassName="text-orange-400" />
          </h2>

          <p className="mt-2 text-sm text-violet-100">
            Events, fundraising & community commerce.
          </p>

        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-sm font-semibold text-violet-100">

          <Link href="/about" className="hover:text-orange-300">About</Link>
          <Link href="/events" className="hover:text-orange-300">Events</Link>
          <Link href="/fundraisers" className="hover:text-orange-300">Fundraisers</Link>
          <Link href="/create-event" className="hover:text-orange-300">Create Event</Link>
          <Link href="/create-fundraiser" className="hover:text-orange-300">Start Fundraiser</Link>
          <Link href="/privacy" className="hover:text-orange-300">Privacy</Link>
          <a href="mailto:support@eventbrithe.com" className="hover:text-orange-300">Contact</a>

        </nav>

      </div>

      <div className="border-t border-white/10 px-6 py-5">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-sm text-violet-100 md:flex-row">
          <p>© 2026 EventBrithe</p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <Link href="/login" className="hover:text-orange-300">Log in</Link>
            <Link href="/signup" className="hover:text-orange-300">Sign up</Link>
            <Link href="/dashboard" className="hover:text-orange-300">Dashboard</Link>
            <Link href="/privacy" className="hover:text-orange-300">Privacy</Link>
          </div>
        </div>
      </div>

    </footer>
  );
}
