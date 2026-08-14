import { AlertTriangle, Database, Table2, Upload } from "lucide-react";
import { useRef } from "react";
import type { DatasetState } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DataPanel({
  dataset,
  onUpload,
}: {
  dataset: DatasetState | null;
  onUpload: (file: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex h-full flex-col overflow-y-auto border-l border-border bg-surface-2/60">
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.tsv,.txt,.json,.xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = "";
        }}
      />
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
          <Database className="size-4 text-primary" /> Data context
        </h2>
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload className="size-3.5" /> {dataset ? "Replace" : "Upload"}
        </Button>
      </div>

      {!dataset ? (
        <div className="p-4 text-sm text-muted-foreground">
          No dataset loaded. Upload a CSV, TSV, JSON or Excel file to unlock profiling, charts and
          Python-verified answers.
        </div>
      ) : (
        <div className="space-y-5 p-4 text-sm">
          <div>
            <p className="truncate font-medium">{dataset.profile.filename}</p>
            <p className="text-xs text-muted-foreground">
              {dataset.profile.rows.toLocaleString()} rows · {dataset.profile.columns.length} columns
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Quality" value={`${dataset.profile.qualityScore}`} accent />
            <Stat label="Missing" value={dataset.profile.missingTotal.toLocaleString()} />
            <Stat label="Dupes" value={dataset.profile.duplicates.toLocaleString()} />
          </div>

          {dataset.profile.smells.length > 0 && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-warning-foreground">
                <AlertTriangle className="size-3.5" /> Data smells
              </p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {dataset.profile.smells.map((s) => (
                  <li key={s}>• {s}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Table2 className="size-3.5" /> Schema
            </p>
            <ul className="space-y-1">
              {dataset.profile.columns.map((c) => (
                <li
                  key={c.name}
                  className="flex items-center justify-between gap-2 rounded-md bg-surface px-2 py-1.5"
                >
                  <span className="truncate font-mono text-xs">{c.name}</span>
                  <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase text-secondary-foreground">
                    {c.kind}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {dataset.profile.correlations.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Strongest correlations
              </p>
              <ul className="space-y-1 text-xs">
                {dataset.profile.correlations.slice(0, 5).map((c) => (
                  <li key={`${c.a}-${c.b}`} className="flex justify-between gap-2">
                    <span className="truncate font-mono">
                      {c.a} ↔ {c.b}
                    </span>
                    <span className={cn(c.r > 0 ? "text-success" : "text-destructive")}>
                      {c.r.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-2">
      <p className={cn("font-display text-lg font-bold", accent && "text-primary")}>{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
