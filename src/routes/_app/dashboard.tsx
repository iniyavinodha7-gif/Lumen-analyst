import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, BarChart3, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PlotlyChart } from "@/components/PlotlyChart";
import { Button } from "@/components/ui/button";
import { deriveKpis, useWorkspace } from "@/lib/workspace";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Executive Dashboard · Lumen" },
      {
        name: "description",
        content:
          "KPIs, pinned charts and data-quality signals calculated from your own uploaded business dataset.",
      },
      { property: "og:title", content: "Executive Dashboard · Lumen" },
      {
        property: "og:description",
        content: "KPIs and pinned insights computed from your own business data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

type Pin = { id: string; title: string; note: string | null; chart_json: unknown };

function Dashboard() {
  const [pins, setPins] = useState<Pin[]>([]);
  const { activeDataset } = useWorkspace();
  const kpis = deriveKpis(activeDataset);

  const load = async () => {
    const { data } = await supabase
      .from("pinned_charts")
      .select("id,title,note,chart_json")
      .order("created_at", { ascending: false });
    setPins((data as Pin[]) ?? []);
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="h-full overflow-y-auto px-6 py-8">
      <h1 className="font-display text-2xl font-bold">Executive dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {activeDataset
          ? `KPIs computed from ${activeDataset.profile.filename}, plus the charts you pinned from your analyses.`
          : "Charts you pinned from your analyses. Upload a dataset in a chat to see live KPIs here."}
      </p>

      {kpis.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <BarChart3 className="size-3.5" /> Metrics available in this dataset
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="panel p-4">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="mt-1 font-display text-2xl font-bold">{k.value}</p>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">{k.hint}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Only metrics that can actually be derived from the uploaded columns are shown. Ask in
            chat for exact, Python-verified breakdowns.
          </p>
        </section>
      )}

      {activeDataset && activeDataset.profile.smells.length > 0 && (
        <section className="panel mt-6 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="size-4 text-warning" /> Anomalies &amp; data risks
          </h2>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {activeDataset.profile.smells.map((s) => (
              <li key={s}>• {s}</li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Pinned insights
      </h2>

      {pins.length === 0 ? (
        <div className="panel mt-3 p-8 text-center text-sm text-muted-foreground">
          Nothing pinned yet — pin a chart from any chat to build your dashboard.
        </div>
      ) : (
        <div className="mt-3 grid gap-4 xl:grid-cols-2">
          {pins.map((p) => (
            <article key={p.id} className="panel p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-display font-semibold">{p.title}</h3>
                  {p.note && <p className="mt-1 text-xs text-muted-foreground">{p.note}</p>}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Remove pinned chart"
                  onClick={async () => {
                    await supabase.from("pinned_charts").delete().eq("id", p.id);
                    void load();
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="mt-3">
                <PlotlyChart spec={p.chart_json as never} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
