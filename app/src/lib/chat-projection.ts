import type { CoachGrillSession } from "@/features/coach/conversation/engine";
import type { CoachQaAnswer } from "@/features/coach/storage";
import type { CoachQuestionKind } from "@/features/coach/questions";

/**
 * grill 对话流投影：把 CoachGrillSession（后端真相）投影成对话气泡序列。
 *
 * 设计哲学（design §1.1 / §2.1）：对话历史不是独立 client store，而是
 * QaAnswer + turn 的**视图投影**。activeTurn 不进消息流——它由 ActiveTurnCard
 * 单独渲染（含输入区）；这里只产出"已回答历史"的问答气泡对。
 *
 * 纯函数：SSR / client 同构，可单测。
 */

export type ChatQuestionMessage = {
  id: string;
  role: "assistant";
  kind: "question";
  prompt: string;
  targetLabel: string;
  questionKind: CoachQuestionKind;
};

export type ChatAnswerMessage = {
  id: string;
  role: "user";
  kind: "answer";
  text: string;
  status: CoachQaAnswer["status"];
  updatedAt: string;
};

export type ChatMessage = ChatQuestionMessage | ChatAnswerMessage;

/**
 * 已回答的 turn（排除 activeTurn）按答案更新时间升序投影成 Q→A 气泡对。
 * activeTurn 由调用方单独以 ActiveTurnCard 渲染（输入态），不出现在历史流中。
 */
export function projectChatMessages(session: CoachGrillSession): ChatMessage[] {
  const active = session.base.activeTurn;
  const answered = session.base.turns
    .filter((turn) => turn.answer && turn !== active)
    .sort((a, b) => (a.answer!.updatedAt < b.answer!.updatedAt ? -1 : 1));

  const messages: ChatMessage[] = [];
  for (const turn of answered) {
    messages.push({
      id: `q:${turn.targetSource}:${turn.targetId}:${turn.questionId}`,
      role: "assistant",
      kind: "question",
      prompt: turn.questionPrompt,
      targetLabel: turn.targetLabel,
      questionKind: turn.questionKind,
    });
    messages.push({
      id: `a:${turn.targetSource}:${turn.targetId}:${turn.questionId}`,
      role: "user",
      kind: "answer",
      text: turn.answer!.answerText,
      status: turn.answer!.status,
      updatedAt: turn.answer!.updatedAt,
    });
  }
  return messages;
}

const KIND_LABELS: Record<CoachQuestionKind, string> = {
  context: "背景",
  action: "动作",
  result: "结果",
  metric: "指标",
  evidence: "证据",
  "jd-fit": "岗位匹配",
};

export function questionKindLabel(value: CoachQuestionKind): string {
  return KIND_LABELS[value];
}
