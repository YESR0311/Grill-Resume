"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { predictFitWithPretext, type FitPredictionResult } from "@/features/export/fit-predict";
import type { LayoutSchema } from "@/features/layout/schema";

/**
 * 客户端单页 fit 实时预测（M4）。
 * 用 @chenglou/pretext（OffscreenCanvas）实测内容高度，
 * 与服务端 fitToSinglePage 的字符宽度估算作对照。
 */
export function FitPredictionCard({
  layoutSchema,
  serverOverflow,
  serverDecisions,
}: {
  layoutSchema: LayoutSchema;
  /** 服务端 estimateSchemaLines 是否判断溢出。 */
  serverOverflow?: boolean;
  /** 服务端裁剪决策数。 */
  serverDecisions?: number;
}) {
  const [prediction, setPrediction] = useState<FitPredictionResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 延迟一帧让浏览器完成布局
    const id = requestAnimationFrame(() => {
      const result = predictFitWithPretext(layoutSchema);
      setPrediction(result);
      setLoading(false);
    });
    return () => cancelAnimationFrame(id);
  }, [layoutSchema]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
        <div className="h-3 w-3 animate-pulse rounded-full bg-muted-foreground/30" />
        正在测量排布…
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-3 text-xs text-muted-foreground">
        单页测高暂不可用（SSR 环境）。
      </div>
    );
  }

  const clientFits = prediction.fitsOnOnePage;
  const serverFits = !serverOverflow;
  const agree = clientFits === serverFits;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">单页适配验证</p>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-block h-2 w-2 rounded-full",
              clientFits
                ? "bg-status-confirmed"
                : prediction.usedPercent < 120
                  ? "bg-status-pending"
                  : "bg-status-failed",
            )}
          />
          <span className="text-xs font-medium tabular-nums">
            {prediction.usedPercent.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* 进度条 */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            prediction.usedPercent <= 100
              ? "bg-status-confirmed"
              : prediction.usedPercent <= 115
                ? "bg-status-pending"
                : "bg-status-failed",
          )}
          style={{ width: `${Math.min(prediction.usedPercent, 150)}%` }}
        />
      </div>

      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span>
          实际排布：{prediction.contentHeightPx.toFixed(0)}px
          {" / "}
          {prediction.pageCapacityPx.toFixed(0)}px
        </span>
        <span className="text-[6px]">·</span>
        <span>
          预估页数：{prediction.estimatedPageCount}{prediction.estimatedPageCount === 1 ? " 页" : " 页"}
        </span>
      </div>

      {/* 状态文本 */}
      <p className={cn("text-[10px] leading-relaxed", clientFits ? "text-status-confirmed" : "text-status-pending")}>
        {clientFits
          ? "内容可在单页内排布。"
          : `超出单页 ${(prediction.usedPercent - 100).toFixed(0)}%，建议检查裁剪设置。`}
      </p>

      {serverOverflow !== undefined ? (
        <div className="flex items-center gap-2 text-[10px]">
          {agree ? (
            <span className="text-status-confirmed">服务端估算与实测一致</span>
          ) : (
            <span className="text-status-pending">
              服务端估测{serverOverflow ? "溢出" : "可容纳"}
              ，实测{clientFits ? "可容纳" : "溢出"}（客户端实测更精确）
            </span>
          )}
          {serverDecisions !== undefined && serverDecisions > 0 ? (
            <span className="text-muted-foreground">
              · 已触发 {serverDecisions} 项裁剪决策
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}