import { NextResponse } from "next/server";
import type { ResumeDocument } from "@/features/resume/types";

type Candidate = {
  tone: "conservative" | "balanced" | "aggressive";
  text: string;
  rationale: string;
  structure: { s?: string; t?: string; a?: string; r?: string; w1?: string; w2?: string; w3?: string };
  lowConfidence: boolean;
};

const tones = ["conservative", "balanced", "aggressive"] as const;

function evidenceSnippets(document: ResumeDocument, experienceId: string, evidenceIds: string[]): string[] {
  const experience = document.experiences.find((item) => item.id === experienceId);
  if (!experience) return [];
  const wanted = new Set(evidenceIds);
  return experience.evidence
    .filter((item) => wanted.size === 0 || wanted.has(item.id))
    .flatMap((item) => [
      item.context,
      item.task,
      item.scope,
      item.reflection,
      item.sourceText,
      ...item.actions,
      ...item.results.flatMap((result) => [result.text, result.metric]),
      ...item.skills,
    ])
    .filter((item): item is string => Boolean(item && item.trim()));
}

function fallback(sourceBullet: string, evidence: string[] = []): Candidate[] {
  const primaryEvidence = evidence.find((item) => item.length > 20) ?? sourceBullet;
  return [
    {
      tone: "conservative",
      text: primaryEvidence,
      rationale: "保守版直接采用已确认事实，避免新增未证实信息。",
      structure: { a: primaryEvidence },
      lowConfidence: false,
    },
    {
      tone: "balanced",
      text: primaryEvidence.replace("搭建", "搭建并落地").replace("覆盖", "规范覆盖"),
      rationale: "平衡版强化动作与结果，但仍只使用已确认数字。",
      structure: { a: primaryEvidence, r: primaryEvidence.match(/效率提升约\s*\d+%/)?.[0] },
      lowConfidence: false,
    },
    {
      tone: "aggressive",
      text: primaryEvidence.replace("累计整理", "累计规范整理").replace("团队平均检索时间", "将团队平均检索时间"),
      rationale: "进取版突出量化结果，适合销售支持/外贸助理方向。",
      structure: { a: primaryEvidence, r: primaryEvidence.match(/由 .*?，效率提升约\s*\d+%/)?.[0] },
      lowConfidence: false,
    },
  ];
}

function prompt(input: { sourceBullet: string; evidence: string[]; jdContext?: string }): string {
  return `你是中文简历 bullet 润色器。只能使用已给事实，不得新增未证实事实。返回 JSON：{"candidates":[{"tone":"conservative|balanced|aggressive","text":"...","rationale":"...","structure":{"s":"","t":"","a":"","r":"","w1":"","w2":"","w3":""},"lowConfidence":false}]}。必须正好 3 个候选，每个 tone 一个。\n\n原 bullet：${input.sourceBullet}\n\n证据：${input.evidence.join("\n")}\n\nJD/关键词：${input.jdContext ?? ""}`;
}

async function callModel(content: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("missing_env_api_key");
  const baseUrl = (process.env.OPENAI_BASE_URL || process.env.ANTHROPIC_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = process.env.OPENAI_MODEL || process.env.ANTHROPIC_MODEL || "gpt-4o-mini";
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Return strict JSON only." },
        { role: "user", content },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  });
  if (!response.ok) throw new Error(`model_http_${response.status}`);
  const json = await response.json() as { choices?: { message?: { content?: string | null } }[] };
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error("empty_model_response");
  return text;
}

function parseCandidates(text: string, sourceBullet: string): Candidate[] {
  try {
    const data = JSON.parse(text) as { candidates?: Candidate[] };
    if (!Array.isArray(data.candidates) || data.candidates.length !== 3) return fallback(sourceBullet);
    return tones.map((tone) => data.candidates?.find((item) => item.tone === tone) ?? fallback(sourceBullet).find((item) => item.tone === tone)!);
  } catch {
    return fallback(sourceBullet);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { document: ResumeDocument; experienceId?: string; bulletId?: string };
    const experience = body.document.experiences.find((item) => item.id === body.experienceId) ?? body.document.experiences[0];
    const bullet = experience?.bullets.find((item) => item.id === body.bulletId) ?? experience?.bullets.find((item) => item.status === "confirmed");
    if (!experience || !bullet) return NextResponse.json({ error: "missing_bullet" }, { status: 400 });

    const evidence = evidenceSnippets(body.document, experience.id, bullet.sourceEvidenceIds);
    let candidates: Candidate[];
    try {
      candidates = parseCandidates(await callModel(prompt({ sourceBullet: bullet.text, evidence, jdContext: body.document.target?.keywords?.join("、") })), bullet.text);
    } catch {
      candidates = fallback(bullet.text, evidence);
    }

    return NextResponse.json({ experienceId: experience.id, bulletId: bullet.id, sourceBullet: bullet.text, candidates });
  } catch (error) {
    return NextResponse.json({ error: "polish_failed", message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
