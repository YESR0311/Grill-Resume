import { NextResponse } from "next/server";
import { buildAdaptiveQaSession, buildExperienceQuestionQueue } from "@/features/coach/questions";
import type { CoachQaAnswer } from "@/features/coach/storage";
import type { ResumeDocument } from "@/features/resume/types";

function promoteAnswerToEvidence(document: ResumeDocument, answer: CoachQaAnswer): ResumeDocument {
  if (answer.targetSource !== "experience") return document;

  const experienceIndex = document.experiences.findIndex((item) => item.id === answer.targetId);
  if (experienceIndex < 0) return document;

  const evidenceId = `${answer.id}-evidence`;
  const questionIndex = Number(answer.questionId.match(/-(?:metric|evidence)-(\d+)$/)?.[1] ?? -1);
  const experiences = document.experiences.map((experience, index) => {
    if (index !== experienceIndex) return experience;

    const bullets = experience.bullets.map((bullet, bulletIndex) => {
      if (bulletIndex !== questionIndex) return bullet;
      return { ...bullet, sourceEvidenceIds: [...new Set([...bullet.sourceEvidenceIds, evidenceId])] };
    });

    return {
      ...experience,
      evidence: [
        ...experience.evidence,
        {
          id: evidenceId,
          actions: [answer.answerText],
          results: [{ text: answer.answerText, confidence: "confirmed" as const }],
          skills: [],
          sourceText: answer.answerText,
        },
      ],
      bullets,
    };
  });

  return {
    ...document,
    experiences,
    metadata: { ...document.metadata, updatedAt: new Date().toISOString() },
  };
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    document: ResumeDocument;
    answers?: CoachQaAnswer[];
    answerText?: string;
  };

  const answers = [...(body.answers ?? [])];
  let document = body.document;
  let queue = buildExperienceQuestionQueue(document);
  let session = buildAdaptiveQaSession(queue, answers, document);

  if (body.answerText?.trim() && session.activeTurn) {
    const now = new Date().toISOString();
    const answer: CoachQaAnswer = {
      id: `backend-answer-${now}`,
      projectId: "backend-coach",
      resumeId: document.id,
      targetId: session.activeTurn.targetId,
      targetSource: session.activeTurn.targetSource,
      questionId: session.activeTurn.questionId,
      questionKind: session.activeTurn.questionKind,
      questionPrompt: session.activeTurn.questionPrompt,
      answerText: body.answerText.trim(),
      status: "confirmed",
      createdAt: now,
      updatedAt: now,
    };
    answers.push(answer);
    document = promoteAnswerToEvidence(document, answer);
    queue = buildExperienceQuestionQueue(document);
    session = buildAdaptiveQaSession(queue, answers, document);
  }

  return NextResponse.json({
    activeTurn: session.activeTurn,
    counts: session.counts,
    turns: session.turns,
    answers,
    document,
  });
}
