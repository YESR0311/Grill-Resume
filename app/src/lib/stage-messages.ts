/**
 * 阶段文案中心。把散落在旧 pipeline-status-bar 的 code→文案 / stage / status 标签
 * 收敛到单一来源，供新工作区所有阶段视图复用。
 *
 * 注意：错误 code 来自后端 redirect 参数（pipelineCode / coach code）与 stage errorCode，
 * 这里只做展示文案映射，不做业务判断。
 */
import type { PipelineStage, PipelineStageStatus } from "@/features/pipeline";

/** 四阶段中文短标签。 */
export const STAGE_LABELS: Record<PipelineStage, string> = {
  grill: "问答",
  evaluate: "评估",
  polish: "润色",
  export: "导出",
};

/** 四阶段一句话说明（侧栏 / 进度条 tooltip）。 */
export const STAGE_DESCRIPTIONS: Record<PipelineStage, string> = {
  grill: "逐题追问，把流水账逼近可证事实",
  evaluate: "联网验证岗位覆盖与经历价值",
  polish: "生成候选，只在确认后改写要点",
  export: "确认单页排版，导出中文 DOCX",
};

/** stage 状态标签。 */
export const STATUS_LABELS: Record<PipelineStageStatus, string> = {
  not_started: "未开始",
  in_progress: "执行中",
  awaiting_user: "待确认",
  completed: "已完成",
  failed: "失败",
};

/** 错误 / 阻塞 code → 中文文案（从 readableXxxError 与旧 errorLabel 抽出）。 */
const ERROR_MESSAGES: Record<string, string> = {
  // pipeline / egress
  egress_pending: "等待隐私与外发数据确认",
  "egress-items-incomplete": "请先勾选全部外发项再确认",
  "egress-plan-not-confirmed": "评估阶段需要先确认外发计划",
  "stage-returned-without-redirect": "阶段执行异常，请重试",
  "stage-timeout": "阶段执行超时，可稍后重试",
  // 配置
  "missing-model-config": "请先配置默认 AI 模型",
  "missing-search-config": "请先配置 Tavily 搜索",
  // 数据
  "missing-resume": "当前简历不可用，请回到材料录入检查",
  "resume-not-found": "找不到简历，请检查项目材料",
  "missing-basics": "导出前需要补齐基础信息",
  // QA
  "qa-invalid": "回答内容不合法，请检查输入",
  "qa-persist-failed": "回答保存失败，请重试",
  "qa-failed": "回答保存失败，请重试",
  "star-invalid": "STAR 证据不完整，请补全",
  "evidence-append-failed": "证据写入失败，请重试",
  "evidence-failed": "证据写入失败，请重试",
  "qa-answer-not-confirmed": "请先把回答标记为事实笔记",
  "qa-target-not-experience": "该回答不属于经历，暂不可入图",
  "experience-not-found": "找不到对应经历",
  // AI clarify（grill enhancement）
  "enhance-failed": "AI 澄清生成失败，请重试",
  "missing-active-turn": "当前没有可追问的问题",
  "privacy-not-confirmed": "请先勾选外发数据确认",
  unavailable: "AI 澄清暂不可用",
  "persist-failed": "结果保存失败，请重试",
  "missing-project": "找不到项目",
  // intake
  "empty-input": "请粘贴材料后再解析",
  "candidate-write-failed": "候选保存失败，请重试",
  "candidate-not-found": "找不到候选，请重新解析",
  "apply-failed": "写入失败，请重试",
  // M3 stage gate
  "session-not-found": "找不到流程会话，请重新开始",
  "egress-failed": "隐私确认失败，请重试",
  "advance-failed": "阶段推进失败，请重试",
  "stage-not-failed": "当前阶段未失败，无需重试",
  "retry-failed": "重试失败，请稍后再试",
};

/** 把后端 code 翻成可读中文；未知 code 原样返回（避免吞掉调试信息）。 */
export function stageMessage(code: string | undefined | null): string | null {
  if (!code) return null;
  return ERROR_MESSAGES[code] ?? code;
}

/** "确认并进入下一段"的按钮文案，按当前 stage 给出去向。 */
export function advanceLabel(stage: PipelineStage): string {
  switch (stage) {
    case "grill":
      return "确认问答结果，进入评估";
    case "evaluate":
      return "确认评估结果，进入润色";
    case "polish":
      return "确认润色结果，进入导出";
    case "export":
      return "查看导出结果";
  }
}
