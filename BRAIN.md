# Grill-Resume rmx child

Grill-Resume 目标：整合多个 resume 生成、优化、管理、导出项目的优点，形成完整的交互式问答 → 网络评估 → AI 润色 → 中文 Word 输出工具链。

当前阶段：`06-02-resume-remix-overhaul` umbrella in_progress，stage0 已完成，stage1 de-signature + naming 进行中。

## 战略四问

### 采（借鉴的能力 + 出处）

- 多源采集 + 流水账抽取：`wzdnzd-resume` Web 简历布局；`resume-alchemist` AI 诊断流程；`resumify` 实习经历内容方法。
- 采用 `JobPilot`（`jade-ai` 超集）作为 editor/preview/排版组件主骨架，后续改造成 confirmed-only layout editor。
- `html-anything` 的页面元素设计方法进入 renderer-agnostic layout schema，作为 HTML preview 与 docx direct render 的共同结构源。
- 严谨客观评估：`lucid-resume` 的 skill ledger + provenance chain（每技能有出处链路 + 计算年数 + 证据强度）；`shushu-internship-resume-optimizer` 的多源材料审计与排序；`jade-ai` 的 ATS 模板检测理念。
- Hybrid grill 引擎：确定性 turn state machine + 弱维度 scoring 保底，LLM 只做受 evidence 约束的澄清、冲突检测、动态追问和结构化草稿。
- 中文 DOCX 输出：`resume-builder-skill` 的 11+ 岗位维度 + 中文 ATS 友好排版 + HTML/DOCX 双出；`jade-ai` 的 Next.js stack 同构与 DOCX route 形态。
- Confidence tiering（仅概念）：`ResumePRO` README 的 Verified/Calculated/Estimated 三档 + Phase A/B 策略 + 6 维 scoring + MoSCoW/Iceberg/semantic-cluster JD 分析。仅作概念借鉴，不可读源码（ARR）。

### 避（明确不学的）

- `wzdnzd-resume` / `zineyu-resume` 的纯前端自由写事实模式直接搬到 owned；owned editor 只做排版与措辞微调，新事实回到 grill 确认。
- `lucid-resume` 的 19,983 技能 LinkedIn 分类表（来源 license 不明，需独立审）。
- `lucid-resume` C#/WPF 桌面层（owned 是 Next.js + React，不复用桌面控件）。
- `jade-ai` 的 Puppeteer PDF 渲染 + 50 模板（owned MVP 仅 docx 包直渲 + 1 个 zh-clean 模板）。
- `jade-ai` 的 token-based share link / view counter（与 local-first 不一致）。
- `starry` 的 Claude commands markdown 文案（仅借鉴交互结构，不复制文本）。
- `deep-interview-omc` 所属仓库 `oh-my-claudecode` 的其余模块（已 sparse-checkout 排除）。
- `resume-builder-skill` 的 prompt 全文直拷（仅借鉴岗位维度划分结构）。
- `ResumePRO` 源码（ARR + showcase repo，永不可 vendored）。
- 任何 GPL/AGPL 源（当前 10 个 source 已避开）。

### 加（rmx-idea 自创）

- `rmx-idea:privacy-preview-gate`：所有外发（Tavily / LLM provider）前的字段白名单 + UI 预览门 + 用户每次显式 confirm，落点 `app/src/features/privacy/`。
- `rmx-idea:grill-on-turn-model`：在现有 6 态 `CoachQaTurn` 之上叠加 grill 引擎（ambiguity 分数 + 弱维度优先 + 推荐答案脚手架），不重写 turn model。落点 `app/src/features/coach/conversation/`。
- `rmx-idea:health-gate-flow`：CoachFlowRail 5 段不强制顺序，但每段显残缺度门，允许 partial 导出 + gap report。
- `rmx-idea:candidate-only-polish`：AI 润色严格发生在 candidate 层，3 版 STAR-3W（保守/平衡/激进），保留原文 diff，confirmed bullet 永不被 AI rewrite。落点 `app/src/features/polish/`。
- `rmx-idea:confirmed-only-docx`：docx 输出仅渲染 `confirmed-only` 内容，partialMode 报缺口而不伪造，仅 `docx` 包直渲不走 HTML→docx 转换。落点 `app/src/features/export/docx.ts` + `templates/zh-clean.ts`。

### 不做

- LLM 自动生成"用户没说过的事实"。
- 自动 push / PR / 外部消息。
- Confirmed bullet 的 AI rewrite + revision 历史。
- PDF / DOCX / 图片导入。
- 多模板 / 双语 / in-app docx 编辑。
- 行业基准 / 薪资带评估维度。
- 强制线性阶段流。
- 改 `~/.claude/skills/grill-with-docs/SKILL.md` 本体。
- 改 rmx 母路径 `/home/yesr/projects/aaa/rmx/` 或 aaa 工作区根 `/home/yesr/projects/aaa/.claude|.trellis/` 的配置。

## external sources（详见 manifest.json）

| name | license | role |
| --- | --- | --- |
| `resume-alchemist/` | MIT (README) | React resume builder + reference templates + export flows |
| `resumify/` | MIT | 实习经历提炼 + 简历内容方法 |
| `shushu-internship-resume-optimizer/` | Apache-2.0 | 多源材料 → 简历 / 面试表达的审计与排序 |
| `wzdnzd-resume/` | MIT (README) | Web 简历 builder + 本地存储 + 导出参考；视觉灵感基底 |
| `zineyu-resume/` | UNKNOWN (needs-review) | Tauri 桌面 builder + 本地持久化 + 多格式导出参考；仅作架构参考 |
| `lucid-resume/` | Unlicense | skill ledger + provenance + RRF 5 层抽取 + ATS detection + DOCX/PDF + local Ollama |
| `resume-builder-skill/` | MIT (README only · needs-review) | Skill 形式中文 HTML+DOCX 双出 + 11+ 岗位维度 + ATS 友好 |
| `jade-ai/` | Apache-2.0 | Next.js 16 App Router resume builder + 50 模板 + 多格式导出 + 双语 |
| `JobPilot/` | Apache-2.0 | `jade-ai` 超集：editor/preview/排版组件主骨架，剥离 Tauri/auth/db/i18n 后改造 |
| `starry/` | MIT | STARR + Facts-only + Companies 派生 + Claude commands |
| `deep-interview-omc/` (sparse) | MIT | `skills/deep-interview/` only：Ouroboros Socratic + ambiguity scoring + one-question + 弱维度迭代 |
| `html-anything/` | Apache-2.0 | 页面元素设计方法与结构化 block vocabulary；只借鉴 layout schema 思路，不走 HTML→docx |

仅概念借鉴（不入 `external/`）：

- `ResumePRO`（All Rights Reserved · showcase repo）：Phase A/B 策略 + Verified/Calculated/Estimated 三档置信度 + 6 维 scoring + MoSCoW/Iceberg/semantic-cluster JD 分析。仅 README 概念，源码不可读。

## owned implementation

- 现有：`app/src/{app, features/{ai, coach, export, resume, score}, lib}`、`build/`。
- 在建（按 4-slice 推进）：
  - slice 1：`app/src/features/{privacy, intake}/` + `.trellis/spec/frontend/privacy-boundary.md`
  - slice 2：`app/src/features/{search, coach/conversation}/` + `features/coach/{skill-scarcity, company-verify}.ts` + 扩 `jd-coverage.ts`
  - slice 3：`app/src/features/polish/` + Coach polish 子路由
  - slice 4：`app/src/features/export/{docx.ts, templates/zh-clean.ts}` + CoachFlowRail 健康门 + 端到端 smoke

## 边界

- `external/` 默认只读。
- owned 改动仅在 `app/`、`build/`、`.trellis/spec/`、`.trellis/tasks/<task>/`。
- 不从本子项目修改 `/home/yesr/projects/aaa/` 根 + `aaa/.claude/` + `aaa/.trellis/` + `aaa/rmx/manifest.json` 中除 `children[Grill-Resume]` 路径外的其它内容。
- 不自动 commit / push / PR / 外部消息。
- `~/.claude/skills/grill-with-docs/SKILL.md` 不动。
