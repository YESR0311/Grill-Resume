import type { ResumeIntakeCandidate } from "@/features/intake/parse-raw-text";

/**
 * 工作区 action 的返回态（design §3.2 useActionState）。
 *
 * 独立于 actions.ts：`"use server"` 文件只能导出 async 函数，不能导出常量 / 对象，
 * 故 type 与 IDLE 常量放此非-server 模块，actions.ts 与 client 组件都从这里取。
 * ResumeIntakeCandidate 走 type-only import（编译期擦除，不触发 server-only 运行时守卫）。
 */
export type WorkspaceActionState = {
  /** 每次提交递增的时间戳，强制 client effect 重新触发（即使 code 相同）。 */
  ts: number;
  ok: boolean;
  /** 状态码：成功为 status 文案 key，失败为 error code。无则 undefined。 */
  code?: string;
  /** 解析候选（仅 intake parse 成功时回填）。 */
  candidate?: ResumeIntakeCandidate;
};

export const IDLE_WORKSPACE_STATE: WorkspaceActionState = { ts: 0, ok: true };
