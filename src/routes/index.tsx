import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Braces,
  Mic,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lumen — Chat with your data, get real answers" },
      {
        name: "description",
        content:
          "Lumen is a conversational data analyst: upload a CSV, ask questions in plain language or by voice, and get Python-verified numbers and interactive charts.",
      },
      { property: "og:title", content: "Lumen — Chat with your data, get real answers" },
      {
        property: "og:description",
        content:
          "Upload a dataset, ask in plain language, and get Python-verified analysis with interactive Plotly charts.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: TerminalSquare,
    title: "Numbers come from Python",
    body: "Every figure is computed by pandas running in your browser through Pyodide — never guessed by the model.",
  },
  {
    icon: BarChart3,
    title: "Interactive Plotly charts",
    body: "Charts arrive as specifications you can zoom, hover and reshape conversationally: 'make it stacked', 'group by month'.",
  },
  {
    icon: Sparkles,
    title: "Zero-click profiling",
    body: "Drop a file and get shape, dtypes, quality score, missing values, correlations and data smells instantly.",
  },
  {
    icon: Mic,
    title: "Voice composer",
    body: "Dictate a question with pause, resume and stop. The transcript lands in the box so you can edit before sending.",
  },
  {
    icon: Braces,
    title: "Show your work",
    body: "Inspect the generated Python for any answer and export the whole conversation as a Jupyter notebook.",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    body: "Your rows stay in the browser. Only schema summaries reach the model, and keys never leave the server.",
  },
];

function Landing() {
  const { session } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Bot className="size-4" />
          </span>
          Lumen
        </Link>
        <nav className="flex items-center gap-2">
          {session ? (
            <Button asChild>
              <Link to="/chat">Open workspace</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link to="/auth" search={{ mode: "login" }}>
                  Log in
                </Link>
              </Button>
              <Button asChild>
                <Link to="/auth" search={{ mode: "signup" }}>
                  Get started
                </Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="hero-surface border-b border-border">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 pb-20 pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
                <Sparkles className="size-3.5 text-primary" />
                Conversational Data Analyst
              </p>
              <h1 className="mt-6 text-balance font-display text-5xl font-bold leading-[1.05] md:text-6xl">
                Talk to your dataset.
                <span className="brand-text"> Get answers that actually compute.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-muted-foreground">
                Upload a CSV, Excel or JSON file and ask questions the way you'd ask a colleague.
                Lumen writes the pandas, runs it in your browser, verifies the result and explains it
                in your own terms.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button size="lg" asChild>
                  <Link to="/auth" search={{ mode: "signup" }}>
                    Start analysing
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/auth" search={{ mode: "login" }}>
                    I already have an account
                  </Link>
                </Button>
              </div>
              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 text-sm">
                {[
                  ["In-browser", "Python execution"],
                  ["Verified", "numerical claims"],
                  [".ipynb", "conversation export"],
                ].map(([a, b]) => (
                  <div key={a} className="rounded-lg border border-border bg-surface/70 p-3">
                    <dt className="font-display font-semibold">{a}</dt>
                    <dd className="text-muted-foreground">{b}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="panel overflow-hidden p-0">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <span className="size-2.5 rounded-full bg-destructive/70" />
                <span className="size-2.5 rounded-full bg-warning/70" />
                <span className="size-2.5 rounded-full bg-success/70" />
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  startup_funding.csv · 12,438 rows
                </span>
              </div>
              <div className="space-y-4 p-5 text-sm">
                <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-primary-foreground">
                  Show me the top 10 industries by funding
                </div>
                <div className="max-w-[92%] space-y-3 rounded-2xl rounded-bl-sm bg-secondary px-4 py-3">
                  <p className="text-secondary-foreground">
                    Fintech leads with <strong>$4.21B</strong> across 812 rounds, followed by
                    Consumer Internet and SaaS.
                  </p>
                  <div className="flex items-end gap-1.5 rounded-lg bg-surface p-3">
                    {[92, 74, 61, 55, 43, 38, 31, 26, 19, 12].map((h, i) => (
                      <span
                        key={i}
                        className="w-full rounded-sm bg-primary/80"
                        style={{ height: `${h}px` }}
                      />
                    ))}
                  </div>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    ✓ Calculated via Python · groupby("industry").sum()
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 py-20">
          <h2 className="max-w-2xl font-display text-3xl font-bold md:text-4xl">
            Built like a real analysis tool, not a chatbot wrapper
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <article key={f.title} className="panel p-5">
                <f.icon className="size-5 text-primary" />
                <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-border bg-surface-2">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-4 px-6 py-16 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold">Ready to interrogate your data?</h2>
              <p className="mt-1 text-muted-foreground">
                Create an account, tell us how you work, and upload your first file.
              </p>
            </div>
            <Button size="lg" asChild>
              <Link to="/auth" search={{ mode: "signup" }}>
                Create free account
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        Lumen · Conversational Data Analyst
      </footer>
    </div>
  );
}
