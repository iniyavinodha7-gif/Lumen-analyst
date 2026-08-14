import { useEffect } from "react";
import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { WorkspaceProvider } from "@/lib/workspace";
import { AppSidebar, useConversations } from "@/components/workspace/AppSidebar";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { session, loading, user } = useAuth();
  const navigate = useNavigate();
  const { conversations, refresh } = useConversations(user?.id ?? null);

  useEffect(() => {
    const handler = () => void refresh();
    window.addEventListener("conversations:refresh", handler);
    return () => window.removeEventListener("conversations:refresh", handler);
  }, [refresh]);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth", search: { mode: "login" } });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <WorkspaceProvider>
      <div className="grid h-screen grid-cols-1 overflow-hidden bg-background md:grid-cols-[264px_minmax(0,1fr)]">
        <div className="hidden md:block">
          <AppSidebar conversations={conversations} onRefresh={refresh} />
        </div>
        <main className="h-screen min-w-0 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </WorkspaceProvider>
  );
}
