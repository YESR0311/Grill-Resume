# Grill-Resume 应用

这是 Grill-Resume 的本地应用目录。项目主要功能和完整使用说明见仓库根目录的 `README.md`。

## 本地运行

```bash
pnpm install
pnpm dev
```

默认访问：

```text
http://localhost:3000
```

## 常用入口

- 首页：创建和进入简历项目
- `/settings/models`：配置 AI 模型
- `/settings/search`：配置联网搜索
- 项目页：录入材料、进入 Grill 追问、编辑简历、评分优化和导出

## 使用原则

- 默认本地保存。
- 外发请求先经过隐私预览。
- AI 只生成候选，不直接确认事实。
- 最终导出只包含已确认内容。
