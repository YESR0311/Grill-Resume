"use client";

import { useTheme } from "@/components/theme/ThemeProvider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-3">
      <label className="text-sm text-muted-foreground">主题</label>
      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value as "light" | "dark" | "system")}
        className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
      >
        <option value="system">跟随系统</option>
        <option value="light">浅色</option>
        <option value="dark">暗色</option>
      </select>
    </div>
  );
}