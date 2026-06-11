import { supabase } from "@/lib/supabase";
import Link from "next/link";
import Footer from "@/components/Footer";
import { CallToAction } from "@/components/ui/call-to-action";

export default async function OrganizersDirectoryPage() {
  // Fetch all organizers
  const { data: organizers, error } = await supabase
    .from("organizers")
    .select("*")
    .eq("visibility", "public")
    .order("name", { ascending: true });

  return (
    <main className="min-h-screen bg-zinc-50 text-black flex flex-col justify-between">
      <div>
         

        {/* HERO HEADER */}
        <section className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-600 text-white py-20 px-6 shadow-md">
          <div className="max-w-6xl mx-auto text-center md:text-left">
            <span className="bg-white/20 text-white text-xs font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider backdrop-blur-md">
              Directory
            </span>
            <h1 className="text-5xl md:text-6xl font-black mt-6 tracking-tight leading-none">
              Meet Our Organizers
            </h1>
            <p className="text-white/80 mt-4 text-lg md:text-xl max-w-2xl font-medium leading-relaxed">
              Discover the creative minds, visionaries, and community leaders hosting the most exciting events and fundraisers.
            </p>
          </div>
        </section>

        {/* ORGANIZERS GRID */}
        <section className="max-w-6xl mx-auto px-6 py-16">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-5 py-4 rounded-2xl mb-8">
              Failed to load organizers. Please try again later.
            </div>
          )}

          {organizers && organizers.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {organizers.map((org) => (
                <div
                  key={org.id}
                  className="bg-white rounded-3xl overflow-hidden border border-zinc-200 hover:border-orange-500 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 flex flex-col justify-between"
                >
                  {/* Banner Image Placeholder/Aesthetic */}
                  <div className="h-28 bg-gradient-to-br from-zinc-100 to-zinc-200 relative">
                    {org.banner && (
                      <img
                        src={org.banner}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-white/30 to-transparent" />
                  </div>

                  <div className="px-6 pb-6 relative flex-1 flex flex-col justify-between">
                    {/* Photo / Avatar */}
                    <div className="-mt-12 mb-4 relative z-10">
                      <div className="w-20 h-20 rounded-full border-4 border-white bg-zinc-200 shadow-md overflow-hidden flex items-center justify-center mx-auto sm:mx-0">
                        {org.photo ? (
                          <img
                            src={org.photo}
                            alt={org.name}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-3xl font-black text-zinc-400">
                            {org.name?.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="text-center sm:text-left flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="text-2xl font-bold text-zinc-900 line-clamp-1">
                          {org.name}
                        </h3>
                        <p className="text-zinc-600 mt-2 text-sm line-clamp-3 min-h-[3rem]">
                          {org.bio || "No bio provided."}
                        </p>
                      </div>

                      {/* Socials / Links */}
                      <div className="flex gap-3 mt-5 justify-center sm:justify-start">
                        {org.facebook && (
                          <a
                            href={org.facebook}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-orange-100 hover:text-orange-600 flex items-center justify-center text-zinc-500 transition-colors"
                          >
                            <span className="font-bold text-xs">f</span>
                          </a>
                        )}
                        {org.twitter && (
                          <a
                            href={org.twitter}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-orange-100 hover:text-orange-600 flex items-center justify-center text-zinc-500 transition-colors"
                          >
                            <span className="font-bold text-xs">𝕏</span>
                          </a>
                        )}
                        {org.website && (
                          <a
                            href={org.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-orange-100 hover:text-orange-600 flex items-center justify-center text-zinc-500 transition-colors"
                          >
                            <span className="text-xs">🌐</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="mt-6 pt-4 border-t border-zinc-100">
                      <Link
                        href={`/organizers/${org.id}`}
                        className="block w-full text-center bg-zinc-900 hover:bg-orange-500 text-white font-bold py-3 rounded-2xl transition-all duration-300 shadow-sm"
                      >
                        View Profile
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-3xl p-16 text-center shadow-sm">
              <p className="text-zinc-500 text-lg">No organizers registered yet.</p>
              <Link
                href="/create-organizer"
                className="mt-6 inline-block bg-orange-500 hover:bg-orange-600 text-white font-bold px-8 py-4 rounded-full transition shadow"
              >
                Become an Organizer
              </Link>
            </div>
          )}
        </section>

        {/* CTA banner — below the grid */}
        <section className="pb-16 px-6 flex justify-center">
          <CallToAction
            headline="Ready to host your next big event?"
            subtext="Create events, run fundraisers, and grow your audience — all in one platform."
            ctaLabel="Become an Organizer"
            ctaHref="/create-organizer"
            memberCount="1,200+ organizers"
          />
        </section>
      </div>

      <Footer />
    </main>
  );
}
