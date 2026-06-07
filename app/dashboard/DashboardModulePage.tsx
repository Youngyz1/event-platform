import Link from "next/link";

type Action = {
  href: string;
  label: string;
  primary?: boolean;
};

export default function DashboardModulePage({
  eyebrow,
  title,
  description,
  actions,
  items,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions: Action[];
  items: string[];
}) {
  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-10 text-zinc-950 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-5xl rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-black uppercase tracking-wide text-orange-600">{eyebrow}</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-zinc-600">{description}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={`rounded-xl px-5 py-3 text-sm font-black transition ${
                action.primary
                  ? "bg-orange-600 text-white hover:bg-orange-700"
                  : "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
              }`}
            >
              {action.label}
            </Link>
          ))}
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <div key={item} className="rounded-2xl bg-zinc-50 p-5 ring-1 ring-zinc-200">
              <p className="font-black">{item}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
