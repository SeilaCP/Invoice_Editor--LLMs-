import Link from "next/link";

const cards = [
  {
    href: "/upload",
    title: "Upload Center",
    description:
      "Upload DOCX or PDF files to extract data and store documents.",
    accent: "from-emerald-600 via-teal-600 to-cyan-600",
  },
  {
    href: "/templates",
    title: "Template Search & Fill",
    description:
      "Describe what you need, find the best-matching uploaded template, and fill it with AI.",
    accent: "from-indigo-600 via-purple-600 to-fuchsia-600",
  },
] as const;

export default function Page() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-16">
        <div className="mb-10 max-w-2xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            AI Document Workspace
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
            Choose the workflow you want to open.
          </h1>
          <p className="mt-5 text-base leading-7 text-muted-foreground sm:text-lg">
            Use chat to generate documents conversationally, or go straight to
            file upload for DOCX and PDF processing.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {cards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group relative overflow-hidden rounded-3xl border border-border bg-background/80 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur transition-transform duration-200 hover:-translate-y-1 hover:shadow-[0_24px_80px_rgba(15,23,42,0.14)]"
            >
              <div
                className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${card.accent}`}
              />
              <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-xl font-semibold text-foreground">
                {card.title.slice(0, 1)}
              </div>
              <h2 className="text-2xl font-semibold text-foreground">
                {card.title}
              </h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                {card.description}
              </p>
              <div className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-foreground transition-transform group-hover:translate-x-1">
                Open route
                <span aria-hidden="true">→</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
