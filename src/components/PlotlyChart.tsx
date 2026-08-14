import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/lib/theme";

const PLOTLY_URL = "https://cdn.plot.ly/plotly-2.35.2.min.js";

type PlotlyGlobal = {
  react: (el: HTMLElement, data: unknown, layout: unknown, config: unknown) => Promise<void>;
  Plots: { resize: (el: HTMLElement) => void };
  purge: (el: HTMLElement) => void;
};

declare global {
  interface Window {
    Plotly?: PlotlyGlobal;
  }
}

let plotlyPromise: Promise<PlotlyGlobal> | null = null;

function loadPlotly() {
  if (!plotlyPromise) {
    plotlyPromise = new Promise<PlotlyGlobal>((resolve, reject) => {
      if (window.Plotly) return resolve(window.Plotly);
      const el = document.createElement("script");
      el.src = PLOTLY_URL;
      el.onload = () => resolve(window.Plotly!);
      el.onerror = () => reject(new Error("Failed to load Plotly"));
      document.head.appendChild(el);
    });
  }
  return plotlyPromise;
}

export type ChartSpec = {
  data?: unknown[];
  layout?: Record<string, unknown>;
  [key: string]: unknown;
};

export function PlotlyChart({ spec, height = 340 }: { spec: ChartSpec; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { resolved } = useTheme();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const node = ref.current;
    if (!node) return;
    loadPlotly()
      .then((Plotly) => {
        if (cancelled || !node) return;
        const dark = resolved === "dark";
        const layout = {
          ...(spec.layout ?? {}),
          height,
          margin: { l: 56, r: 20, t: 40, b: 56 },
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
          font: { color: dark ? "#dbe6ea" : "#22333d", family: "DM Sans, sans-serif" },
          colorway: dark
            ? ["#5ed6c8", "#7bd88f", "#f0c274", "#f19a7c", "#9db4ff"]
            : ["#199e93", "#3aa46b", "#c8912f", "#c96a45", "#5c6fc9"],
          xaxis: {
            gridcolor: dark ? "#2c3a44" : "#e3eaee",
            ...((spec.layout?.["xaxis"] as Record<string, unknown>) ?? {}),
          },
          yaxis: {
            gridcolor: dark ? "#2c3a44" : "#e3eaee",
            ...((spec.layout?.["yaxis"] as Record<string, unknown>) ?? {}),
          },
        };
        return Plotly.react(node, spec.data ?? [], layout, {
          displayModeBar: true,
          responsive: true,
          displaylogo: false,
        });
      })
      .catch((e: Error) => setError(e.message));
    return () => {
      cancelled = true;
      if (node && window.Plotly) window.Plotly.purge(node);
    };
  }, [spec, resolved, height]);

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }
  return <div ref={ref} className="w-full" style={{ minHeight: height }} />;
}
