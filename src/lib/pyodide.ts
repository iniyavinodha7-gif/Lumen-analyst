/* Browser-side Python execution powered by Pyodide (WebAssembly).
   No user Python is ever executed on the server. */

const PYODIDE_VERSION = "0.26.4";
const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.js`;

type PyodideAPI = {
  runPythonAsync: (code: string) => Promise<unknown>;
  loadPackage: (names: string[]) => Promise<void>;
  globals: { set: (k: string, v: unknown) => void; get: (k: string) => unknown };
  FS: { writeFile: (path: string, data: Uint8Array) => void };
};

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideAPI>;
  }
}

let pyodidePromise: Promise<PyodideAPI> | null = null;

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const el = document.createElement("script");
    el.src = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error("Failed to load Pyodide runtime"));
    document.head.appendChild(el);
  });
}

export function getPyodide(onStatus?: (s: string) => void): Promise<PyodideAPI> {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      onStatus?.("Downloading Python runtime…");
      await loadScript(PYODIDE_URL);
      const py = await window.loadPyodide!({
        indexURL: `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`,
      });
      onStatus?.("Loading pandas, numpy, scikit-learn…");
      await py.loadPackage(["pandas", "numpy", "scikit-learn"]);
      onStatus?.("Ready");
      return py;
    })();
  }
  return pyodidePromise;
}

export type ExecResult = {
  ok: boolean;
  stdout: string;
  result: string;
  chart: unknown | null;
  table: { columns: string[]; rows: unknown[][] } | null;
  error?: string;
};

const RUNNER = `
import json, io, contextlib, traceback
import pandas as pd, numpy as np

def __cda_run(code):
    buf = io.StringIO()
    env = {"df": globals().get("df"), "pd": pd, "np": np, "datasets": globals().get("datasets", {})}
    out = {"ok": True, "stdout": "", "result": "", "chart": None, "table": None}
    try:
        with contextlib.redirect_stdout(buf):
            exec(code, env)
        globals()["df"] = env.get("df")
        res = env.get("result")
        if isinstance(res, pd.DataFrame):
            head = res.head(50)
            out["table"] = {
                "columns": [str(c) for c in head.columns],
                "rows": json.loads(head.to_json(orient="values", date_format="iso")),
            }
            out["result"] = head.to_string()
        elif isinstance(res, pd.Series):
            head = res.head(50)
            out["table"] = {
                "columns": [str(head.index.name or "index"), str(head.name or "value")],
                "rows": [[str(i), (None if pd.isna(v) else (v.item() if hasattr(v, "item") else v))] for i, v in head.items()],
            }
            out["result"] = head.to_string()
        elif res is not None:
            out["result"] = str(res)
        chart = env.get("chart")
        if chart is not None:
            out["chart"] = json.loads(json.dumps(chart, default=str))
        out["stdout"] = buf.getvalue()[:4000]
    except Exception:
        out["ok"] = False
        out["stdout"] = buf.getvalue()[:2000]
        out["error"] = traceback.format_exc(limit=2)[-1500:]
    return json.dumps(out, default=str)
`;

let runnerReady = false;

export async function runPython(code: string, onStatus?: (s: string) => void): Promise<ExecResult> {
  const py = await getPyodide(onStatus);
  if (!runnerReady) {
    await py.runPythonAsync(RUNNER);
    runnerReady = true;
  }
  py.globals.set("__cda_code", code);
  const raw = (await py.runPythonAsync("__cda_run(__cda_code)")) as string;
  return JSON.parse(raw) as ExecResult;
}

export type DatasetProfile = {
  filename: string;
  rows: number;
  columns: { name: string; dtype: string; kind: string; missing: number; unique: number }[];
  sample: Record<string, unknown>[];
  duplicates: number;
  missingTotal: number;
  qualityScore: number;
  numericSummary: Record<string, Record<string, number>>;
  correlations: { a: string; b: string; r: number }[];
  smells: string[];
};

const LOADER = (filename: string) => `
import pandas as pd, numpy as np, json
name = ${JSON.stringify(filename)}
low = name.lower()
if low.endswith(".csv") or low.endswith(".tsv") or low.endswith(".txt"):
    sep = "\\t" if low.endswith(".tsv") else ","
    df = pd.read_csv("/data/" + name, sep=sep)
elif low.endswith(".json"):
    df = pd.read_json("/data/" + name)
else:
    df = pd.read_excel("/data/" + name)

def kind_of(s):
    if pd.api.types.is_datetime64_any_dtype(s): return "datetime"
    if pd.api.types.is_numeric_dtype(s):
        return "id-like" if s.is_unique and s.dropna().size > 10 else "numeric"
    nun = s.nunique(dropna=True)
    if nun == len(s) and len(s) > 10: return "id-like"
    if nun <= max(20, len(s) * 0.05): return "categorical"
    return "text"

cols = []
for c in df.columns:
    s = df[c]
    cols.append({"name": str(c), "dtype": str(s.dtype), "kind": kind_of(s),
                 "missing": int(s.isna().sum()), "unique": int(s.nunique(dropna=True))})

num = df.select_dtypes(include=[np.number])
corrs = []
if num.shape[1] > 1:
    cm = num.corr(numeric_only=True)
    seen = set()
    for a in cm.columns:
        for b in cm.columns:
            if a == b or (b, a) in seen: continue
            seen.add((a, b))
            v = cm.loc[a, b]
            if pd.notna(v) and abs(v) >= 0.5:
                corrs.append({"a": str(a), "b": str(b), "r": round(float(v), 3)})
corrs = sorted(corrs, key=lambda x: -abs(x["r"]))[:6]

missing_total = int(df.isna().sum().sum())
dups = int(df.duplicated().sum())
cells = max(df.shape[0] * df.shape[1], 1)
score = 100 - (missing_total / cells) * 60 - (dups / max(len(df), 1)) * 25
inf_count = int(np.isinf(num.to_numpy(dtype="float64", na_value=np.nan)).sum()) if num.shape[1] else 0
score -= min(inf_count, 50) * 0.2
smells = []
if dups: smells.append(f"{dups} duplicate rows detected")
if inf_count: smells.append(f"{inf_count} infinite values detected")
for c in cols:
    if c["missing"] > len(df) * 0.3:
        smells.append(f"Column '{c['name']}' is {round(c['missing']/max(len(df),1)*100)}% missing")
for c in num.columns:
    s = num[c].dropna()
    if len(s) > 20:
        q1, q3 = s.quantile(0.25), s.quantile(0.75)
        iqr = q3 - q1
        if iqr > 0:
            out = int(((s < q1 - 3 * iqr) | (s > q3 + 3 * iqr)).sum())
            if out: smells.append(f"{out} extreme outliers in '{c}'")
for c in df.columns:
    if any(k in str(c).lower() for k in ["email", "phone", "ssn", "aadhaar", "passport"]):
        smells.append(f"Possible PII column: '{c}'")

summary = {}
if num.shape[1]:
    d = num.describe().round(4)
    summary = {str(k): {str(i): (None if pd.isna(v) else float(v)) for i, v in d[k].items()} for k in d.columns}

result_payload = {
    "filename": name,
    "rows": int(len(df)),
    "columns": cols,
    "sample": json.loads(df.head(5).to_json(orient="records", date_format="iso")),
    "duplicates": dups,
    "missingTotal": missing_total,
    "qualityScore": int(max(0, min(100, round(score)))),
    "numericSummary": summary,
    "correlations": corrs,
    "smells": smells[:8],
}
json.dumps(result_payload, default=str)
`;

export async function loadDataset(
  file: File,
  onStatus?: (s: string) => void,
): Promise<DatasetProfile> {
  const py = await getPyodide(onStatus);
  onStatus?.("Reading file…");
  const bytes = new Uint8Array(await file.arrayBuffer());
  await py.runPythonAsync("import os\nos.makedirs('/data', exist_ok=True)");
  py.FS.writeFile(`/data/${file.name}`, bytes);
  onStatus?.("Profiling dataset…");
  const raw = (await py.runPythonAsync(LOADER(file.name))) as string;
  runnerReady = false; // re-init runner so it picks up the new df
  return JSON.parse(raw) as DatasetProfile;
}
