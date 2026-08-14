import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Bot, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
import { USER_ROLES, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({
    mode: z.enum(["login", "signup", "forgot"]).default("login"),
  }),
  head: () => ({
    meta: [
      { title: "Sign in · Lumen Data Analyst" },
      {
        name: "description",
        content: "Log in or create your Lumen account to analyse datasets conversationally.",
      },
      { property: "og:title", content: "Sign in · Lumen Data Analyst" },
      {
        property: "og:description",
        content: "Log in or create your Lumen account to analyse datasets conversationally.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState<string>("Student");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) void navigate({ to: "/chat" });
  }, [loading, session, navigate]);

  const setMode = (next: "login" | "signup" | "forgot") =>
    navigate({ to: "/auth", search: { mode: next } });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        if (password.length < 6) throw new Error("Password must be at least 6 characters.");
        if (password !== confirm) throw new Error("Passwords do not match.");
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/chat`,
            data: { name: name || email.split("@")[0], role },
          },
        });
        if (error) throw error;
        toast.success("Account created. Welcome to Lumen.");
        await navigate({ to: "/chat" });
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await navigate({ to: "/chat" });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth?mode=login`,
        });
        if (error) throw error;
        toast.success("Reset link sent. Check your inbox.");
        setMode("login");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      toast.error(
        message.includes("already registered")
          ? "That email already has an account. Try logging in."
          : message,
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/chat` },
    });
    if (error) {
      toast.error(error.message || "Google sign-in failed. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="hero-surface flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 font-display font-bold">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Bot className="size-4" />
          </span>
          Lumen
        </Link>

        <div className="panel p-6">
          <h1 className="font-display text-2xl font-bold">
            {mode === "signup"
              ? "Create your account"
              : mode === "forgot"
                ? "Reset your password"
                : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup"
              ? "Tell us how you work so answers match your style."
              : mode === "forgot"
                ? "We'll email you a secure reset link."
                : "Log in to your data workspace."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ada Lovelace"
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@college.edu"
                required
              />
            </div>

            {mode !== "forgot" && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-2 grid place-items-center text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === "signup" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm password</Label>
                  <Input
                    id="confirm"
                    type={showPassword ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>What best describes you?</Label>
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
                  <p className="text-xs text-muted-foreground">
                    Used only to personalise explanations. You can change it in Settings.
                  </p>
                </div>
              </>
            )}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Log in"}
            </Button>
          </form>

          {mode !== "forgot" && (
            <>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
              </div>
              <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={busy}>
                Continue with Google
              </Button>
            </>
          )}

          <div className="mt-6 space-y-2 text-center text-sm text-muted-foreground">
            {mode === "login" && (
              <>
                <button className="hover:text-foreground" onClick={() => setMode("forgot")}>
                  Forgot password?
                </button>
                <p>
                  New here?{" "}
                  <button className="font-medium text-primary" onClick={() => setMode("signup")}>
                    Create an account
                  </button>
                </p>
              </>
            )}
            {mode === "signup" && (
              <p>
                Already have an account?{" "}
                <button className="font-medium text-primary" onClick={() => setMode("login")}>
                  Log in
                </button>
              </p>
            )}
            {mode === "forgot" && (
              <button className="hover:text-foreground" onClick={() => setMode("login")}>
                Back to login
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
