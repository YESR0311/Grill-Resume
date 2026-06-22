"use client";

export function SettingsBackButton() {
  return (
    <button
      onClick={() => {
        if (typeof window !== "undefined") {
          if (window.history.length > 1) {
            window.history.back();
          } else {
            window.location.href = "/";
          }
        }
      }}
      className="self-start text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      ← 返回
    </button>
  );
}