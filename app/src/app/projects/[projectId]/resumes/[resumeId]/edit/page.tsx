import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { generateDraft } from "@/features/ai/generate-draft";
import { listModelConfigs } from "@/features/ai/model-configs";
import {
  getProject,
  getProjectResume,
  listVersions,
  parseAwards,
  parseCertificates,
  parseEducation,
  parseExperiences,
  parseProjects,
  parseSkills,
  restoreResumeVersion,
  saveResumeVersion,
  updateResumeSections,
} from "@/features/resume/storage";
import type { ResumeDocument } from "@/features/resume/types";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ projectId: string; resumeId: string }>;
};

async function saveBasics(projectId: string, resumeId: string, formData: FormData) {
  "use server";

  await updateResumeSections(resumeId, {
    basics: {
      name: String(formData.get("name") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim() || undefined,
      email: String(formData.get("email") ?? "").trim() || undefined,
      city: String(formData.get("city") ?? "").trim() || undefined,
      targetRole: String(formData.get("targetRole") ?? "").trim() || undefined,
      links: [],
    },
  });
  redirect(`/projects/${projectId}/resumes/${resumeId}/edit`);
}

async function saveSections(projectId: string, resumeId: string, formData: FormData) {
  "use server";

  const sections = {
    education: parseEducation(formData),
    experiences: parseExperiences(formData),
    projects: parseProjects(formData),
    skills: parseSkills(formData),
    certificates: parseCertificates(formData),
    awards: parseAwards(formData),
  };
  await updateResumeSections(resumeId, sections);
  redirect(`/projects/${projectId}/resumes/${resumeId}/edit`);
}

async function generateDraftAction(projectId: string, resumeId: string, formData: FormData) {
  "use server";

  const current = await getProjectResume(projectId, resumeId);
  if (!current) notFound();
  await generateDraft({
    projectId,
    resumeId,
    document: current.document,
    freeText: String(formData.get("freeText") ?? ""),
  });
  redirect(`/projects/${projectId}/resumes/${resumeId}/edit`);
}

async function saveVersionAction(projectId: string, resumeId: string, formData: FormData) {
  "use server";

  await saveResumeVersion(resumeId, String(formData.get("label") ?? ""));
  redirect(`/projects/${projectId}/resumes/${resumeId}/edit`);
}

async function restoreVersionAction(projectId: string, resumeId: string, versionId: string) {
  "use server";

  await restoreResumeVersion(resumeId, versionId);
  redirect(`/projects/${projectId}/resumes/${resumeId}/edit`);
}

function first<T>(items: T[]): T | undefined {
  return items[0];
}

function ResumePreview({ document }: { document: ResumeDocument }) {
  return (
    <article className="min-h-[760px] rounded-2xl bg-white p-8 text-slate-950 shadow-sm ring-1 ring-slate-200">
      <header className="border-b border-slate-200 pb-4">
        <h2 className="text-3xl font-semibold tracking-tight">{document.basics.name || "姓名"}</h2>
        <p className="mt-2 text-sm text-slate-600">
          {[document.basics.targetRole, document.basics.city, document.basics.phone, document.basics.email]
            .filter(Boolean)
            .join(" · ") || "目标岗位 · 城市 · 联系方式"}
        </p>
      </header>

      {document.education.length > 0 ? (
        <section className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">教育经历</h3>
          {document.education.map((item) => (
            <div key={item.id} className="mt-3">
              <div className="flex justify-between gap-4 text-sm font-medium">
                <span>{item.school}</span>
                <span className="text-slate-500">{[item.startDate, item.endDate].filter(Boolean).join(" - ")}</span>
              </div>
              <p className="mt-1 text-sm text-slate-600">{[item.degree, item.major].filter(Boolean).join(" · ")}</p>
            </div>
          ))}
        </section>
      ) : null}

      {document.experiences.length > 0 ? (
        <section className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">实习 / 工作经历</h3>
          {document.experiences.map((item) => (
            <div key={item.id} className="mt-3">
              <div className="flex justify-between gap-4 text-sm font-medium">
                <span>{item.organization}</span>
                <span className="text-slate-500">{[item.startDate, item.endDate].filter(Boolean).join(" - ")}</span>
              </div>
              <p className="mt-1 text-sm text-slate-600">{item.role}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
                {item.bullets.map((bullet) => (
                  <li key={bullet.id}>{bullet.text}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}

      {document.projects.length > 0 ? (
        <section className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">项目经历</h3>
          {document.projects.map((item) => (
            <div key={item.id} className="mt-3">
              <div className="flex justify-between gap-4 text-sm font-medium">
                <span>{item.name}</span>
                <span className="text-slate-500">{item.techStack.join(" / ")}</span>
              </div>
              {item.role ? <p className="mt-1 text-sm text-slate-600">{item.role}</p> : null}
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
                {item.bullets.map((bullet) => (
                  <li key={bullet.id}>{bullet.text}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}

      {document.skills.length > 0 ? (
        <section className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">技能</h3>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            {document.skills.flatMap((group) => group.items).join("、")}
          </p>
        </section>
      ) : null}
    </article>
  );
}

export default async function EditResumePage({ params }: Props) {
  const { projectId, resumeId } = await params;
  const project = getProject(projectId);
  if (!project) notFound();

  const current = await getProjectResume(project.id, resumeId);
  if (!current) notFound();

  const { resume, document } = current;
  const versions = listVersions(resume.id);
  const modelConfigs = await listModelConfigs();
  const hasDefaultModel = modelConfigs.some((config) => config.isDefault);
  const education = first(document.education);
  const experience = first(document.experiences);
  const experienceBullet = first(experience?.bullets ?? []);
  const resumeProject = first(document.projects);
  const projectBullet = first(resumeProject?.bullets ?? []);
  const skillGroup = first(document.skills);
  const certificate = first(document.certificates);
  const award = first(document.awards);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <Link href={`/projects/${project.id}`} className="text-sm font-medium text-slate-500 hover:text-slate-950">
            ← 返回项目
          </Link>
          <div className="flex items-center gap-4">
            <Link href={`/projects/${project.id}/resumes/${resumeId}/score`} className="text-sm font-medium text-slate-500 hover:text-slate-950">
              评分/优化
            </Link>
            <Link href={`/projects/${project.id}/resumes/${resumeId}/export`} className="text-sm font-medium text-slate-500 hover:text-slate-950">
              导出
            </Link>
            <span className="text-sm text-slate-500">保存后实时刷新预览</span>
          </div>
        </div>

        <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">编辑简历</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{resume.name}</h1>
          <p className="mt-3 text-sm text-slate-500">
            {resume.kind === "master" ? "主简历" : "岗位版简历"} · 保存后实时刷新预览。
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <form action={generateDraftAction.bind(null, project.id, resumeId)} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">AI 草稿</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    只生成 draft 文件，不覆盖当前 confirmed 简历。请求会发送到默认 OpenAI-compatible 模型。
                  </p>
                  {!hasDefaultModel ? (
                    <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      尚未配置默认模型。请先保存模型配置。
                    </p>
                  ) : null}
                </div>
                <Link href="/settings/models" className="text-sm font-medium text-slate-500 hover:text-slate-950">
                  模型设置
                </Link>
              </div>
              <textarea
                name="freeText"
                required
                placeholder="粘贴原始经历、岗位 JD、STAR 素材。未确认成果会被要求标记 needs_confirmation。"
                className="mt-5 min-h-32 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                disabled={!hasDefaultModel}
                className="mt-4 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                生成草稿
              </button>
            </form>

            <form action={saveVersionAction.bind(null, project.id, resumeId)} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-semibold">版本记录</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                保存当前简历 JSON 快照。恢复版本会覆盖当前简历内容，但不会修改快照文件。
              </p>
              <div className="mt-5 flex gap-3">
                <input name="label" placeholder="版本名称（可选）" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                <button className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800">
                  保存版本
                </button>
              </div>
              {versions.length > 0 ? (
                <ul className="mt-5 space-y-3">
                  {versions.map((version) => (
                    <li key={version.id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4 text-sm">
                      <div>
                        <p className="font-medium text-slate-900">{version.label || "未命名版本"}</p>
                        <p className="mt-1 text-xs text-slate-400">{version.createdAt}</p>
                      </div>
                      <form action={restoreVersionAction.bind(null, project.id, resumeId, version.id)}>
                        <button className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-950 hover:text-slate-950">
                          恢复
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-5 text-sm text-slate-500">暂无保存版本。</p>
              )}
            </form>

            <form action={saveBasics.bind(null, project.id, resumeId)} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-semibold">基础信息</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  姓名
                  <input name="name" defaultValue={document.basics.name} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  目标岗位
                  <input name="targetRole" defaultValue={document.basics.targetRole} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  手机
                  <input name="phone" defaultValue={document.basics.phone} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  邮箱
                  <input name="email" defaultValue={document.basics.email} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2" />
                </label>
                <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                  城市
                  <input name="city" defaultValue={document.basics.city} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2" />
                </label>
              </div>
              <button className="mt-5 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800">
                保存基础信息
              </button>
            </form>

            <form action={saveSections.bind(null, project.id, resumeId)} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <input type="hidden" name="educationId" value={education?.id ?? ""} />
              <input type="hidden" name="experienceId" value={experience?.id ?? ""} />
              <input type="hidden" name="experienceBulletId" value={experienceBullet?.id ?? ""} />
              <input type="hidden" name="projectId" value={resumeProject?.id ?? ""} />
              <input type="hidden" name="projectBulletId" value={projectBullet?.id ?? ""} />
              <input type="hidden" name="skillId" value={skillGroup?.id ?? ""} />
              <input type="hidden" name="certificateId" value={certificate?.id ?? ""} />
              <input type="hidden" name="awardId" value={award?.id ?? ""} />
              <h2 className="text-xl font-semibold">核心模块</h2>

              <div className="mt-5 space-y-6">
                <fieldset className="grid gap-4 sm:grid-cols-2">
                  <legend className="text-sm font-semibold text-slate-900">教育经历</legend>
                  <input name="educationSchool" defaultValue={education?.school} placeholder="学校" className="rounded-xl border border-slate-300 px-3 py-2" />
                  <input name="educationDegree" defaultValue={education?.degree} placeholder="学历" className="rounded-xl border border-slate-300 px-3 py-2" />
                  <input name="educationMajor" defaultValue={education?.major} placeholder="专业" className="rounded-xl border border-slate-300 px-3 py-2" />
                  <input name="educationGpa" defaultValue={education?.gpa} placeholder="GPA / 排名" className="rounded-xl border border-slate-300 px-3 py-2" />
                  <input name="educationStartDate" defaultValue={education?.startDate} placeholder="开始时间" className="rounded-xl border border-slate-300 px-3 py-2" />
                  <input name="educationEndDate" defaultValue={education?.endDate} placeholder="结束时间" className="rounded-xl border border-slate-300 px-3 py-2" />
                  <textarea name="educationHonors" defaultValue={education?.honors?.join("\n")} placeholder="荣誉/奖项，每行一条" className="rounded-xl border border-slate-300 px-3 py-2 sm:col-span-2" />
                </fieldset>

                <fieldset className="grid gap-4 sm:grid-cols-2">
                  <legend className="text-sm font-semibold text-slate-900">实习 / 工作经历</legend>
                  <input name="experienceOrganization" defaultValue={experience?.organization} placeholder="组织/公司" className="rounded-xl border border-slate-300 px-3 py-2" />
                  <input name="experienceRole" defaultValue={experience?.role} placeholder="角色" className="rounded-xl border border-slate-300 px-3 py-2" />
                  <input name="experienceStartDate" defaultValue={experience?.startDate} placeholder="开始时间" className="rounded-xl border border-slate-300 px-3 py-2" />
                  <input name="experienceEndDate" defaultValue={experience?.endDate} placeholder="结束时间" className="rounded-xl border border-slate-300 px-3 py-2" />
                  <textarea name="experienceBullet" defaultValue={experienceBullet?.text} placeholder="最终 bullet，PR3 再接 STAR 拆解" className="rounded-xl border border-slate-300 px-3 py-2 sm:col-span-2" />
                </fieldset>

                <fieldset className="grid gap-4 sm:grid-cols-2">
                  <legend className="text-sm font-semibold text-slate-900">项目经历</legend>
                  <input name="projectName" defaultValue={resumeProject?.name} placeholder="项目名称" className="rounded-xl border border-slate-300 px-3 py-2" />
                  <input name="projectRole" defaultValue={resumeProject?.role} placeholder="角色" className="rounded-xl border border-slate-300 px-3 py-2" />
                  <input name="projectTechStack" defaultValue={resumeProject?.techStack.join("、")} placeholder="技术栈，用逗号分隔" className="rounded-xl border border-slate-300 px-3 py-2 sm:col-span-2" />
                  <textarea name="projectBullet" defaultValue={projectBullet?.text} placeholder="项目 bullet" className="rounded-xl border border-slate-300 px-3 py-2 sm:col-span-2" />
                </fieldset>

                <fieldset className="grid gap-4 sm:grid-cols-2">
                  <legend className="text-sm font-semibold text-slate-900">技能 / 证书 / 奖项</legend>
                  <input name="skillName" defaultValue={skillGroup?.name} placeholder="技能组名称" className="rounded-xl border border-slate-300 px-3 py-2" />
                  <input name="skillItems" defaultValue={skillGroup?.items.join("、")} placeholder="技能，用逗号分隔" className="rounded-xl border border-slate-300 px-3 py-2" />
                  <input name="certificateName" defaultValue={certificate?.name} placeholder="证书名称" className="rounded-xl border border-slate-300 px-3 py-2" />
                  <input name="certificateIssuer" defaultValue={certificate?.issuer} placeholder="证书机构" className="rounded-xl border border-slate-300 px-3 py-2" />
                  <input name="awardName" defaultValue={award?.name} placeholder="奖项名称" className="rounded-xl border border-slate-300 px-3 py-2" />
                  <input name="awardIssuer" defaultValue={award?.issuer} placeholder="颁发机构" className="rounded-xl border border-slate-300 px-3 py-2" />
                </fieldset>
              </div>

              <button className="mt-6 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800">
                保存核心模块
              </button>
            </form>
          </div>

          <div className="lg:sticky lg:top-6 lg:self-start">
            <ResumePreview document={document} />
          </div>
        </section>
      </div>
    </main>
  );
}
