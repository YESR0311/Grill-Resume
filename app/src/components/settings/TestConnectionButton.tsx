"use client";

import { useState, useTransition } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { testConnectionAction } from "@/app/settings/test-actions";

/**
 * 连接测试按钮——发一次最小请求验证连通性。
 */
export function TestConnectionButton({ connectionId }: { connectionId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const run = () => {
    setResult(null);
    startTransition(async () => {
      const res = await testConnectionAction(connectionId);
      setResult({
        ok: res.ok,
        msg: res.ok ? `连通 · ${res.reply ?? ""}`.trim() : res.error ?? "失败",
      });
    });
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={run}
        disabled={pending}
        className="rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50"
      >
        {pending ? <Loader2 size={12} className="animate-spin" /> : "测试"}
      </button>
      {result && (
        <span
          className={`flex items-center gap-1 text-xs ${
            result.ok ? "text-status-confirmed" : "text-status-failed"
          }`}
          title={result.msg}
        >
          {result.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
          <span className="max-w-[160px] truncate">{result.msg}</span>
        </span>
      )}
    </div>
  );
}