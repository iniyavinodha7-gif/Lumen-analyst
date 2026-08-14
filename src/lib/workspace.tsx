import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { DatasetProfile } from "@/lib/pyodide";

export type DatasetState = {
  profile: DatasetProfile;
  summary: string;
  chips: string[];
};

type WorkspaceValue = {
  /** Dataset of the conversation that most recently loaded data into the Python runtime. */
  activeDataset: DatasetState | null;
  activeConversationId: string | null;
  /** Dataset scoped to one conversation — a new chat never inherits another chat's data. */
  datasetFor: (conversationId: string) => DatasetState | null;
  setDatasetFor: (conversationId: string, dataset: DatasetState | null) => void;
  runtimeStatus: string;
  setRuntimeStatus: (s: string) => void;
};

const WorkspaceContext = createContext<WorkspaceValue>({
  activeDataset: null,
  activeConversationId: null,
  datasetFor: () => null,
  setDatasetFor: () => {},
  runtimeStatus: "",
  setRuntimeStatus: () => {},
});

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [datasets, setDatasets] = useState<Record<string, DatasetState>>({});
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState("");

  const setDatasetFor = useCallback((conversationId: string, dataset: DatasetState | null) => {
    setDatasets((prev) => {
      const next = { ...prev };
      if (dataset) next[conversationId] = dataset;
      else delete next[conversationId];
      return next;
    });
    setActiveConversationId(dataset ? conversationId : null);
  }, []);

  const datasetFor = useCallback(
    (conversationId: string) => datasets[conversationId] ?? null,
    [datasets],
  );

  const value = useMemo(
    () => ({
      activeDataset: activeConversationId ? (datasets[activeConversationId] ?? null) : null,
      activeConversationId,
      datasetFor,
      setDatasetFor,
      runtimeStatus,
      setRuntimeStatus,
    }),
    [activeConversationId, datasetFor, datasets, runtimeStatus, setDatasetFor],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

export function datasetContextString(dataset: DatasetState | null): string {
  if (!dataset) return "";
  const p = dataset.profile;
  const cols = p.columns
    .map((c) => `- ${c.name} (${c.dtype}, ${c.kind}, missing ${c.missing}, unique ${c.unique})`)
    .join("\n");
  return `File: ${p.filename}\nRows: ${p.rows}\nColumns (${p.columns.length}):\n${cols}\nDuplicate rows: ${p.duplicates}\nSample rows: ${JSON.stringify(p.sample.slice(0, 3))}`;
}

/* ---------- Business KPI derivation (real numbers from the profiled dataset only) ---------- */

export type Kpi = { label: string; value: string; hint: string };

const MATCHERS: { keys: string[]; label: string; agg: "sum" | "mean" | "count" }[] = [
  { keys: ["revenue", "sales_amount", "total_sales", "sales", "turnover"], label: "Revenue", agg: "sum" },
  { keys: ["profit", "net_income", "earnings"], label: "Profit", agg: "sum" },
  { keys: ["salary", "compensation", "ctc", "pay"], label: "Avg Salary", agg: "mean" },
  { keys: ["quantity", "units", "qty", "stock"], label: "Units", agg: "sum" },
  { keys: ["order_value", "amount", "price"], label: "Avg Value", agg: "mean" },
  { keys: ["spend", "cost", "expense"], label: "Total Cost", agg: "sum" },
];

const COUNTERS: { keys: string[]; label: string }[] = [
  { keys: ["customer", "client", "account"], label: "Customers" },
  { keys: ["order", "invoice", "transaction"], label: "Orders" },
  { keys: ["employee", "emp_id", "staff"], label: "Employees" },
  { keys: ["product", "sku", "item"], label: "Products" },
  { keys: ["campaign"], label: "Campaigns" },
];

function fmt(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return abs >= 100 ? n.toFixed(0) : n.toFixed(2);
}

export function deriveKpis(dataset: DatasetState | null): Kpi[] {
  if (!dataset) return [];
  const p = dataset.profile;
  const kpis: Kpi[] = [
    { label: "Rows", value: p.rows.toLocaleString(), hint: `${p.columns.length} columns` },
    { label: "Data quality", value: `${p.qualityScore}/100`, hint: `${p.missingTotal} missing · ${p.duplicates} dupes` },
  ];

  const used = new Set<string>();
  let revenue: number | null = null;
  let profit: number | null = null;

  for (const m of MATCHERS) {
    const col = Object.keys(p.numericSummary).find(
      (c) => !used.has(c) && m.keys.some((k) => c.toLowerCase().includes(k)),
    );
    if (!col) continue;
    const stats = p.numericSummary[col];
    const count = stats?.["count"];
    const mean = stats?.["mean"];
    if (count == null || mean == null) continue;
    used.add(col);
    const total = count * mean;
    if (m.label === "Revenue") revenue = total;
    if (m.label === "Profit") profit = total;
    kpis.push({
      label: m.label,
      value: fmt(m.agg === "sum" ? total : mean),
      hint: `${m.agg === "sum" ? "sum" : "average"} of ${col}`,
    });
  }

  if (revenue && profit != null) {
    kpis.push({
      label: "Profit margin",
      value: `${((profit / revenue) * 100).toFixed(1)}%`,
      hint: "profit ÷ revenue",
    });
  }

  for (const c of COUNTERS) {
    const col = p.columns.find((x) => c.keys.some((k) => x.name.toLowerCase().includes(k)));
    if (!col) continue;
    kpis.push({ label: `${c.label} (unique)`, value: col.unique.toLocaleString(), hint: col.name });
  }

  return kpis.slice(0, 8);
}
