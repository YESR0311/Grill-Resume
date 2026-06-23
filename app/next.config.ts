import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  outputFileTracingExcludes: {
    "/*": [".workspace/**/*"],
  },
  // prompts/index.ts 用 process.cwd()/src/features/ai/prompts 读 .md；
  // intake/prompts-loader.ts 用 process.cwd()/src/features/intake/prompts 读 .md。
  // standard build（next start）下 src/ 不被删，路径有效；切 standalone 时
  // 下面的 tracing include 保证 .md 随产物分发，避免运行时 ENOENT。
  outputFileTracingIncludes: {
    "/**": [
      "src/features/ai/prompts/**/*.md",
      "src/features/intake/prompts/**/*.md",
    ],
  },
};

export default nextConfig;
