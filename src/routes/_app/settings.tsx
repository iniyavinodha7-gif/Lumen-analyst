import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { USER_ROLES, useAuth } from "@/lib/auth";
import { useTheme, type ThemeMode } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Settings · Lumen" },
      { name: "description", content: "Update your name, analyst role and appearance." },
      { property: "og:title", content: "Settings · Lumen" },
      { property: "og:description", content: "Update your name, analyst role and appearance." },
    ],
  }),
  component: Settings,
});

function Settings() {
  const { profile, user, refreshProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState("");
  const [role, setRole] = useState("Student");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? "");
      setRole(profile.role ?? "Student");
    }
  }, [profile]);

  async function save() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ name, role }).eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Could not save your settings.");
      return;
    }
    await refreshProfile();
    toast.success("Settings saved");
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-8">
      <div className="mx-auto w-full max-w-xl">
        <h1 className="font-display text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your role shapes how every answer is explained.
        </p>

        <div className="panel mt-6 space-y-5 p-5">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={profile?.email ?? user?.email ?? ""} disabled />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {USER_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Appearance</Label>
            <Select value={theme} onValueChange={(v) => setTheme(v as ThemeMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={save} disabled={saving}>
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
