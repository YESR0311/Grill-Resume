# Grill-Resume — rmx 子项目

Grill-Resume 是 rmx-style 子项目，循 rmx 母路径 SOP；母路径 = `/home/yesr/projects/aaa/rmx/`。

## 必读上下文

@/home/yesr/projects/aaa/.trellis/spec/guides/rmx-sop.md
@/home/yesr/projects/aaa/rmx/Grill-Resume/.trellis/spec/guides/rmx-onboarding.md
@/home/yesr/projects/aaa/rmx/Grill-Resume/BRAIN.md
@/home/yesr/projects/aaa/rmx/Grill-Resume/manifest.json

## 边界

- `external/` 默认只读
- owned implementation：`app/`、`build/`
- 子项目 Trellis：`/home/yesr/projects/aaa/rmx/Grill-Resume/.trellis/`
- 不修改 rmx 母路径与 aaa 工作区根的配置（`/home/yesr/projects/aaa/CLAUDE.md`、`.claude/`、`.trellis/`、`/home/yesr/projects/aaa/rmx/manifest.json` 中除本项目 child entry 外）

## 工作流

按 rmx-sop §6 五段循环（Discover → Plan → Act → Verify → Compound）。
