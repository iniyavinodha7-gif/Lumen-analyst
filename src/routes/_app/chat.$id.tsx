import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ChatWindow } from "@/components/workspace/ChatWindow";

export const Route = createFileRoute("/_app/chat/$id")({
  component: ChatRoute,
});

function ChatRoute() {
  const { id } = Route.useParams();
  const [title, setTitle] = useState("New chat");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("conversations")
        .select("title")
        .eq("id", id)
        .maybeSingle();
      if (!cancelled && data) setTitle(data.title);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <ChatWindow
      key={id}
      conversationId={id}
      title={title}
      onConversationsChanged={() => {
        window.dispatchEvent(new Event("conversations:refresh"));
        void supabase
          .from("conversations")
          .select("title")
          .eq("id", id)
          .maybeSingle()
          .then(({ data }) => data && setTitle(data.title));
      }}
    />
  );
}
