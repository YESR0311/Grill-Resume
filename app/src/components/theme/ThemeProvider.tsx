"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

type ThemeCtx = {
  theme: Theme;
  resolved: ResolvedTheme;
  setTheme: (t: Theme) => void;
};

const ThemeContext = createContext<ThemeCtx>({
  theme: "system",
  resolved: "light",
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function resolveTheme(t: Theme): ResolvedTheme {
  if (t !== "system") return t;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyClass(r: ResolvedTheme) {
  document.documentElement.classList.toggle("dark", r === "dark");
}

/**
 * ThemeProvider — 浅色/暗色/跟随系统。
 * - applyClass 紧跟在 resolveTheme 后进行，由 storeState/setTheme 控制。
 * - 防闪烁由 layout.tsx 头部 inline script 处理。
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  // 初始化：从 localStorage 加载
  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    const init = stored ?? "system";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(init);
    applyClass(resolveTheme(init));
    setMounted(true);
  }, []);

  // 监听 matchMedia（system 模式）
  useEffect(() => {
    if (!mounted) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (theme === "system") {
        applyClass(mq.matches ? "dark" : "light");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mounted, theme]);

  // setTheme：同时写入 class + localStorage
  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    applyClass(resolveTheme(t));
    localStorage.setItem("theme", t);
  }, []);

  // resolved 在 context 中实时计算（只依赖 theme，不是状态）
  const resolved = resolveTheme(theme);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}