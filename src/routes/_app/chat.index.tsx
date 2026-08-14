import { useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/chat/")({
  component: NewChat,
});

function NewChat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const created = useRef(false);

  useEffect(() => {
    if (!user || created.current) return;
    created.current = true;
    (async () => {
      const { data } = await supabase
        .from("conversations")
        .insert({ user_id: user.id, title: "New chat" })
        .select("id")
        .single();
      window.dispatchEvent(new Event("conversations:refresh"));
      if (data) await navigate({ to: "/chat/$id", params: { id: data.id }, replace: true });
    })();
  }, [user, navigate]);

  return (
    <div className="grid h-full place-items-center">
      <Loader2 className="size-5 animate-spin text-primary" />
    </div>
  );
}
