# Grill-Resume

> 本地优先的 AI 简历生成工具。通过「6 阶段引导式问答 → 逐条联网评估 → 综合润色导出」三步，把零散经历变成一份可导出的中文 Word 简历。AI 模型与联网搜索均由你自行配置 URL 和 Key，所有数据存本机。

---

## ✨ 它能做什么

| 阶段 | 路由 | 作用 |
|---|---|---|
| **问答采集** | `/intake` `/intake/[id]` | AI 像顾问一样按 6 阶段自由追问（基本信息 → 工作 → 项目 → 技能 → 教育 → 补充证据）。每阶段可随时结束，后台静默把对话结构化写入档案，无需填表、无需上传文件。 |
| **档案编辑** | `/profile/[id]` | 工作台表单：核对、修改 AI 提取的姓名 / 经历 / 项目 / 技能 / 教育等字段。 |
| **联网评估** | `/evaluate/[id]` | 基于目标岗位对每条要点联网搜索佐证，给出「相关性 / 可信度 / 稀缺度」评级与改进建议，生成总评。 |
| **润色导出** | `/polish/[id]` | 综合档案 + 评估，AI 改写要点 → Tiptap 结构化编辑器 → 一键导出 **A4 竖版**中文 Word（`.docx`）。 |
| **设置** | `/settings` | AI 连接、搜索渠道、任务路由（首次必配）。 |

### 9 种简历模板

5 主题（白蓝经典 / 学术论文 / 智能科技紫罗兰 / 时尚创意 / 黑蓝 ATS）× 4 文档族（时序 / 混合 / 功能 / ATS），每种组合决定**证件照位置**、**主题色**、**字体**。

| 文档族 | 模板 | 适用场景 |
|---|---|---|
| 时序 | **T1-Classic**（简约）/ **T2-Modern**（现代）/ **T3-Warm**（暖色）/ **T4-Compact**（紧凑） | 黑白极简 / 互联网科技 / 创意设计 / 经验丰富者 |
| 混合 | **H1-Skills**（技能优先）/ **H2-Achievement**（成就导向）/ **H3-Project**（项目导向） | 技术岗 / 管理销售 / 研发产品 PM |
| 功能 | **F1-Functional**（转行版） | 弱化时间线、突出可迁移技能 |
| ATS | **A1-ATS**（优化版） | 纯文本布局，全大写标题，ATS 解析准确率最大化 |

所有模板强制 A4 竖版（210×297mm），预留**小二寸 35mm×45mm 证件照**占位符。

### 设计风格

- **配色**：design_sense 暖色调（奶白 `#F7F4EF` 背景 + 赭石 `#C4612F` 强调色 + 暖灰 `#E7E1D7` 分隔线）
- **字体**：Playfair Display（衬线，标题）+ Inter（无衬线，正文/UI）+ GeistMono（等宽，代码块）
- **布局**：四步流程页（问答 / 档案 / 评估 / 润色）统一用 `StepNavSidebar` 侧边栏 + 顶部 `StepNav` 的工作台结构
- **深色模式**：跟随系统或手动切换，问答页侧边栏有 IntakeProgress 亮灯效果

### 技术栈

Next.js 16（App Router / RSC / Server Actions）· React 19 · TypeScript 5 · SQLite（`better-sqlite3`，带 schema 自愈）· Tailwind v4 · docx · Tiptap（7 扩展：字号 / 字重 / 行距 / 字间距 / 对齐 / 颜色 / 字体）。AI 走 OpenAI 兼容协议；联网搜索支持 Tavily / EXA。

---

## 📋 前置要求

| 工具 | 版本 | 用途 |
|---|---|---|
| **Node.js** | ≥ 20（推荐 22 LTS 或 24） | Next.js 16 + React 19 需要 |
| **pnpm** | ≥ 9 | 包管理（仓库默认） |
| **Git** | 任意 | 拉取代码 |
| **AI 服务** | OpenAI 兼容 | DeepSeek / 智谱 / 月之暗面 / OpenAI / 自建网关皆可，需 Base URL + API Key |
| **（可选）搜索渠道** | Tavily 或 EXA | 评估阶段联网佐证；不配也能评估但会降级 |

> 全部数据存本机 SQLite（`./app/.workspace/app.db`），不上云。

---

## 🚀 安装与启动

### 1. 克隆并安装依赖

```bash
git clone https://github.com/YESR0311/Grill-Resume.git
cd Grill-Resume/app            # Next.js 工程在 app/ 子目录
pnpm install
```

> 工程位于 `app/` 子目录，仓库根没有 `package.json`（monorepo-lite 布局）。

### 2. 开发模式启动

```bash
pnpm dev                       # http://localhost:3369
```

首次启动会：
- 在 `app/.workspace/` 下创建 SQLite 数据库（`app.db`）
- 启动日志里看到 `✓ Ready in <ms>` 即就绪
- 端口固定 `3369`（如需改：`pnpm dev -- -p 3000`）

### 3. 生产构建

```bash
pnpm build
RESUME_CONFIG_SECRET=<你的随机字符串> pnpm start
```

> **生产环境必设** `RESUME_CONFIG_SECRET`：用于加密本地保存的 AI Key / 搜索 Key。生成方式：
>
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```
>
> 开发模式（`pnpm dev`）用内置 dev key，无需设置。

### 4.（可选）自定义工作目录

默认数据/数据库写在 `app/.workspace/`。想换位置：

```bash
RESUME_WORKSPACE=/path/to/data pnpm dev
# 或生产：
RESUME_WORKSPACE=/var/lib/grill-resume RESUME_CONFIG_SECRET=... pnpm start
```

---

## ⚙️ 首次配置（必做）

启动后打开 `http://localhost:3369/settings`：

### ① AI 连接

点「**添加连接**」，填：

| 字段 | 示例 | 说明 |
|---|---|---|
| 名称 | `DeepSeek` | 自定义显示名 |
| Base URL | `https://api.deepseek.com/v1` | OpenAI 兼容的 `/v1` 端点 |
| API Key | `sk-...` | 加密存本机，不外发 |
| 默认模型 | `deepseek-chat` | 默认发往该连接的模型 |

保存后点右侧「**测试**」按钮验证连通（看到绿色对勾即 OK）。

### ② 任务路由（可选）

不配置也行——所有任务走 ① 的默认连接。

可针对**问答 / 评估 / 润色**分别指定不同连接/模型（例如问答用便宜模型，润色用强模型）。

### ③ 搜索渠道（可选）

评估阶段需要联网佐证时用，添加：

- **Tavily**：去 [tavily.com](https://tavily.com) 申请 Key
- **EXA**：去 [exa.ai](https://exa.ai) 申请 Key

可同时启用多个，评估时并发搜索并去重。**不配也能评估**，只是不会调用搜索、相关性评分会更粗。

> 所有 Key 加密存储在 SQLite 的 `settings` 表（`aes-256-gcm`），Key 在 `RESUME_CONFIG_SECRET` 缺失时启动会拒绝运行（除开发模式）。

---

## 📖 使用流程

四步流程在顶部 `StepNav` 之间自由跳转，**前序未完成的步骤可点但页面会提示**。

### Step 1 — 新建档案

- 首页 `/` 点「**新建档案**」 → 跳到 `/intake/<新建id>`
- 或点「**最近档案**」卡片继续上次未完成的档案

### Step 2 — 6 阶段问答建档

进入 `/intake/[id]`，对话框里和 AI 自由对话：

| 阶段 | 收集内容 |
|---|---|
| 1 基本信息 | 姓名 / 目标岗位 / 联系方式 |
| 2 工作经历 | 公司 + 时间段 + 职责 + 成果（按 id 匹配避免重复） |
| 3 项目经历 | 项目名 + 角色 + 技术栈 + 亮点 |
| 4 技能 | 语言 / 框架 / 工具 / 软技能 |
| 5 教育背景 | 学校 / 专业 / 时间 / 课程 / GPA |
| 6 补充证据 | 奖项 / 证书 / 论文 / 博客等 |

每阶段可等 AI 自动收尾，或点右上「**我先到这里**」按钮手动进入下一阶段。后台静默把每段对话结构化写回档案；解析失败不会中断流程，partial 部分会标「（部分）」。

### Step 3 — 档案核对

`/profile/[id]` 工作台编辑器，逐字段检查 AI 提取的内容，手动修正。点右上「**去评估**」进入下一步。

### Step 4 — 联网评估

`/evaluate/[id]`：

1. 点「**开始评估**」打开确认弹窗
2. 确认后逐条经历联网搜索 → 评估（relevance / specificity / credibility / recency / expression / scarcity 六维）
3. 生成总评报告，**ScrollArea** 可滚动查看所有卡片
4. 单条 LLM 失败不影响其他条目，失败项以 `failed` 状态呈现

### Step 5 — 润色与导出

`/polish/[id]`：

- **左侧** Tiptap 结构化编辑器（工具栏：字号 / 字重 / 行距 / 字间距 / 对齐 / 颜色 / 字体）
- **右侧** 实时预览（A4 比例）
- 顶部「**模板**」下拉切换 9 模板之一，证件照位置随之变化
- 顶部「**风格**」控件调字号 / 字重 / 行距 / 字间距 / 对齐 / 主题色 / 字体
- 点「**导出 Word**」下载 `.docx`（A4 竖版，与预览一致）

---

## 🗂️ 项目结构

```
Grill-Resume/
├── app/                          # Next.js 工程根
│   ├── .workspace/               # 运行时数据 (gitignored)
│   │   ├── app.db                # SQLite 主库
│   │   ├── projects/             # 项目级文件
│   │   └── settings/             # 加密配置
│   ├── src/
│   │   ├── app/                  # App Router 路由
│   │   │   ├── intake/[id]/      # 6 阶段问答
│   │   │   ├── profile/[id]/     # 档案编辑
│   │   │   ├── evaluate/[id]/    # 联网评估
│   │   │   ├── polish/[id]/      # 润色导出
│   │   │   ├── settings/         # 配置页
│   │   │   └── api/intake/parse  # 异步解析 API
│   │   ├── components/           # React 组件
│   │   ├── features/             # 业务模块
│   │   │   ├── ai/chat.ts        # OpenAI 兼容 LLM 客户端
│   │   │   ├── intake/           # 6 阶段引擎 + 解析器
│   │   │   ├── polish/           # 润色引擎 + 9 模板
│   │   │   ├── evaluation/       # 联网评估引擎
│   │   │   ├── profile/          # 档案模型
│   │   │   ├── settings/         # 配置存储
│   │   │   └── export/           # DOCX 导出 + html-runs
│   │   ├── lib/                  # db / crypto / workspace
│   │   └── __tests__/            # 回归测试
│   ├── public/                   # 静态资源
│   └── package.json
└── README.md
```

---

## 🛠️ 常见任务

### 跑回归测试

```bash
cd app
pnpm tsx --conditions=react-server src/__tests__/regression.test.ts
```

覆盖：设计系统 / 9 模板 / 证件照尺寸 / 侧边栏布局 / 问答流程 / 评估页滚动 / 润色编辑器扩展 / DOCX 导出扩展 / pretext 集成（20 项）。

### Lint

```bash
cd app
pnpm lint
```

### 重置本地数据

```bash
rm -rf app/.workspace    # 删掉数据库和加密配置，下次启动会重建
```

### 更换 AI 服务商

在 `/settings` 配新连接，Base URL 走 OpenAI 兼容协议即可。已实测可用：

- **DeepSeek**（`https://api.deepseek.com/v1`，`deepseek-chat`）
- **智谱 GLM**（`https://open.bigmodel.cn/api/paas/v4`，`glm-4-plus`）
- **月之暗面 Kimi**（`https://api.moonshot.cn/v1`，`moonshot-v1-8k`）
- **OpenAI**（`https://api.openai.com/v1`，`gpt-4o-mini` / `gpt-4o`）
- **自建网关**（任何 `/v1/chat/completions` 兼容端点）

### 备份与迁移

整个 `app/.workspace/` 目录即全部数据。复制走即可完整迁移；恢复时把目录放回 `app/.workspace/` 即可（**生产环境别忘了同步 `RESUME_CONFIG_SECRET`**，否则加密配置无法解密）。

---

## 🔒 数据与隐私

- **全部数据存本机 SQLite**（`app.db`），不上云、不上报
- **AI Key / 搜索 Key** AES-256-GCM 加密存本机，Key 来自 `RESUME_CONFIG_SECRET`
- **错误信息消毒**：上游 API 报错经 `toUserMessage` 转换后才展示给用户，不直接回传 stack trace
- **联网评估需显式确认**：不会自动外发
- **schema 自愈**：`intake_messages.dimension` 列与索引等在启动时由 `ensureSchema` 自动补全，老库/破损库都安全

---

## 📝 文档族与主题（高级）

- **文档族**：`chronological`（时序） / `hybrid`（混合） / `functional`（功能） / `ats`（ATS）
- **主题**：`白蓝经典` · `学术论文` · `智能科技紫罗兰` · `时尚创意` · `黑蓝 ATS`
- 组合规则由 `app/src/features/polish/template-style.ts` 的 `getTemplateDesign(templateId)` 提供，每种组合定义 photo 位置、主题色、字体族、TopHeader 变体
- 主题与证件照由 `TopHeader` 统一管理，避免各模板重复实现顶部区

---

## 📄 License

本项目采用 [MIT License](./LICENSE) 开源，可自由使用、修改与分发。
