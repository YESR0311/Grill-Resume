import { NextRequest, NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { getModel, extractAIConfig, AIConfigError } from '@/lib/ai/provider';
import { resolveUser, getUserIdFromRequest } from '@/lib/auth/helpers';
import { interviewRepository } from '@/lib/db/repositories/interview.repository';
import { interviewReportSchema } from '@/lib/ai/interview-report-schema';
import { dbReady } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbReady;
  const { id: sessionId } = await params;
  const fingerprint = getUserIdFromRequest(request);
  const user = await resolveUser(fingerprint);
  if (!user) return new Response('Unauthorized', { status: 401 });

  const report = await interviewRepository.findReportBySessionId(sessionId);
  if (!report) return NextResponse.json({ error: 'No report found' }, { status: 404 });

  return NextResponse.json(report);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbReady;
    const { id: sessionId } = await params;
    const fingerprint = getUserIdFromRequest(request);
    const user = await resolveUser(fingerprint);
    if (!user) return new Response('Unauthorized', { status: 401 });

    const session = await interviewRepository.findSession(sessionId);
    if (!session || session.userId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const existing = await interviewRepository.findReportBySessionId(sessionId);
    if (existing) return NextResponse.json(existing);

    const { model: modelId, locale = 'zh' } = await request.json();
    const aiConfig = extractAIConfig(request);
    const model = getModel(aiConfig, modelId);

    const roundsWithMessages = await interviewRepository.findAllMessagesBySessionId(sessionId);

    const conversationLog = roundsWithMessages.map(({ round, messages }) => {
      const config = round.interviewerConfig as any;
      return {
        interviewerType: round.interviewerType,
        interviewerName: config.name,
        roundId: round.id,
        messages: messages.map((m: { role: string; content: string; metadata: unknown }) => ({
          role: m.role,
          content: m.content,
          metadata: m.metadata,
        })),
      };
    });

    const lang = locale === 'zh' ? '中文' : 'English';

    const { object: report } = await generateObject({
      model,
      schema: interviewReportSchema,
      prompt: `你是一位资深面试评估专家。请根据以下面试对话记录，生成详细的面试评估报告。请用${lang}回答。

岗位 JD：
${session.jobDescription}

面试对话记录：
${JSON.stringify(conversationLog, null, 2)}

请生成包含以下内容的完整报告：
1. 综合评分 (0-100)
2. 能力维度评分（6-8 个维度的雷达图数据，每个维度 0-100 分）
3. 每轮面试的逐题评估（每个问题的评分 1-5、亮点、不足、参考思路）
4. 总体反馈（3-5 段详细建议）
5. 改进计划（按优先级排列，附学习资源推荐）

注意：标记了 "marked": true 的消息请在报告中重点标注，使用了 "hinted": true 的问题请标注，"skipped": true 的问题请标注为已跳过。`,
    });

    const saved = await interviewRepository.createReport({
      sessionId,
      overallScore: report.overallScore,
      dimensionScores: report.dimensionScores,
      roundEvaluations: report.roundEvaluations,
      overallFeedback: report.overallFeedback,
      improvementPlan: report.improvementPlan,
    });

    return NextResponse.json(saved);
  } catch (error) {
    if (error instanceof AIConfigError) {
      return new Response(JSON.stringify({ error: error.message }), { status: 401 });
    }
    console.error('POST /api/interview/[id]/report error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
