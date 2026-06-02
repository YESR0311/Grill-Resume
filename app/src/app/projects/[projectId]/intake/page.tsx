import { promises as fs } from "node:fs";
import path from "node:path";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { applyIntakeCandidates, writeIntakeCandidate } from "@/features/intake/apply-candidates";
import { parseRawTextIntake, type ResumeIntakeCandidate } from "@/features/intake/parse-raw-text";
import { getProject, getProjectResume, listResumes } from "@/features/resume/storage";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<{ candidate?: string; status?: string; code?: string }>;
};

function redirectTo(projectId: string, params: Record<string, string | undefined>): never {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  redirect(`/projects/${projectId}/intake?${query.toString()}`);
}

function intakePath(resumeFilePath: string, candidateId: string): string {
  if (!/^[A-Za-z0-9_:-]+$/.test(candidateId)) throw new Error("invalid-candidate");
  return path.join(path.dirname(resumeFilePath), "intake", `${candidateId}.json`);
}

async function readCandidate(projectId: string, resumeId: string, candidateId: string): Promise<ResumeIntakeCandidate | null> {
  const current = await getProjectResume(projectId, resumeId);
  if (!current) return null;
  try {
    const json = JSON.parse(await fs.readFile(intakePath(current.resume.filePath, candidateId), "utf-8"));
    return json && typeof json === "object" && json.id === candidateId ? (json as ResumeIntakeCandidate) : null;
  } catch {
    return null;
  }
}

async function parseIntakeAction(projectId: string, resumeId: string, formData: FormData) {
  "use server";

  const rawText = String(formData.get("rawText") ?? "").trim();
  if (!rawText) redirectTo(projectId, { status: "error", code: "empty-input" });

  const candidate = parseRawTextIntake({
    rawText,
    jdText: String(formData.get("jdText") ?? "").trim() || undefined,
    targetRole: String(formData.get("targetRole") ?? "").trim() || undefined,
  });

  try {
    await writeIntakeCandidate({ projectId, resumeId, candidate });
  } catch {
    redirectTo(projectId, { status: "error", code: "candidate-write-failed" });
  }

  redirectTo(projectId, { status: "parsed", candidate: candidate.id });
}

async function applyIntakeAction(projectId: string, resumeId: string, candidateId: string, formData: FormData) {
  "use server";

  const candidate = await readCandidate(projectId, resumeId, candidateId);
  if (!candidate) redirectTo(projectId, { status: "error", code: "candidate-not-found" });

  try {
    await applyIntakeCandidates({
      projectId,
      resumeId,
      candidate,
      selection: {
        educationIds: formData.getAll("educationId").map(String),
        experienceIds: formData.getAll("experienceId").map(String),
        projectIds: formData.getAll("projectId").map(String),
        skillIds: formData.getAll("skillId").map(String),
      },
    });
  } catch {
    redirectTo(projectId, { status: "error", code: "apply-failed", candidate: candidateId });
  }

  redirectTo(projectId, { status: "applied" });
}

export default async function IntakePage({ params, searchParams }: Props) {
  const { projectId } = await params;
  const query = (await searchParams) ?? {};
  const project = getProject(projectId);
  if (!project) notFound();

  const master = listResumes(project.id).find((resume) => resume.kind === "master");
  if (!master) notFound();

  const candidate = query.candidate ? await readCandidate(project.id, master.id, query.candidate) : null;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <Link href={`/projects/${project.id}`} className="text-sm font-medium text-slate-500 hover:text-slate-950">
          ← 返回项目
        </Link>

        <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Intake</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">粘贴材料，生成待确认候选</h1>
          <p className="mt-3 text-sm text-slate-600">候选内容只有勾选确认后才写入简历；默认不会调用 AI 或外部网络。</p>
          {query.status === "error" ? <p className="mt-4 rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{query.code}</p> : null}
          {query.status === "applied" ? <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700">已写入已确认候选。</p> : null}
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <form action={parseIntakeAction.bind(null, project.id, master.id)} className="space-y-4">
            <input name="targetRole" placeholder="目标岗位（可选）" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            <textarea name="jdText" placeholder="JD（可选）" className="min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            <textarea name="rawText" required placeholder="粘贴流水账材料。可用：经历｜岗位｜成果；项目｜角色｜技术栈；技能｜React，Node.js" className="min-h-48 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            <button className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800">解析候选</button>
          </form>
        </section>

        {candidate ? (
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-semibold text-slate-900">候选确认</h2>
            <form action={applyIntakeAction.bind(null, project.id, master.id, candidate.id)} className="mt-5 space-y-6">
              {candidate.education.length > 0 ? (
                <CandidateGroup title="教育">
                  {candidate.education.map((item) => (
                    <label key={item.id} className="block rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
                      <input name="educationId" value={item.id} type="checkbox" className="mr-2" />
                      {item.school} · {item.degree} · {item.major}
                    </label>
                  ))}
                </CandidateGroup>
              ) : null}

              {candidate.experiences.length > 0 ? (
                <CandidateGroup title="经历">
                  {candidate.experiences.map((item) => (
                    <label key={item.id} className="block rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
                      <input name="experienceId" value={item.id} type="checkbox" className="mr-2" />
                      {item.organization} · {item.role}
                      {item.bullets[0] ? <p className="mt-2 text-slate-500">{item.bullets[0].text}</p> : null}
                    </label>
                  ))}
                </CandidateGroup>
              ) : null}

              {candidate.projects.length > 0 ? (
                <CandidateGroup title="项目">
                  {candidate.projects.map((item) => (
                    <label key={item.id} className="block rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
                      <input name="projectId" value={item.id} type="checkbox" className="mr-2" />
                      {item.name}{item.role ? ` · ${item.role}` : ""}
                    </label>
                  ))}
                </CandidateGroup>
              ) : null}

              {candidate.skills.length > 0 ? (
                <CandidateGroup title="技能">
                  {candidate.skills.map((item) => (
                    <label key={item.id} className="block rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
                      <input name="skillId" value={item.id} type="checkbox" className="mr-2" />
                      {item.items.join("、")}
                    </label>
                  ))}
                </CandidateGroup>
              ) : null}

              <button className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800">写入勾选项</button>
            </form>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function CandidateGroup(props: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{props.title}</h3>
      <div className="space-y-3">{props.children}</div>
    </div>
  );
}
