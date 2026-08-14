import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "system";

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  resolved: "light" | "dark";
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  setTheme: () => {},
  resolved: "light",
});

const STORAGE_KEY = "cda-theme";

function systemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (stored) setThemeState(stored);
  }, []);

  useEffect(() => {
    const apply = () => {
      const next = theme === "system" ? systemTheme() : theme;
      setResolved(next);
      document.documentElement.classList.toggle("dark", next === "dark");
      document.documentElement.style.colorScheme = next;
    };
    apply();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    if (theme === "system") {
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }
    return undefined;
  }, [theme]);

  const setTheme = (mode: ThemeMode) => {
    window.localStorage.setItem(STORAGE_KEY, mode);
    setThemeState(mode);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolved }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
