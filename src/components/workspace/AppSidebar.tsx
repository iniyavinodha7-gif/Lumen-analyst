import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import {
  Bot,
  LayoutDashboard,
  LogOut,
  MessageSquarePlus,
  Moon,
  Pin,
  Search,
  Settings,
  Sun,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ConversationRow = {
  id: string;
  title: string;
  pinned: boolean;
  updated_at: string;
};

export function AppSidebar({
  conversations,
  onRefresh,
}: {
  conversations: ConversationRow[];
  onRefresh: () => void;
}) {
  const { profile, signOut } = useAuth();
  const { resolved, setTheme } = useTheme();
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { id?: string };
  const [query, setQuery] = useState("");

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const pinned = filtered.filter((c) => c.pinned);
  const rest = filtered.filter((c) => !c.pinned);

  async function togglePin(c: ConversationRow) {
    await supabase.from("conversations").update({ pinned: !c.pinned }).eq("id", c.id);
    onRefresh();
  }

  async function remove(c: ConversationRow) {
    await supabase.from("conversations").delete().eq("id", c.id);
    toast.success("Chat deleted");
    if (params.id === c.id) await navigate({ to: "/chat" });
    onRefresh();
  }

  const renderGroup = (label: string, items: ConversationRow[]) =>
    items.length > 0 && (
      <div className="mb-4">
        <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <ul className="space-y-0.5">
          {items.map((c) => (
            <li
              key={c.id}
              className={cn(
                "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent",
                params.id === c.id && "bg-sidebar-accent",
              )}
            >
              <Link
                to="/chat/$id"
                params={{ id: c.id }}
                className="min-w-0 flex-1 truncate text-left"
              >
                {c.title}
              </Link>
              <button
                aria-label={c.pinned ? "Unpin chat" : "Pin chat"}
                onClick={() => togglePin(c)}
                className="opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Pin className={cn("size-3.5", c.pinned && "fill-current opacity-100")} />
              </button>
              <button
                aria-label="Delete chat"
                onClick={() => remove(c)}
                className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <aside className="flex h-full w-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between px-3 py-4">
        <Link to="/" className="flex items-center gap-2 font-display font-bold">
          <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Bot className="size-4" />
          </span>
          Lumen
        </Link>
        <button
          aria-label="Toggle theme"
          className="rounded-md p-1.5 hover:bg-sidebar-accent"
          onClick={() => setTheme(resolved === "dark" ? "light" : "dark")}
        >
          {resolved === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}

        </button>
      </div>

      <div className="px-3">
        <Button className="w-full justify-start" onClick={() => navigate({ to: "/chat" })}>
          <MessageSquarePlus className="size-4" />
          New analysis
        </Button>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats"
            className="h-9 pl-8"
          />
        </div>
      </div>

      <nav className="mt-4 flex-1 overflow-y-auto px-3">
        {renderGroup("Pinned", pinned)}
        {renderGroup("Recent", rest)}
        {filtered.length === 0 && (
          <p className="px-2 text-sm text-muted-foreground">No conversations yet.</p>
        )}
      </nav>

      <div className="space-y-1 border-t border-sidebar-border p-3 text-sm">
        <Link
          to="/dashboard"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sidebar-accent"
        >
          <LayoutDashboard className="size-4" /> Dashboard
        </Link>
        <Link
          to="/settings"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sidebar-accent"
        >
          <Settings className="size-4" /> Settings
        </Link>
        <button
          onClick={async () => {
            await signOut();
            await navigate({ to: "/" });
          }}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-sidebar-accent"
        >
          <LogOut className="size-4" /> Sign out
        </button>
        <div className="mt-2 truncate px-2 text-xs text-muted-foreground">
          {profile?.name ?? profile?.email} · {profile?.role}
        </div>
      </div>
    </aside>
  );
}

export function useConversations(userId: string | null) {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);

  const refresh = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("conversations")
      .select("id,title,pinned,updated_at")
      .eq("archived", false)
      .order("updated_at", { ascending: false });
    setConversations((data as ConversationRow[]) ?? []);
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return { conversations, refresh };
}
