# Grill-Resume

Grill-Resume 是一个本地优先的中文简历工作台，用于把原始材料、岗位 JD、追问记录和已确认 STAR 证据整理成可导出的 confirmed-only 简历。

## 核心边界

- 默认读取和写入本机 workspace。
- 联网搜索和 AI 调用必须经过隐私预览确认。
- AI 只生成候选建议，不直接写入 confirmed bullet。
- 导出只使用用户已确认的内容，缺口以 partial/gap 方式暴露，不伪造事实。

## 本地运行

```bash
pnpm exec next dev
```

默认访问 `http://localhost:3000`。如果当前 pnpm 版本要求 workspace 文件必须包含 `packages` 字段，可改用本地 bin：

```bash
./node_modules/.bin/next dev
```

## 验证

```bash
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint src --max-warnings=0
./node_modules/.bin/next build
```

项目使用 Next.js 16 和 React 19。修改 route、Server Action 或 client/server 边界前，先阅读 `node_modules/next/dist/docs/` 中对应章节。
