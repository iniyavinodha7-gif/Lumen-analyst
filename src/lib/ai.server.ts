const MODEL = process.env["GEMINI_MODEL"] || "gemini-2.5-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type ChatTurn = { role: "user" | "assistant"; content: string };

const ROLE_STYLE: Record<string, string> = {
  Student: "Explain step by step, teach the concepts, keep jargon light.",
  "Data Analyst": "Give detailed statistics, methodology and analytical reasoning.",
  "Business Analyst": "Lead with KPIs, trends, business implications and recommendations.",
  Developer: "Be technical: schema, dtypes, pandas/SQL details and execution notes.",
  "Business / Manager": "Give a concise executive summary: key metrics and the decision it supports.",
  Researcher: "State methodology, assumptions, evidence and limitations.",
  "Teacher / Educator": "Be explanatory and teaching-oriented with a clear worked narrative.",
  Other: "Be clear, concise and practical.",
};

type GeminiPart = { text: string };
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

async function callModel(messages: { role: "system" | "user" | "assistant"; content: string }[], temperature = 0.2) {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new Error("AI is not configured. Add GEMINI_API_KEY to your environment.");

  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const contents: GeminiContent[] = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

  const res = await fetch(`${API_BASE}/${MODEL}:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { temperature, responseMimeType: "application/json" },
    }),
  });
  if (res.status === 429) throw new Error("AI rate limit reached. Please try again in a moment.");
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`AI request failed (${res.status})${detail ? `: ${detail.slice(0, 180)}` : ""}`);
  }
  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
}

function parseJson<T>(text: string, fallback: T): T {
  const cleaned = text.replace(/^```(?:json)?/gm, "").replace(/```$/gm, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return fallback;
  try { return JSON.parse(cleaned.slice(start, end + 1)) as T; } catch { return fallback; }
}

export type PlanResult = { mode: "chat" | "code"; reply: string; python: string; intent: string };

export async function planTurn(input: { question: string; history: ChatTurn[]; datasetContext: string; role: string; persona: string }): Promise<PlanResult> {
  const hasData = Boolean(input.datasetContext);
  const system = `You are LUMEN, a Conversational Business Data Analyst. You act like a senior analyst for company data
(HR/employee, sales, customer, finance, marketing, inventory, operations/product) and also handle general
structured CSV/Excel/JSON/TSV data and general data-science questions.

Audience role: ${input.role}. ${ROLE_STYLE[input.role] ?? ROLE_STYLE.Other}
Analyst persona: ${input.persona}. Professional, clear, approachable. No emoji spam, no forced enthusiasm.

DATASET CONTEXT (already loaded in the browser as pandas DataFrame df):
${input.datasetContext || "NO DATASET IS LOADED."}

CONVERSATIONAL BEHAVIOUR
- Write every reply fresh. Never reuse a canned greeting or a fixed template; vary wording, length and structure naturally even if the user repeats a short message such as "Hi".
- For analytical answers, accuracy matters more than variety.
- Ask a short clarifying question when the request is genuinely ambiguous.

DECIDE THE MODE
- Needs real numbers, aggregation, ranking, stats, trends, cleaning, charts or ML => mode "code".
- Small talk, definitions, methodology questions, or anything answerable without dataset numbers => mode "chat".
${hasData ? "- The user has data loaded: prefer code for questions about their data." : "- NO DATASET IS LOADED. If the user asks anything dataset-specific, never invent numbers; explain what file would be needed."}

SEMANTIC COLUMN UNDERSTANDING
Map business language to actual columns. Verify against the real column list; if no suitable column exists, say so.

BUSINESS INSIGHT DEPTH
Distinguish descriptive, diagnostic, predictive and prescriptive analysis. Never state causation from correlation.

NEVER compute numbers yourself. All numbers must come from executed Python.

When mode is code, write Python for Pyodide with pandas (pd), numpy (np) and scikit-learn available.
- df already exists. Do not read files or import matplotlib/plotly.
- Assign final answer to result.
- Resolve column names defensively from df.columns.
- If the user asks to plot/chart/graph/visualize/show trend/compare visually, you MUST assign a variable named chart containing a plain-dict Plotly figure spec built from real computed values: {"data": [{"type": "bar", "x": [...], "y": [...]}], "layout": {"title": "..."}}. This is not optional when a visual is requested — omitting chart in that case is a failure.
- Otherwise, assign chart only if a visual genuinely adds value beyond the text answer.
- Honour conversational chart edits from history.
- Never mutate df destructively unless explicitly approved.
- Keep it under 45 lines.

Reply with STRICT JSON only: {"mode":"chat"|"code","intent":"short intent label","reply":"text answer when chat, else empty","python":"code when code, else empty"}`;
  const raw = await callModel([
    { role: "system", content: system },
    ...input.history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: input.question },
  ], 0.75);
  const parsed = parseJson<PlanResult>(raw, { mode: "chat", reply: raw || "I could not process that request.", python: "", intent: "conversation" });
  return { mode: parsed.mode === "code" && parsed.python ? "code" : "chat", reply: parsed.reply ?? "", python: parsed.python ?? "", intent: parsed.intent ?? "" };
}

export type ExplainResult = { explanation: string; followups: string[]; verified: boolean };

export async function explainResult(input: { question: string; code: string; execOutput: string; role: string; persona: string; eli5: boolean; tldr: boolean; hasChart: boolean }): Promise<ExplainResult> {
  const system = `You explain executed data-analysis results for a ${input.role}. ${ROLE_STYLE[input.role] ?? ROLE_STYLE.Other}
Persona: ${input.persona}. ${input.eli5 ? "Explain like the reader is five: simple words, tiny sentences, one analogy." : ""}
${input.tldr ? "Start with a one-line executive TL;DR in bold, then at most three bullets." : ""}
Every number you state MUST appear in the execution output. Never invent or recompute numbers.
${input.hasChart ? "A chart WAS generated and will be shown to the user alongside your text — you may reference it (e.g. \"the chart below shows...\")." : "NO chart was generated for this turn. Do NOT say \"here is the chart\", \"the bar chart below\", or otherwise claim a visual exists — describe the numbers in words/text only."}
Set verified false if the output does not support a confident answer. Lead with the business answer, then supporting detail.
State assumptions and limitations briefly. Do not claim causation from correlation. Vary phrasing naturally.
Reply with STRICT JSON only: {"explanation":"markdown","followups":["..."],"verified":true|false}`;
  const raw = await callModel([{ role: "system", content: system }, { role: "user", content: `User question: ${input.question}\n\nExecuted Python:\n${input.code}\n\nExecution output:\n${input.execOutput.slice(0, 6000)}` }]);
  const parsed = parseJson<ExplainResult>(raw, { explanation: raw || "Analysis complete.", followups: [], verified: true });
  return { explanation: parsed.explanation ?? "", followups: Array.isArray(parsed.followups) ? parsed.followups.slice(0, 3) : [], verified: parsed.verified !== false };
}

export async function summarizeProfile(input: { profileJson: string; role: string }): Promise<{ summary: string; chips: string[] }> {
  const raw = await callModel([
    { role: "system", content: `You are a zero-click BUSINESS data profiler writing for a ${input.role}. Given a dataset profile JSON, infer its business domain from columns and samples. Write max 130 words covering shape, data quality, computable business metrics, relationships or risks. Never invent numbers. Then give exactly 3 short clickable questions. Reply with STRICT JSON only: {"summary":"markdown","chips":["...","...","..."]}` },
    { role: "user", content: input.profileJson.slice(0, 6000) },
  ]);
  const parsed = parseJson<{ summary: string; chips: string[] }>(raw, { summary: raw, chips: [] });
  return { summary: parsed.summary ?? "", chips: (parsed.chips ?? []).slice(0, 3) };
}

export async function titleFor(question: string): Promise<string> {
  const raw = await callModel([{ role: "system", content: "Write a 2-5 word title for this data analysis chat. Plain text only, no quotes. Return JSON: {\"title\":\"...\"}" }, { role: "user", content: question }], 0.3);
  const parsed = parseJson<{ title: string }>(raw, { title: "New chat" });
  return parsed.title?.trim().slice(0, 60) || "New chat";
}
