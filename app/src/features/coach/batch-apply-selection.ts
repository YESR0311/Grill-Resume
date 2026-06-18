// 批量应用润色候选的纯解析/redirect 助手（无副作用、无 server-only、闭网可测）。
// 与引擎 executeBatchApplyPolish（action-helpers.ts，含 "use server-only"）解耦，便于纯函数验收。

export type BatchApplyPolishSelection = {
  runId: string;
  candidateId: string;
};

/**
 * 解析多选表单值 "runId:candidateId" → 选择项。
 * - 按首个冒号切分（candidateId 理论含冒号也安全；实际 nanoid 字母表 [A-Za-z0-9_-] 无冒号）。
 * - runId / candidateId 任一为空 → 丢弃该项（畸形输入）。
 * - 精确 (runId, candidateId) 重复对去重（保留首次出现）。
 */
export function parseBatchApplySelections(values: string[]): BatchApplyPolishSelection[] {
  const seen = new Set<string>();
  const items: BatchApplyPolishSelection[] = [];
  for (const value of values) {
    const sep = value.indexOf(":");
    if (sep <= 0) continue; // 无冒号 或 冒号在首位（runId 为空）→ 丢弃
    const runId = value.slice(0, sep);
    const candidateId = value.slice(sep + 1);
    if (!runId || !candidateId) continue;
    const key = `${runId}:${candidateId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ runId, candidateId });
  }
  return items;
}

/**
 * 把批量应用结果计数编码进 redirect URL（与 buildPolishRedirect 同路由前缀，
 * 便于 syncPipelinePolish 通过 polishStatus 识别并同步进度）。
 * - selected === 0 → polishStatus=batch-empty（未选择，无写盘）。
 * - 否则 polishStatus=batch-applied + batchApplied / batchFailed 计数。
 */
export function buildBatchPolishRedirect(
  projectId: string,
  counts: { applied: number; failed: number; selected: number },
): string {
  const params = new URLSearchParams();
  if (counts.selected === 0) {
    params.set("polishStatus", "batch-empty");
  } else {
    params.set("polishStatus", "batch-applied");
    params.set("batchApplied", String(counts.applied));
    params.set("batchFailed", String(counts.failed));
  }
  return `/projects/${projectId}/coach/polish?${params.toString()}`;
}
