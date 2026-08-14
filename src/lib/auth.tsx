import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const USER_ROLES = [
  "Student",
  "Data Analyst",
  "Business Analyst",
  "Developer",
  "Business / Manager",
  "Researcher",
  "Teacher / Educator",
  "Other",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export type Profile = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  theme: string;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  const loadProfile = useMemo(
    () => async (id: string) => {
      const { data } = await supabase
        .from("profiles")
        .select("id,name,email,role,theme")
        .eq("id", id)
        .maybeSingle();
      setProfile((data as Profile) ?? null);
    },
    [],
  );

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    void loadProfile(userId);
  }, [userId, loadProfile]);

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    refreshProfile: async () => {
      if (userId) await loadProfile(userId);
    },
    signOut: async () => {
      await supabase.auth.signOut();
      setProfile(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
