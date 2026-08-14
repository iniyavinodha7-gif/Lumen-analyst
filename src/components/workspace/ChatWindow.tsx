import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowDown,
  BookOpenCheck,

  Check,
  ChevronDown,
  Code2,
  Copy,
  Download,
  Loader2,
  Pin,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { datasetContextString, useWorkspace, type DatasetState } from "@/lib/workspace";
import { loadDataset, runPython } from "@/lib/pyodide";
import { planAnalysis, explainAnalysis, profileDataset, generateTitle } from "@/lib/ai.functions";
import { buildNotebook, downloadNotebook } from "@/lib/notebook";
import { Button } from "@/components/ui/button";
import { PlotlyChart } from "@/components/PlotlyChart";
import { Composer } from "./Composer";
import { DataPanel } from "./DataPanel";
import { Markdown } from "./Markdown";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  code?: string | null | undefined;
  chart?: unknown | null | undefined;
  table?: { columns: string[]; rows: unknown[][] } | null | undefined;
  verified?: boolean | undefined;
  followups?: string[] | undefined;
  failed?: boolean | undefined;
};


export function ChatWindow({
  conversationId,
  title,
  onConversationsChanged,
}: {
  conversationId: string;
  title: string;
  onConversationsChanged: () => void;
}) {
  const { user, profile } = useAuth();
  const { datasetFor, setDatasetFor, runtimeStatus, setRuntimeStatus } = useWorkspace();
  const dataset = datasetFor(conversationId);
  const navigate = useNavigate();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [openCode, setOpenCode] = useState<Record<string, boolean>>({});
  const [atBottom, setAtBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const role = profile?.role ?? "Student";


  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("id,role,content,code_snippet,chart_json,result_json")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      setMessages(
        (data ?? []).map((m) => {
          const meta = (m.result_json ?? {}) as {
            table?: ChatMessage["table"];
            verified?: boolean;
            followups?: string[];
          };
          return {
            id: m.id,
            role: m.role === "user" ? "user" : "assistant",
            content: m.content,
            code: m.code_snippet,
            chart: m.chart_json,
            table: meta.table ?? null,
            verified: meta.verified,
            followups: meta.followups ?? [],
          } satisfies ChatMessage;
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  // Only follow the conversation when the user is already near the bottom.
  useEffect(() => {
    if (atBottom) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, stage, atBottom]);

  // Jump to the latest message when opening a conversation.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setAtBottom(true);
  }, [conversationId]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 120);
  }, []);

  const scrollToLatest = useCallback(() => {
    setAtBottom(true);
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);


  const persist = useCallback(
    async (msg: ChatMessage) => {
      if (!user) return;
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: msg.role,
        content: msg.content,
        code_snippet: msg.code ?? null,
        chart_json: (msg.chart ?? null) as never,
        result_json: {
          table: msg.table ?? null,
          verified: msg.verified ?? true,
          followups: msg.followups ?? [],
        } as never,
      });
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);
    },
    [conversationId, user],
  );

  const handleUpload = useCallback(
    async (file: File) => {
      setBusy(true);
      setStage("Booting Python runtime…");
      try {
        const prof = await loadDataset(file, (s) => {
          setStage(s);
          setRuntimeStatus(s);
        });
        setStage("Profiling with AI…");
        const { summary, chips } = await profileDataset({
          data: { profileJson: JSON.stringify(prof), role },
        });
        const state: DatasetState = { profile: prof, summary, chips };
        setDatasetFor(conversationId, state);
        if (user) {
          await supabase.from("datasets").insert({
            user_id: user.id,
            conversation_id: conversationId,
            filename: prof.filename,
            row_count: prof.rows,
            column_count: prof.columns.length,
            schema_metadata: { columns: prof.columns, qualityScore: prof.qualityScore } as never,
          });
        }
        const msg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `**${prof.filename}** loaded — ${prof.rows.toLocaleString()} rows × ${prof.columns.length} columns, quality score ${prof.qualityScore}/100.\n\n${summary}`,
          followups: chips,
        };
        setMessages((prev) => [...prev, msg]);
        await persist(msg);
        onConversationsChanged();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not read that file.");
      } finally {
        setBusy(false);
        setStage("");
      }
    },
    [conversationId, onConversationsChanged, persist, role, setDatasetFor, setRuntimeStatus, user],
  );

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || busy) return;
      setInput("");
      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: question };
      setMessages((prev) => [...prev, userMsg]);
      await persist(userMsg);
      setBusy(true);

      try {
        if (messages.length === 0) {
          const { title: newTitle } = await generateTitle({ data: { question } });
          await supabase.from("conversations").update({ title: newTitle }).eq("id", conversationId);
          onConversationsChanged();
        }

        setStage("Thinking…");
        const plan = await planAnalysis({
          data: {
            question,
            history: messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
            datasetContext: datasetContextString(dataset),
            role,
            persona: "Rigorous, friendly analyst",
          },
        });

        let assistant: ChatMessage;

        if (plan.mode === "code") {
          setStage("Running Python…");
          const exec = await runPython(plan.python, (s) => setRuntimeStatus(s));
          if (!exec.ok) {
            setStage("Fixing the code…");
            const retry = await planAnalysis({
              data: {
                question: `${question}\n\nThe previous code failed with:\n${exec.error}\nRewrite it correctly.`,
                history: [],
                datasetContext: datasetContextString(dataset),
                role,
                persona: "Rigorous, friendly analyst",
              },
            });
            if (retry.mode === "code") {
              const second = await runPython(retry.python, (s) => setRuntimeStatus(s));
              if (second.ok) {
                plan.python = retry.python;
                Object.assign(exec, second);
              }
            }
          }

          if (!exec.ok) {
            assistant = {
              id: crypto.randomUUID(),
              role: "assistant",
              content:
                "I couldn't complete that calculation. The generated code failed — try rephrasing, or check that the columns you mentioned exist.",
              code: plan.python,
              failed: true,
            };
          } else {
            setStage("Explaining the result…");
            const execOutput = [exec.stdout, exec.result].filter(Boolean).join("\n").slice(0, 6000);
            const explained = await explainAnalysis({
              data: {
                question,
                code: plan.python,
                execOutput,
                role,
                persona: "Rigorous, friendly analyst",
                eli5: /eli5|explain like/i.test(question),
                tldr: /tl;?dr|summar(y|ise|ize)/i.test(question),
              },
            });
            assistant = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: explained.explanation,
              code: plan.python,
              chart: exec.chart,
              table: exec.table,
              verified: explained.verified,
              followups: explained.followups,
            };
          }
        } else {
          assistant = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: plan.reply,
          };
        }

        setMessages((prev) => [...prev, assistant]);
        await persist(assistant);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setBusy(false);
        setStage("");
      }
    },
    [busy, conversationId, dataset, messages, onConversationsChanged, persist, role, setRuntimeStatus],
  );

  async function pinChart(msg: ChatMessage) {
    if (!user || !msg.chart) return;
    await supabase.from("pinned_charts").insert({
      user_id: user.id,
      conversation_id: conversationId,
      title: title === "New chat" ? "Pinned chart" : title,
      note: msg.content.slice(0, 200),
      chart_json: msg.chart as never,
    });
    toast.success("Pinned to your dashboard");
  }

  function exportNotebook() {
    if (messages.length === 0) {
      toast.error("Nothing to export yet.");
      return;
    }
    downloadNotebook(
      title,
      buildNotebook(
        title,
        dataset?.profile.filename ?? null,
        messages.map((m) => ({ role: m.role, content: m.content, code: m.code })),
      ),
    );
  }

  const empty = messages.length === 0;

  return (
    <div className="grid h-full min-h-0 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex h-full min-h-0 min-w-0 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">

          <div className="min-w-0">
            <h1 className="truncate font-display text-sm font-semibold">{title}</h1>
            <p className="truncate text-xs text-muted-foreground">
              {dataset ? `${dataset.profile.filename} · ${role} mode` : `${role} mode`}
              {runtimeStatus ? ` · ${runtimeStatus}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={exportNotebook}>
              <Download className="size-3.5" /> .ipynb
            </Button>
            <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/dashboard" })}>
              <BookOpenCheck className="size-3.5" /> Dashboard
            </Button>
          </div>
        </header>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          tabIndex={0}
          className="chat-scroll relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 focus:outline-none"
        >

          <div className="mx-auto w-full max-w-3xl space-y-5">
            {empty && (
              <div className="panel p-6 text-center">
                <Sparkles className="mx-auto size-6 text-primary" />
                <h2 className="mt-3 font-display text-xl font-bold">
                  {dataset ? "Ask your first question" : "Upload business data, or just ask"}
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  Drop an HR, sales, customer, finance, marketing or inventory file (CSV, TSV, JSON
                  or Excel) and I'll profile it instantly. Then ask in plain English — I write the
                  Python, run it in your browser and explain the verified result for a{" "}
                  {role.toLowerCase()}.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {(dataset?.chips?.length
                    ? dataset.chips
                    : [
                        "What kinds of business questions can you answer?",
                        "How do you verify your numbers?",
                        "What is standard deviation?",
                      ]
                  ).map((chip: string) => (

                    <button
                      key={chip}
                      onClick={() => send(chip)}
                      className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs transition-colors hover:bg-accent"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                    {m.content}
                  </div>
                </div>
              ) : (
                <article key={m.id} className="panel space-y-3 p-4">
                  <Markdown content={m.content} />

                  {m.chart != null && (
                    <div className="rounded-lg border border-border p-2">
                      <PlotlyChart spec={m.chart as never} />
                      <div className="mt-2 flex justify-end">
                        <Button size="sm" variant="ghost" onClick={() => pinChart(m)}>
                          <Pin className="size-3.5" /> Pin to dashboard
                        </Button>
                      </div>
                    </div>
                  )}

                  {m.table && m.table.rows.length > 0 && (
                    <div className="max-h-72 overflow-auto rounded-lg border border-border">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-surface-2">
                          <tr>
                            {m.table.columns.map((c) => (
                              <th key={c} className="px-3 py-2 font-medium">
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {m.table.rows.map((row, i) => (
                            <tr key={i} className="border-t border-border">
                              {row.map((cell, j) => (
                                <td key={j} className="px-3 py-1.5 font-mono">
                                  {cell === null || cell === undefined ? "—" : String(cell)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {m.code && (
                    <div>
                      <button
                        onClick={() => setOpenCode((p) => ({ ...p, [m.id]: !p[m.id] }))}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Code2 className="size-3.5" />
                        {openCode[m.id] ? "Hide" : "Show"} Python
                        <ChevronDown
                          className={`size-3.5 transition-transform ${openCode[m.id] ? "rotate-180" : ""}`}
                        />
                      </button>
                      {openCode[m.id] && (
                        <div className="relative mt-2">
                          <pre className="max-h-72 overflow-auto rounded-lg bg-surface-2 p-3 font-mono text-xs">
                            {m.code}
                          </pre>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="absolute right-1 top-1"
                            onClick={() => {
                              void navigator.clipboard.writeText(m.code ?? "");
                              toast.success("Code copied");
                            }}
                          >
                            <Copy className="size-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {!m.failed && m.code && (
                    <p className="flex items-center gap-1.5 text-[11px] text-success">
                      <Check className="size-3" />
                      {m.verified === false
                        ? "Computed, but the result is inconclusive"
                        : "Calculated with Python — numbers verified against the execution output"}
                    </p>
                  )}

                  {m.followups && m.followups.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {m.followups.map((f) => (
                        <button
                          key={f}
                          onClick={() => send(f)}
                          className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs transition-colors hover:bg-accent"
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  )}
                </article>
              ),
            )}

            {busy && (
              <div className="panel flex items-center gap-3 p-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" />
                {stage || "Working…"}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {!atBottom && (
          <div className="pointer-events-none relative">
            <button
              onClick={scrollToLatest}
              className="pointer-events-auto absolute -top-12 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs shadow-md transition-colors hover:bg-accent"
            >
              <ArrowDown className="size-3.5" /> Scroll to latest
            </button>
          </div>
        )}

        <div className="shrink-0">
          <Composer
            value={input}
            onChange={setInput}
            onSend={() => send(input)}
            onUpload={handleUpload}
            disabled={busy}
            hasDataset={!!dataset}
          />
        </div>
      </div>


      <div className="hidden lg:block">
        <DataPanel dataset={dataset} onUpload={handleUpload} />
      </div>
    </div>
  );
}
